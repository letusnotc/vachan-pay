import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Animated, Easing, Dimensions,
} from 'react-native';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect }            from '@react-navigation/native';
import { useTranslation }            from 'react-i18next';
import * as Contacts                 from 'expo-contacts';

import { useVoice }        from '../hooks/useVoice';
import { useStore }        from '../store/store';
import { api }             from '../lib/api';
import { normalizePhone }  from '../utils/phone';
import VoiceButton         from '../components/VoiceButton';
import LanguageSwitcher    from '../components/LanguageSwitcher';
import Sidebar             from '../components/Sidebar';
import { RootStackParamList } from '../../App';
import { C, shadow } from '../theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

function getGreeting(t: (k: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t('home.goodMorning');
  if (h < 17) return t('home.goodAfternoon');
  return t('home.goodEvening');
}


const { width: SW, height: SH } = Dimensions.get('window');
const DOT_GAP = 28;

function DotGrid() {
  const cols = Math.ceil(SW / DOT_GAP);
  const rows = Math.ceil(SH / DOT_GAP);
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <View
          key={`${r}-${c}`}
          style={[dg.dot, { top: r * DOT_GAP, left: c * DOT_GAP }]}
        />
      );
    }
  }
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">{dots}</View>;
}

const dg = StyleSheet.create({
  dot: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(91,79,232,0.25)' },
});

function HamburgerIcon() {
  return (
    <View style={hb.wrap}>
      <View style={hb.line} />
      <View style={[hb.line, { width: 16 }]} />
      <View style={hb.line} />
    </View>
  );
}

const hb = StyleSheet.create({
  wrap: { gap: 5, padding: 4 },
  line: { width: 22, height: 2.5, backgroundColor: C.text, borderRadius: 2 },
});

