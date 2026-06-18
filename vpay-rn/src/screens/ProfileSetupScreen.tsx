import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  Animated, Easing, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { api }            from '../lib/api';
import { useStore }       from '../store/store';
import { C, shadow }      from '../theme';

export default function ProfileSetupScreen() {
  const { t }          = useTranslation();
  const { setProfile } = useStore();

  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const avatarAnim = useRef(new Animated.Value(0)).current;
  const formAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(avatarAnim, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }),
      Animated.timing(formAnim,   { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert(t('common.error'), 'Name is required'); return; }
    setLoading(true);
    try {
      const res = await api.post('/profile', { name: name.trim(), email: email.trim() || null });
      setProfile(res.data.profile);
    } catch (err: any) {
      console.error('[ProfileSetup] save failed:', err?.response?.status, err?.response?.data, err?.message);
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to save profile';
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  const initials = name.trim()
    ? name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const avatarScale   = avatarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const avatarOpacity = avatarAnim;
  const formY         = formAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Step badge */}
          <View style={s.stepRow}>
            <View style={s.stepDot} />
            <View style={[s.stepDot, s.stepDotActive]} />
          </View>

          {/* Avatar preview */}
          <Animated.View style={[s.avatarWrap, { opacity: avatarOpacity, transform: [{ scale: avatarScale }] }]}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <Text style={s.avatarHint}>Your VPay identity</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View style={{ opacity: formAnim, transform: [{ translateY: formY }] }}>
            <Text style={s.title}>{t('profileSetup.title')}</Text>

            <View style={s.field}>
              <Text style={s.label}>Full name</Text>
              <TextInput
                style={[s.input, focused === 'name' && s.inputFocused]}
                placeholder={t('profileSetup.namePlaceholder')}
                placeholderTextColor={C.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
                autoFocus
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Email <Text style={s.optional}>(optional)</Text></Text>
              <TextInput
                style={[s.input, focused === 'email' && s.inputFocused]}
                placeholder={t('profileSetup.emailPlaceholder')}
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSave}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </View>

            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>{t('profileSetup.save')}</Text>
              }
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg },
  container:  { flexGrow: 1, padding: 28, paddingTop: 20 },

  stepRow:      { flexDirection: 'row', gap: 6, marginBottom: 36 },
  stepDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  stepDotActive:{ backgroundColor: C.primary, width: 24 },

  avatarWrap: { alignItems: 'center', marginBottom: 36 },
  avatar:     { width: 88, height: 88, borderRadius: 44, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 10, ...shadow.primary },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  avatarHint: { fontSize: 13, color: C.textMuted },

  title: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: 28, letterSpacing: -0.4 },

  field:        { marginBottom: 18 },
  label:        { fontSize: 12, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  optional:     { fontWeight: '400', textTransform: 'none', letterSpacing: 0, color: C.textMuted },
  input:        { borderWidth: 1.5, borderColor: C.border, borderRadius: 14, backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 15, fontSize: 16, color: C.text, ...shadow.sm },
  inputFocused: { borderColor: C.primary },

  btn:        { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...shadow.primary },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});