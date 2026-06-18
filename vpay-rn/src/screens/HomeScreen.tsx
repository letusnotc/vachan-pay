import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Animated, Easing,
} from 'react-native';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect }            from '@react-navigation/native';
import { useTranslation }            from 'react-i18next';
import * as Contacts                 from 'expo-contacts';

import { useVoice }       from '../hooks/useVoice';
import { useStore }       from '../store/store';
import { api }            from '../lib/api';
import { normalizePhone } from '../utils/phone';
import VoiceButton        from '../components/VoiceButton';
import LanguageSwitcher   from '../components/LanguageSwitcher';
import { RootStackParamList } from '../../App';
import { C, shadow } from '../theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

const ACTIONS = [
  { emoji: '💸', label: 'Pay',     bg: C.primaryBg,  screen: 'ConfirmPayment' as const, params: { receiverName: '', receiverPhone: '', amount: 0 } },
  { emoji: '💰', label: 'Balance', bg: '#E6FAF4',     screen: 'Balance'        as const, params: undefined },
  { emoji: '🕒', label: 'History', bg: '#EFF6FF',     screen: 'History'        as const, params: undefined },
  { emoji: '👤', label: 'Profile', bg: '#FFF7ED',     screen: 'Profile'        as const, params: undefined },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ navigation }: Props) {
  const { t }       = useTranslation();
  const { profile } = useStore();
  const [balance, setBalance] = useState<number>(profile?.wallet_balance ?? 0);

  const { isRecording, isProcessing, transcript, startRecording, stopAndProcess, speak } = useVoice();

  const mountAnim   = useRef(new Animated.Value(0)).current;
  const balanceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(mountAnim,   { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(balanceAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await api.get('/profile/balance');
      setBalance(Number(res.data.balance));
    } catch { /* silently refresh on next focus */ }
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

  const initials = profile?.name
    ?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  const cardY = balanceAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View style={[s.header, { opacity: mountAnim }]}>
          <View>
            <Text style={s.greetingText}>{greeting()},</Text>
            <Text style={s.nameText}>{profile?.name ?? ''} 👋</Text>
          </View>
          <View style={s.headerRight}>
            <LanguageSwitcher />
            <TouchableOpacity
              style={s.avatarBtn}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
            >
              <Text style={s.avatarBtnText}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Balance card ── */}
        <Animated.View style={[s.balanceCard, { opacity: balanceAnim, transform: [{ translateY: cardY }] }]}>
          {/* Decorative circles */}
          <View style={s.decCircle1} />
          <View style={s.decCircle2} />

          <Text style={s.balanceLabel}>Wallet Balance</Text>
          <Text style={s.balanceAmount}>
            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={s.balanceFooter}>
            <View style={s.balanceBadge}>
              <View style={s.dot} />
              <Text style={s.balanceBadgeText}>VPay Wallet</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.8}>
              <Text style={s.historyLink}>History →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Voice section ── */}
        <Animated.View style={[s.voiceSection, { opacity: mountAnim }]}>
          <Text style={s.voiceStatusText}>
            {isProcessing ? '⏳  Processing…'
              : isRecording ? '🔴  Listening…'
              : '🎙  Tap to speak a command'}
          </Text>

          <VoiceButton
            isRecording={isRecording}
            isProcessing={isProcessing}
            onPress={handleVoicePress}
          />

          {!!transcript && (
            <View style={s.transcriptBubble}>
              <Text style={s.transcriptText}>"{transcript}"</Text>
            </View>
          )}
        </Animated.View>

        {/* ── Quick actions ── */}
        <Animated.View style={{ opacity: mountAnim }}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.grid}>
            {ACTIONS.map(({ emoji, label, bg, screen, params }) => (
              <TouchableOpacity
                key={label}
                style={s.gridItem}
                onPress={() => navigation.navigate(screen as any, params as any)}
                activeOpacity={0.82}
              >
                <View style={[s.gridIcon, { backgroundColor: bg }]}>
                  <Text style={s.gridEmoji}>{emoji}</Text>
                </View>
                <Text style={s.gridLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greetingText:{ fontSize: 14, color: C.textSub, fontWeight: '500' },
  nameText:    { fontSize: 20, fontWeight: '800', color: C.text, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', ...shadow.primary },
  avatarBtnText:{ fontSize: 15, fontWeight: '800', color: '#fff' },

  balanceCard:   { backgroundColor: C.primary, borderRadius: 24, padding: 24, marginBottom: 8, overflow: 'hidden', ...shadow.primary },
  decCircle1:    { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 },
  decCircle2:    { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -30, right: 40 },
  balanceLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '500', marginBottom: 6 },
  balanceAmount: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1, marginBottom: 16 },
  balanceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  dot:           { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  balanceBadgeText:{ fontSize: 12, color: '#fff', fontWeight: '600' },
  historyLink:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },

  voiceSection:    { alignItems: 'center', paddingVertical: 8, marginBottom: 8 },
  voiceStatusText: { fontSize: 14, color: C.textSub, fontWeight: '500', marginBottom: 4 },
  transcriptBubble:{ backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4, maxWidth: '85%', ...shadow.sm },
  transcriptText:  { fontSize: 14, color: C.textSub, fontStyle: 'italic', textAlign: 'center', lineHeight: 20 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 14 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem:     { width: '47%', backgroundColor: C.white, borderRadius: 18, padding: 18, alignItems: 'center', ...shadow.md },
  gridIcon:     { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  gridEmoji:    { fontSize: 24 },
  gridLabel:    { fontSize: 14, fontWeight: '600', color: C.text },
});