import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp }                 from '@react-navigation/native';
import { useTranslation }            from 'react-i18next';
import * as Speech                   from 'expo-speech';

import { api }            from '../lib/api';
import { useStore }       from '../store/store';
import { normalizePhone } from '../utils/phone';
import { RootStackParamList } from '../../App';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ConfirmPayment'>;
  route:      RouteProp<RootStackParamList, 'ConfirmPayment'>;
};

const ConfirmPaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t }        = useTranslation();
  const { language } = useStore();

  // Accept pre-filled params from voice or empty for manual entry
  const [receiverName,  setReceiverName]  = useState(route.params?.receiverName  ?? '');
  const [receiverPhone, setReceiverPhone] = useState(route.params?.receiverPhone ?? '');
  const [amount,        setAmount]        = useState(route.params?.amount ? String(route.params.amount) : '');
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);

  const isVoicePrefilled = !!(route.params?.receiverPhone);

  // Read out payment details when coming from voice flow
  useEffect(() => {
    if (isVoicePrefilled && receiverName && amount) {
      Speech.speak(
        t('voice.confirmPayment', { name: receiverName, amount }),
        { language: language === 'hi' ? 'hi-IN' : 'en-US', rate: 0.9 }
      );
    }
    return () => Speech.stop();
  }, []);

  const handleConfirm = async () => {
    const phone  = normalizePhone(receiverPhone);
    const parsed = parseFloat(amount);

    if (!phone)         { Alert.alert(t('common.error'), 'Enter recipient phone'); return; }
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      Alert.alert(t('common.error'), 'Invalid phone — use 10-digit Indian number'); return;
    }
    if (isNaN(parsed) || parsed <= 0) { Alert.alert(t('common.error'), 'Enter a valid amount'); return; }

    setLoading(true);
    try {
      await api.post('/payment/transfer', { receiverPhone: phone, amount: parsed });
      setSuccess(true);
      Speech.speak(
        t('payment.success', { amount: parsed.toFixed(2), name: receiverName || phone }),
        { language: language === 'hi' ? 'hi-IN' : 'en-US' }
      );
      setTimeout(() => navigation.navigate('Home'), 2500);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.error || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successText}>
            {t('payment.success', { amount: parseFloat(amount).toFixed(2), name: receiverName || receiverPhone })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>← {t('common.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t('payment.title')}</Text>

          <View style={styles.card}>
            {/* Recipient */}
            <Text style={styles.fieldLabel}>{t('payment.to')}</Text>
            {isVoicePrefilled ? (
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyText}>{receiverName} ({receiverPhone})</Text>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                placeholder={t('payment.receiverPhone')}
                value={receiverPhone}
                onChangeText={setReceiverPhone}
                keyboardType="phone-pad"
              />
            )}

            {/* Amount */}
            <Text style={styles.fieldLabel}>{t('payment.amount')}</Text>
            {isVoicePrefilled && amount ? (
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyAmount}>₹{parseFloat(amount).toFixed(2)}</Text>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                placeholder={t('payment.amountLabel')}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            )}
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>{t('payment.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, loading && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={loading}
            >
              <Text style={styles.confirmText}>{loading ? t('payment.sending') : t('payment.confirm')}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#F8F9FA' },
  container:        { padding: 24 },
  back:             { marginBottom: 20 },
  backText:         { color: '#6C63FF', fontSize: 15, fontWeight: '600' },
  title:            { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 24 },
  card:             { backgroundColor: '#fff', borderRadius: 16, padding: 20,
                      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, marginBottom: 24 },
  fieldLabel:       { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase',
                      letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input:            { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#F9FAFB',
                      paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1A1A1A' },
  readonlyBox:      { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  readonlyText:     { fontSize: 15, color: '#374151', fontWeight: '500' },
  readonlyAmount:   { fontSize: 28, color: '#1A1A1A', fontWeight: '800' },
  btnRow:           { flexDirection: 'row', gap: 12 },
  cancelBtn:        { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
                      paddingVertical: 14, alignItems: 'center' },
  cancelText:       { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  confirmBtn:       { flex: 1, backgroundColor: '#6C63FF', borderRadius: 12,
                      paddingVertical: 14, alignItems: 'center' },
  confirmText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled:      { opacity: 0.6 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  successIcon:      { fontSize: 72, marginBottom: 20 },
  successText:      { fontSize: 20, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' }
});

export default ConfirmPaymentScreen;
