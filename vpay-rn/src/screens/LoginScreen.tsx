import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase }       from '../lib/supabase';
import LanguageSwitcher   from '../components/LanguageSwitcher';

const PIN_LENGTH = 6;

const phoneToEmail = (e164: string) =>
  `vpay_${e164.replace('+', '')}@vpay.local`;

const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep]       = useState<'phone' | 'pin'>('phone');
  const [phone, setPhone]     = useState('');
  const [pin, setPin]         = useState('');
  const [loading, setLoading] = useState(false);

  const e164 = `+91${phone.replace(/\s/g, '')}`;

  const handlePhoneNext = () => {
    const cleaned = phone.replace(/\s/g, '');
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      Alert.alert('Invalid number', 'Enter a valid 10-digit Indian mobile number');
      return;
    }
    setPin('');
    setStep('pin');
  };

  const handlePinSubmit = async (currentPin: string) => {
    setLoading(true);
    const email = phoneToEmail(e164);

    // Try sign in first — works for returning users
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: currentPin,
    });

    if (!signInErr) {
      setLoading(false);
      return; // App.tsx session listener handles navigation
    }

    // Sign in failed — treat as new user and register
    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password: currentPin,
      options: { data: { phone: e164 } },
    });

    if (signUpErr) {
      Alert.alert('Error', signUpErr.message);
      setPin('');
    }

    setLoading(false);
  };

  const handleKey = (key: string) => {
    if (loading) return;
    if (key === 'del') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) handlePinSubmit(next);
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

          <View style={s.topRow}><LanguageSwitcher /></View>

          <View style={s.hero}>
            <Text style={s.logo}>💜</Text>
            <Text style={s.title}>VPay</Text>
            <Text style={s.subtitle}>Voice-first UPI payments</Text>
          </View>

          {step === 'phone' ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Enter your mobile number</Text>

              <View style={s.phoneRow}>
                <View style={s.prefix}>
                  <Text style={s.prefixText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={s.input}
                  placeholder="10-digit number"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                  returnKeyType="next"
                  onSubmitEditing={handlePhoneNext}
                  autoFocus
                />
              </View>

              <TouchableOpacity style={s.btn} onPress={handlePhoneNext}>
                <Text style={s.btnText}>Continue →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.card}>
              <TouchableOpacity onPress={() => setStep('phone')} style={s.back}>
                <Text style={s.backText}>← {e164}</Text>
              </TouchableOpacity>

              <Text style={s.cardTitle}>Enter your 6-digit PIN</Text>
              <Text style={s.cardSub}>First time? This PIN becomes your password.</Text>

              {/* PIN dots */}
              <View style={s.dots}>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <View key={i} style={[s.dot, i < pin.length && s.dotFilled]} />
                ))}
              </View>

              {loading ? (
                <ActivityIndicator size="large" color="#6C63FF" style={{ marginVertical: 24 }} />
              ) : (
                <View style={s.pad}>
                  {['1','2','3','4','5','6','7','8','9','','0','del'].map((k, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[s.key, k === '' && s.keyGhost]}
                      onPress={() => k && handleKey(k)}
                      disabled={!k}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.keyText, k === 'del' && s.keyDel]}>
                        {k === 'del' ? '⌫' : k}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#F8F9FA' },
  container: { flexGrow: 1, padding: 24 },
  topRow:    { alignItems: 'flex-end', marginBottom: 32 },
  hero:      { alignItems: 'center', marginBottom: 32 },
  logo:      { fontSize: 60, marginBottom: 12 },
  title:     { fontSize: 26, fontWeight: '700', color: '#1A1A1A' },
  subtitle:  { fontSize: 15, color: '#6B7280', marginTop: 6 },

  card:      { backgroundColor: '#fff', borderRadius: 16, padding: 24,
               shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
               shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  cardSub:   { fontSize: 13, color: '#6B7280', marginBottom: 28 },
  back:      { marginBottom: 20 },
  backText:  { color: '#6C63FF', fontWeight: '600', fontSize: 14 },

  phoneRow:  { flexDirection: 'row', marginBottom: 16, alignItems: 'center' },
  prefix:    { backgroundColor: '#F3F4F6', borderRadius: 10,
               paddingHorizontal: 12, paddingVertical: 14, marginRight: 8 },
  prefixText:{ fontSize: 15, color: '#1A1A1A', fontWeight: '600' },
  input:     { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
               paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: '#1A1A1A' },
  btn:       { backgroundColor: '#6C63FF', borderRadius: 12,
               paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },

  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 36 },
  dot:       { width: 18, height: 18, borderRadius: 9,
               borderWidth: 2, borderColor: '#6C63FF', backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: '#6C63FF' },

  pad:       { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  key:       { width: 76, height: 76, borderRadius: 38,
               backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  keyGhost:  { backgroundColor: 'transparent' },
  keyText:   { fontSize: 24, fontWeight: '600', color: '#1A1A1A' },
  keyDel:    { fontSize: 22, color: '#6C63FF' },
});

export default LoginScreen;
