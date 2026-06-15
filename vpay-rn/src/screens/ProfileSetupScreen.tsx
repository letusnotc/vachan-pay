import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { api }            from '../lib/api';
import { supabase }       from '../lib/supabase';
import { useStore }       from '../store/store';

const ProfileSetupScreen: React.FC = () => {
  const { t }                   = useTranslation();
  const { setProfile }          = useStore();
  const [name,  setName]        = useState('');
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert(t('common.error'), 'Name is required'); return; }
    setLoading(true);
    try {
      const res = await api.post('/profile', { name: name.trim(), email: email.trim() || null });
      setProfile(res.data.profile);
      // App.tsx detects profile is now set and switches to the app stack automatically
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          <Text style={styles.emoji}>👤</Text>
          <Text style={styles.title}>{t('profileSetup.title')}</Text>

          <TextInput
            style={styles.input}
            placeholder={t('profileSetup.namePlaceholder')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder={t('profileSetup.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? t('profileSetup.saving') : t('profileSetup.save')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOut} onPress={() => supabase.auth.signOut()}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#F8F9FA' },
  container:  { flexGrow: 1, padding: 24, justifyContent: 'center' },
  emoji:      { fontSize: 56, textAlign: 'center', marginBottom: 16 },
  title:      { fontSize: 24, fontWeight: '700', color: '#1A1A1A', textAlign: 'center', marginBottom: 32 },
  input:      { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#fff',
                paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1A1A1A', marginBottom: 14 },
  btn:         { backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  signOut:     { marginTop: 20, alignItems: 'center' },
  signOutText: { color: '#9CA3AF', fontSize: 13 },
});

export default ProfileSetupScreen;
