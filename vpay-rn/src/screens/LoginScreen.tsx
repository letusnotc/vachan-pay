import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Alert, Platform,
  KeyboardAvoidingView, StatusBar, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { C, shadow } from '../theme';

const PIN_LENGTH = 6;
const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];
const phoneToEmail = (e164: string) => `vpay_${e164.replace('+', '')}@vpay.local`;

// ─── Sub-components ──────────────────────────────────────────────────────────

function PhoneStep({
  phone, setPhone, onNext, error,
}: {
  phone: string; setPhone: (v: string) => void; onNext: () => void; error: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={s.cardTitle}>Enter your number</Text>
      <Text style={s.cardSub}>We'll use this as your VPay ID</Text>

      <View style={s.phoneRow}>
        <View style={s.prefix}>
          <Text style={s.prefixFlag}>🇮🇳</Text>
          <Text style={s.prefixCode}>+91</Text>
        </View>
        <TextInput
          style={[s.phoneInput, focused && s.phoneInputFocused]}
          placeholder="9876 543 210"
          placeholderTextColor={C.textMuted}
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={setPhone}
          returnKeyType="done"
          onSubmitEditing={onNext}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus
        />
      </View>

      {!!error && <Text style={s.errorText}>{error}</Text>}

      <TouchableOpacity style={s.primaryBtn} onPress={onNext} activeOpacity={0.88}>
        <Text style={s.primaryBtnText}>Continue</Text>
        <Text style={s.primaryBtnArrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

function PinStep({
  e164, pin, loading, onKey, onBack,
}: {
  e164: string; pin: string; loading: boolean;
  onKey: (k: string) => void; onBack: () => void;
}) {
  return (
    <View>
      <TouchableOpacity onPress={onBack} style={s.backRow} activeOpacity={0.7}>
        <Text style={s.backArrow}>←</Text>
        <Text style={s.backPhone}>{e164}</Text>
      </TouchableOpacity>

      <Text style={s.cardTitle}>Enter your PIN</Text>
      <Text style={s.cardSub}>6 digits — first time? This sets your PIN permanently</Text>

      {/* Dot indicators */}
      <View style={s.dots}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[s.dot, i < pin.length && s.dotFilled]} />
        ))}
      </View>

      {loading ? (
        <View style={s.padLoader}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={s.loadingText}>Signing you in…</Text>
        </View>
      ) : (
        <View style={s.pad}>
          {KEYS.map((k, i) => (
            <TouchableOpacity
              key={i}
              style={[s.key, k === '' && s.keyGhost]}
              onPress={() => k && onKey(k)}
              disabled={!k}
              activeOpacity={0.6}
            >
              <Text style={[s.keyText, k === 'del' && s.keyDel]}>
                {k === 'del' ? '⌫' : k}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LoginScreen() {
  const insets = useSafeAreaInsets();

  const [step,    setStep]    = useState<'phone' | 'pin'>('phone');
  const [phone,   setPhone]   = useState('');
  const [pin,     setPin]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const heroAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const e164 = `+91${phone.replace(/\s/g, '')}`;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(heroAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const crossFade = (cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const goToPin = () => {
    const cleaned = phone.replace(/\s/g, '');
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setError('');
    crossFade(() => { setStep('pin'); setPin(''); });
  };

  const handleKey = (key: string) => {
    if (loading) return;
    if (key === 'del') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) submitPin(next);
  };

  const submitPin = async (currentPin: string) => {
    setLoading(true);
    const email = phoneToEmail(e164);

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPin });
    if (!signInErr) { setLoading(false); return; }

    const { error: signUpErr } = await supabase.auth.signUp({
      email, password: currentPin,
      options: { data: { phone: e164 } },
    });
    if (signUpErr) {
      Alert.alert('Error', signUpErr.message);
      setPin('');
    }
    setLoading(false);
  };

  const heroOpacity  = heroAnim;
  const heroY = heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });
  const cardY = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] });

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* ── Hero ── */}
      <Animated.View style={[s.hero, { opacity: heroOpacity, transform: [{ translateY: heroY }] }]}>
        <View style={s.topRow}><LanguageSwitcher /></View>
        <View style={s.brand}>
          <View style={s.logoCircle}>
            <Text style={s.logoV}>V</Text>
          </View>
          <Text style={s.brandName}>VPay</Text>
          <Text style={s.brandTagline}>Voice-first payments for India</Text>
        </View>
      </Animated.View>

      {/* ── Card ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View
          style={[s.card, { opacity: cardAnim, transform: [{ translateY: cardY }], paddingBottom: insets.bottom + 16 }]}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {step === 'phone' ? (
              <PhoneStep phone={phone} setPhone={setPhone} onNext={goToPin} error={error} />
            ) : (
              <PinStep
                e164={e164} pin={pin} loading={loading} onKey={handleKey}
                onBack={() => crossFade(() => { setStep('phone'); setPin(''); })}
              />
            )}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primary },

  hero:         { flex: 1, paddingHorizontal: 28, paddingBottom: 28, justifyContent: 'flex-end' },
  topRow:       { position: 'absolute', top: 12, right: 24 },
  brand:        { alignItems: 'center' },
  logoCircle:   { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  logoV:        { fontSize: 38, fontWeight: '800', color: '#fff' },
  brandName:    { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -0.6 },
  brandTagline: { fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 6 },

  card:      { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 28, paddingHorizontal: 28 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 4 },
  cardSub:   { fontSize: 14, color: C.textSub, marginBottom: 26, lineHeight: 20 },

  phoneRow:          { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  prefix:            { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 15, borderWidth: 1, borderColor: C.border },
  prefixFlag:        { fontSize: 18 },
  prefixCode:        { fontSize: 15, fontWeight: '700', color: C.text },
  phoneInput:        { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, fontSize: 17, color: C.text, backgroundColor: C.white, letterSpacing: 0.5 },
  phoneInputFocused: { borderColor: C.primary },
  errorText:         { fontSize: 13, color: C.error, marginBottom: 12 },

  primaryBtn:      { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, ...shadow.primary },
  primaryBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  primaryBtnArrow: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: '600' },

  backRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 8 },
  backArrow: { fontSize: 18, color: C.textSub },
  backPhone: { fontSize: 15, fontWeight: '600', color: C.primary },

  dots:     { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 30, marginTop: 4 },
  dot:      { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, backgroundColor: 'transparent' },
  dotFilled:{ backgroundColor: C.primary, borderColor: C.primary },

  padLoader:   { alignItems: 'center', paddingVertical: 36, gap: 14 },
  loadingText: { fontSize: 14, color: C.textSub },

  pad:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, paddingBottom: 8 },
  key:     { width: 82, height: 82, borderRadius: 41, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  keyGhost:{ backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { fontSize: 24, fontWeight: '500', color: C.text },
  keyDel:  { fontSize: 22, color: C.primary },
});