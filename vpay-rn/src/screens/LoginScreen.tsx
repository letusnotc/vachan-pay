import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView }          from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation }         from 'react-i18next';
import { supabase }               from '../lib/supabase';
import LanguageSwitcher           from '../components/LanguageSwitcher';
import { RootStackParamList }     from '../../App';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { t }               = useTranslation();
  const [phone, setPhone]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (!cleaned) { Alert.alert(t('common.error'), t('login.errorEmpty')); return; }
    if (!/^[6-9]\d{9}$/.test(cleaned)) { Alert.alert(t('common.error'), t('login.errorInvalid')); return; }

    setLoading(true);
    const e164 = `+91${cleaned}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setLoading(false);

    if (error) { Alert.alert(t('common.error'), error.message); return; }
    navigation.navigate('Otp', { phone: e164 });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          <View style={styles.topRow}>
            <LanguageSwitcher />
          </View>

          <View style={styles.hero}>
            <Text style={styles.logo}>💜</Text>
            <Text style={styles.title}>{t('login.title')}</Text>
            <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.phoneRow}>
              <View style={styles.prefix}>
                <Text style={styles.prefixText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder={t('login.phonePlaceholder')}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              <Text style={styles.btnText}>{loading ? t('login.sending') : t('login.sendOtp')}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F8F9FA' },
  container:   { flexGrow: 1, padding: 24 },
  topRow:      { alignItems: 'flex-end', marginBottom: 32 },
  hero:        { alignItems: 'center', marginBottom: 40 },
  logo:        { fontSize: 60, marginBottom: 12 },
  title:       { fontSize: 26, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  subtitle:    { fontSize: 15, color: '#6B7280', marginTop: 6, textAlign: 'center' },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 20,
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  phoneRow:    { flexDirection: 'row', marginBottom: 16, alignItems: 'center' },
  prefix:      { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12,
                 paddingVertical: 14, marginRight: 8 },
  prefixText:  { fontSize: 15, color: '#1A1A1A', fontWeight: '600' },
  input:       { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
                 paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: '#1A1A1A' },
  btn:         { backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' }
});

export default LoginScreen;
