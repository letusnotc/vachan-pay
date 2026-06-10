import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
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

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { t }          = useTranslation();
  const { profile }    = useStore();
  const [balance, setBalance] = useState<number>(profile?.wallet_balance ?? 0);
  const { isRecording, isProcessing, transcript, startRecording, stopAndProcess, speak } = useVoice();

  const fetchBalance = useCallback(async () => {
    try {
      const res = await api.get('/profile/balance');
      setBalance(Number(res.data.balance));
    } catch { /* silently refresh on next focus */ }
  }, []);

  // Refresh balance every time the screen comes into focus
  useFocusEffect(useCallback(() => { fetchBalance(); }, [fetchBalance]));

  const handleVoicePress = async () => {
    if (isRecording) {
      // Already recording — stop and process
      const result = await stopAndProcess();
      if (!result) return;

      const { intent, parameters, clarification_message } = result;

      if (clarification_message) {
        speak(clarification_message);
        return;
      }

      if (intent === 'check_balance') {
        speak(t('voice.balance', { amount: balance.toFixed(2) }));
        navigation.navigate('Balance');
        return;
      }

      if (intent === 'check_history') {
        navigation.navigate('History');
        return;
      }

      if (intent === 'make_payment' && parameters.name && parameters.amount) {
        await resolveContactAndNavigate(parameters.name, parameters.amount);
        return;
      }

      speak(t('voice.unknown'));
    } else {
      // Start recording
      const ok = await startRecording();
      if (ok) speak(t('voice.listening'));
    }
  };

  const resolveContactAndNavigate = async (name: string, amount: number) => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') { speak(t('voice.contactsPermissionDenied')); return; }

    const { data: contacts } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name]
    });

    const matches = contacts
      .filter(c => c.name?.toLowerCase().includes(name.toLowerCase()))
      .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0);

    if (matches.length === 0) {
      speak(t('voice.contactNotFound', { name }));
      return;
    }

    if (matches.length === 1) {
      const phone = normalizePhone(matches[0].phoneNumbers![0].number!);
      speak(t('voice.confirmPayment', { name: matches[0].name, amount }));
      navigation.navigate('ConfirmPayment', { receiverName: matches[0].name!, receiverPhone: phone, amount });
      return;
    }

    // Multiple matches — let user pick
    const options = matches.slice(0, 3).map((c, i) => ({
      text: `${i + 1}. ${c.name}`,
      onPress: () => {
        const phone = normalizePhone(c.phoneNumbers![0].number!);
        navigation.navigate('ConfirmPayment', { receiverName: c.name!, receiverPhone: phone, amount });
      }
    }));
    options.push({ text: t('common.back'), onPress: () => {} });
    Alert.alert(t('payment.selectRecipient'), '', options);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{t('home.greeting', { name: profile?.name ?? '' })}</Text>
          <LanguageSwitcher />
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('home.balance')}</Text>
          <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
        </View>

        {/* Voice section */}
        <View style={styles.voiceSection}>
          <Text style={styles.voiceHint}>
            {isProcessing ? t('home.processing') : isRecording ? t('home.listening') : t('home.tapToSpeak')}
          </Text>
          <VoiceButton isRecording={isRecording} isProcessing={isProcessing} onPress={handleVoicePress} />
          {!!transcript && <Text style={styles.transcript}>"{transcript}"</Text>}
        </View>

        {/* Quick actions */}
        <View style={styles.grid}>
          {[
            { icon: '💸', label: t('home.pay'),     screen: 'ConfirmPayment' as const, params: { receiverName: '', receiverPhone: '', amount: 0 } },
            { icon: '💰', label: t('home.balance'),  screen: 'Balance'  as const, params: undefined },
            { icon: '📜', label: t('home.history'),  screen: 'History'  as const, params: undefined },
            { icon: '👤', label: t('home.profile'),  screen: 'Profile'  as const, params: undefined }
          ].map(({ icon, label, screen, params }) => (
            <TouchableOpacity
              key={label}
              style={styles.gridItem}
              onPress={() => navigation.navigate(screen as any, params as any)}
            >
              <Text style={styles.gridIcon}>{icon}</Text>
              <Text style={styles.gridLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#F8F9FA' },
  container:     { padding: 20, paddingBottom: 40 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting:      { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  balanceCard:   { backgroundColor: '#6C63FF', borderRadius: 20, padding: 24, marginBottom: 28,
                   shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 8 },
                   shadowOpacity: 0.35, shadowRadius: 14, elevation: 8 },
  balanceLabel:  { fontSize: 14, color: '#D4D0FF', marginBottom: 6 },
  balanceAmount: { fontSize: 38, fontWeight: '800', color: '#fff' },
  voiceSection:  { alignItems: 'center', marginBottom: 36 },
  voiceHint:     { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  transcript:    { marginTop: 14, fontSize: 13, color: '#6B7280', fontStyle: 'italic', textAlign: 'center' },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem:      { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 18,
                   alignItems: 'center', shadowColor: '#000',
                   shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  gridIcon:      { fontSize: 28, marginBottom: 8 },
  gridLabel:     { fontSize: 13, fontWeight: '600', color: '#374151' }
});

export default HomeScreen;
