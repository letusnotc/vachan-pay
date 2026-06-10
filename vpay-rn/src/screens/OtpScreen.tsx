import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp }                 from '@react-navigation/native';
import { useTranslation }            from 'react-i18next';
import { supabase }                  from '../lib/supabase';
import { RootStackParamList }        from '../../App';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Otp'>;
  route:      RouteProp<RootStackParamList, 'Otp'>;
};

const OTP_TIMEOUT = 60;

const OtpScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t }             = useTranslation();
  const { phone }         = route.params;
  const [otp, setOtp]     = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(OTP_TIMEOUT);

  useEffect(() => {
    const id = setInterval(() => setTimer(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const handleVerify = async () => {
    if (otp.length !== 6) { Alert.alert(t('common.error'), 'Enter the 6-digit OTP'); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    setLoading(false);
    if (error) { Alert.alert(t('common.error'), error.message); return; }
    // App.tsx will detect the new session and route accordingly (ProfileSetup or Home)
  };

  const handleResend = async () => {
    if (timer > 0) return;
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) { Alert.alert(t('common.error'), error.message); return; }
    setTimer(OTP_TIMEOUT);
    Alert.alert('OTP Sent', `A new OTP was sent to ${phone}`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.container}>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>← {t('common.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t('otp.title')}</Text>
          <Text style={styles.sub}>{t('otp.subtitle', { phone })}</Text>

          <TextInput
            style={styles.input}
            placeholder={t('otp.placeholder')}
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
            returnKeyType="done"
            onSubmitEditing={handleVerify}
            autoFocus
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? t('otp.verifying') : t('otp.verify')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleResend} disabled={timer > 0} style={styles.resendRow}>
            <Text style={[styles.resendText, timer > 0 && styles.resendDisabled]}>
              {timer > 0 ? t('otp.resendIn', { sec: timer }) : t('otp.resend')}
            </Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F8F9FA' },
  container:    { flex: 1, padding: 24, justifyContent: 'center' },
  back:         { marginBottom: 32 },
  backText:     { color: '#6C63FF', fontSize: 15, fontWeight: '600' },
  title:        { fontSize: 26, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  sub:          { fontSize: 14, color: '#6B7280', marginBottom: 32 },
  input:        { borderWidth: 1.5, borderColor: '#6C63FF', borderRadius: 12,
                  paddingHorizontal: 20, paddingVertical: 16, fontSize: 24,
                  letterSpacing: 8, textAlign: 'center', color: '#1A1A1A',
                  backgroundColor: '#fff', marginBottom: 20 },
  btn:          { backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendRow:    { marginTop: 20, alignItems: 'center' },
  resendText:   { color: '#6C63FF', fontSize: 14, fontWeight: '600' },
  resendDisabled: { color: '#9CA3AF' }
});

export default OtpScreen;