export default function HomeScreen({ navigation }: Props) {
  const { t }       = useTranslation();
  const { profile } = useStore();

  const { isRecording, isProcessing, transcript, startRecording, stopAndProcess, speak } = useVoice();

  const [balance,     setBalance]     = useState<number>(profile?.wallet_balance ?? 0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const mountAnim = useRef(new Animated.Value(0)).current;
  const micAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(mountAnim, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(micAnim,   { toValue: 1, duration: 450, easing: Easing.out(Easing.back(1.05)), useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await api.get('/profile/balance');
      setBalance(Number(res.data.balance));
    } catch { /* silently retry on next focus */ }
  }, []);

  useFocusEffect(useCallback(() => { fetchBalance(); }, [fetchBalance]));

  const handleVoicePress = async () => {
    if (isRecording) {
      const result = await stopAndProcess();
      if (!result) return;
      const { intent, parameters, clarification_message } = result;
      if (clarification_message) { speak(clarification_message); return; }
      if (intent === 'check_balance') {
        speak(t('voice.balance', { amount: balance.toFixed(2) }));
        navigation.navigate('Balance');
        return;
      }
      if (intent === 'check_history') { navigation.navigate('History'); return; }
      if (intent === 'make_payment' && parameters.name && parameters.amount) {
        await resolveContactAndNavigate(parameters.name, parameters.amount);
        return;
      }
      speak(t('voice.unknown'));
    } else {
      const ok = await startRecording();
      if (ok) speak(t('voice.listening'));
    }
  };

  const resolveContactAndNavigate = async (name: string, amount: number) => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') { speak(t('voice.contactsPermissionDenied')); return; }

    const { data: contacts } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
    });

    const matches = contacts
      .filter(c => c.name?.toLowerCase().includes(name.toLowerCase()))
      .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0);

    if (matches.length === 0) { speak(t('voice.contactNotFound', { name })); return; }

    if (matches.length === 1) {
      const phone = normalizePhone(matches[0].phoneNumbers![0].number!);
      speak(t('voice.confirmPayment', { name: matches[0].name, amount }));
      navigation.navigate('ConfirmPayment', { receiverName: matches[0].name!, receiverPhone: phone, amount });
      return;
    }

    const options = matches.slice(0, 3).map((c, i) => ({
      text: `${i + 1}. ${c.name}`,
      onPress: () => {
        const phone = normalizePhone(c.phoneNumbers![0].number!);
        navigation.navigate('ConfirmPayment', { receiverName: c.name!, receiverPhone: phone, amount });
      },
    }));
    options.push({ text: t('common.back'), onPress: () => {} });
    Alert.alert(t('payment.selectRecipient'), '', options);
  };

  const firstName     = profile?.name?.split(' ')[0] ?? '';
  const greetingText  = getGreeting(t);
  const micScale      = micAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  const statusText = isProcessing
    ? t('home.processing')
    : isRecording
    ? t('home.listening')
    : t('home.statusIdle');

  return (
    <>
      <SafeAreaView style={s.safe}>
        <DotGrid />

        {/* ── Top bar ── */}
        <Animated.View style={[s.topBar, { opacity: mountAnim }]}>
          <TouchableOpacity onPress={() => setSidebarOpen(true)} style={s.hamburgerBtn} activeOpacity={0.7}>
            <HamburgerIcon />
          </TouchableOpacity>
          <Text style={s.brandName}>VPay</Text>
          <LanguageSwitcher />
        </Animated.View>

        {/* ── Main content ── */}
        <View style={s.body}>

          {/* Greeting block */}
          <Animated.View style={[s.greetingBlock, { opacity: mountAnim }]}>
            <View style={s.greetingBg} />
            <Text style={s.greetingLabel}>{greetingText}</Text>
            <Text style={s.greetingName}>{firstName}</Text>
            <Text style={s.subtitle}>{t('home.subtitle')}</Text>
            <View style={s.subtitleLine} />
          </Animated.View>

          {/* Mic button */}
          <Animated.View style={[s.micWrap, { opacity: micAnim, transform: [{ scale: micScale }] }]}>
            <VoiceButton
              isRecording={isRecording}
              isProcessing={isProcessing}
              onPress={handleVoicePress}
            />
          </Animated.View>

          {/* Status text with dash decorators */}
          <Animated.View style={[s.statusBlock, { opacity: mountAnim }]}>
            <View style={s.statusRow}>
              {!isRecording && !isProcessing && <View style={s.statusDash} />}
              <Text style={[
                s.statusText,
                isRecording  && s.statusActive,
                isProcessing && s.statusProcessing,
              ]}>
                {statusText}
              </Text>
              {!isRecording && !isProcessing && <View style={s.statusDash} />}
            </View>
          </Animated.View>

          {/* Transcript bubble */}
          {!!transcript && (
            <View style={s.transcriptBubble}>
              <Text style={s.transcriptLabel}>{t('home.transcriptDetected')}</Text>
              <Text style={s.transcriptText}>"{transcript}"</Text>
            </View>
          )}

        </View>
      </SafeAreaView>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
      />
    </>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  hamburgerBtn: {
    backgroundColor: C.white, borderRadius: 12,
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
    ...shadow.sm,
  },
  brandName: { fontSize: 18, fontWeight: '800', color: C.primary, letterSpacing: -0.3 },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 28 },

  greetingBlock: { alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
  greetingBg:   { ...StyleSheet.absoluteFillObject, backgroundColor: C.bg, opacity: 0.60 },
  greetingLabel: { fontSize: 20, color: C.primary, fontWeight: '600' },
  greetingName:  { fontSize: 44, fontWeight: '800', color: C.text, letterSpacing: -1.2 },
  subtitle:      { fontSize: 16, color: C.textSub, textAlign: 'center', lineHeight: 23, marginTop: 4 },
  subtitleLine:  { width: 40, height: 2.5, borderRadius: 2, backgroundColor: C.primary, marginTop: 12 },

  micWrap: { alignItems: 'center' },

  statusBlock: { alignItems: 'center' },
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDash:  { width: 26, height: 1.5, borderRadius: 1, backgroundColor: C.primary, opacity: 0.5 },
  statusText:       { fontSize: 15, color: C.textMuted, fontWeight: '500', textAlign: 'center' },
  statusActive:     { color: C.error,   fontWeight: '700' },
  statusProcessing: { color: C.primary, fontWeight: '700' },

  transcriptBubble: {
    backgroundColor: C.white, borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 14,
    maxWidth: '90%', ...shadow.sm,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  transcriptLabel: {
    fontSize: 10, fontWeight: '700', color: C.primary,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6,
  },
  transcriptText: { fontSize: 14, color: C.textSub, fontStyle: 'italic', textAlign: 'center', lineHeight: 20 },
});
