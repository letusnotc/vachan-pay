import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Platform,
  KeyboardAvoidingView, StatusBar, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons }          from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase }       from '../lib/supabase';
import { useBiometric }   from '../hooks/useBiometric';
import { RootStackParamList } from '../../App';
import { C, shadow }      from '../theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'SignIn'> };

const PIN_LENGTH = 6;
const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];
const phoneToEmail = (e164: string) => `vpay_${e164.replace('+', '')}@vpay.local`;

export default function SignInScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { isAvailable, isEnabled, authenticate, getType, storePin, getStoredPin } = useBiometric();

  const [step,           setStep]           = useState<'phone' | 'pin'>('phone');
  const [phone,          setPhone]          = useState('');
  const [pin,            setPin]            = useState('');
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [focused,        setFocused]        = useState(false);
  const [isSuccess,      setIsSuccess]      = useState(false);
  const [bioReady,       setBioReady]       = useState(false);   // biometric available + PIN stored
  const [bioType,        setBioType]        = useState<'fingerprint' | 'faceid' | 'none'>('none');
  const [showPinPad,     setShowPinPad]     = useState(true);

  const cardAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const e164 = `+91${phone.replace(/\s/g, '')}`;

  useEffect(() => {
    Animated.timing(cardAnim, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  // When entering PIN step, check if biometric sign-in is available for this phone
  useEffect(() => {
    if (step !== 'pin') return;
    (async () => {
      const available = await isAvailable();
      const enabled   = await isEnabled();
      const type      = await getType();
      const stored    = await getStoredPin(e164);
      setBioType(type);
      const ready = available && enabled && !!stored;
      setBioReady(ready);
      if (ready) {
        // Auto-trigger biometric prompt; PIN pad stays as fallback
        setShowPinPad(false);
        tryBiometric(stored!);
      }
    })();
  }, [step]);

  const tryBiometric = async (storedPin?: string) => {
    const pin = storedPin ?? await getStoredPin(e164);
    if (!pin) { setShowPinPad(true); return; }
    const success = await authenticate('Sign in to VPay');
    if (success) {
      submitPin(pin);
    } else {
      setShowPinPad(true);
    }
  };

  const crossFade = (cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
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
    setError('');
    const email = phoneToEmail(e164);

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPin });
    if (!signInErr) {
      // Store PIN for future biometric sign-in if biometric is enabled
      const available = await isAvailable();
      const enabled   = await isEnabled();
      if (available && enabled) {
        await storePin(e164, currentPin);
      }
      setLoading(false);
      setIsSuccess(true);
      return;
    }

    setLoading(false);
    setPin('');
    setShowPinPad(true);
    setError('Incorrect PIN or account not found');
    shake();
  };

  const cardY = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* ── Hero ── */}
      <View style={s.hero}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={s.heroContent}>
          <Text style={s.heroTitle}>Welcome back</Text>
          <Text style={s.heroSub}>Sign in to your VPay account</Text>
        </View>
      </View>

      {/* ── Card ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Animated.View style={[s.card, { opacity: cardAnim, transform: [{ translateY: cardY }], paddingBottom: insets.bottom + 16 }]}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {step === 'phone' ? (
              <View>
                <Text style={s.stepLabel}>Step 1 of 2 — Identity</Text>
                <Text style={s.cardTitle}>Mobile number</Text>
                <Text style={s.cardSub}>Enter the number linked to your account</Text>

                <View style={s.phoneRow}>
                  <View style={s.prefix}>
                    <Text style={s.prefixCode}>+91</Text>
                  </View>
                  <TextInput
                    style={[s.phoneInput, focused && s.phoneInputFocused]}
                    placeholder="9876 543 210"
                    placeholderTextColor={C.textMuted}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={t => { setPhone(t); setError(''); }}
                    returnKeyType="done"
                    onSubmitEditing={goToPin}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    autoFocus
                  />
                </View>

                {!!error && <Text style={s.errorText}>{error}</Text>}

                <TouchableOpacity style={s.primaryBtn} onPress={goToPin} activeOpacity={0.88}>
                  <Text style={s.primaryBtnText}>Continue</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.linkBtn} onPress={() => navigation.navigate('SignUp')} activeOpacity={0.7}>
                  <Text style={s.linkText}>New to VPay?{' '}
                    <Text style={s.linkEmphasis}>Create account</Text>
                  </Text>
                </TouchableOpacity>
              </View>

            ) : (
              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <TouchableOpacity
                  onPress={() => crossFade(() => { setStep('phone'); setPin(''); setError(''); setBioReady(false); setShowPinPad(true); })}
                  style={s.backChip}
                  activeOpacity={0.7}
                >
                  <Text style={s.backChipText}>← Change: +91 {phone}</Text>
                </TouchableOpacity>

                <Text style={s.stepLabel}>Step 2 of 2 — Secure code</Text>
                <Text style={s.cardTitle}>
                  {showPinPad ? 'Enter your PIN' : 'Biometric sign-in'}
                </Text>
                <Text style={s.cardSub}>
                  {showPinPad ? 'Your 6-digit security PIN' : 'Use your fingerprint or face to sign in'}
                </Text>

                {!!error && <Text style={[s.errorText, s.errorCenter]}>{error}</Text>}

                {isSuccess ? (
                  <View style={s.successState}>
                    <View style={s.successCircle}>
                      <Text style={s.successCheck}>&#10003;</Text>
                    </View>
                    <Text style={s.successText}>Authentication verified!</Text>
                  </View>
                ) : loading ? (
                  <View style={s.padLoader}>
                    <ActivityIndicator size="large" color={C.primary} />
                    <Text style={s.loadingText}>Signing you in…</Text>
                  </View>
                ) : showPinPad ? (
                  <>
                    <View style={s.dots}>
                      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                        <View key={i} style={[s.dot, i < pin.length && s.dotFilled]} />
                      ))}
                    </View>
                    <View style={s.pad}>
                      {KEYS.map((k, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[s.key, k === '' && s.keyGhost]}
                          onPress={() => k && handleKey(k)}
                          disabled={!k}
                          activeOpacity={0.6}
                        >
                          <Text style={[s.keyText, k === 'del' && s.keyDel]}>
                            {k === 'del' ? '⌫' : k}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {bioReady && (
                      <TouchableOpacity
                        style={s.switchAuthBtn}
                        onPress={() => { setShowPinPad(false); tryBiometric(); }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={bioType === 'faceid' ? 'scan-outline' : 'finger-print-outline'}
                          size={18}
                          color={C.primary}
                        />
                        <Text style={s.switchAuthText}>
                          Use {bioType === 'faceid' ? 'Face ID' : 'Biometrics'} instead
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  // Biometric screen
                  <View style={s.bioSection}>
                    <TouchableOpacity
                      style={s.bioCircle}
                      onPress={() => tryBiometric()}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={bioType === 'faceid' ? 'scan-outline' : 'finger-print-outline'}
                        size={52}
                        color={C.primary}
                      />
                    </TouchableOpacity>
                    <Text style={s.bioLabel}>
                      Tap to use {bioType === 'faceid' ? 'Face ID' : 'Biometrics'}
                    </Text>
                    <TouchableOpacity
                      style={s.switchAuthBtn}
                      onPress={() => setShowPinPad(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.switchAuthText}>Use PIN instead</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Animated.View>
            )}

          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primary },

  hero:        { paddingHorizontal: 24, paddingBottom: 28, paddingTop: 12 },
  backBtn:     { marginBottom: 16, width: 36, height: 36, justifyContent: 'center' },
  backIcon:    { fontSize: 22, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  heroContent: {},
  heroTitle:   { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroSub:     { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  card:      { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 28, paddingHorizontal: 28, flex: 1 },
  stepLabel: { fontSize: 11, color: C.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 4 },
  cardSub:   { fontSize: 14, color: C.textSub, marginBottom: 24, lineHeight: 20 },

  phoneRow:          { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  prefix:            { backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 15, borderWidth: 1, borderColor: C.border },
  prefixCode:        { fontSize: 15, fontWeight: '700', color: C.text },
  phoneInput:        { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, fontSize: 17, color: C.text, backgroundColor: C.white, letterSpacing: 0.5 },
  phoneInputFocused: { borderColor: C.primary },

  errorText:   { fontSize: 13, color: C.error, marginBottom: 12 },
  errorCenter: { textAlign: 'center', marginBottom: 10 },

  primaryBtn:     { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 4, ...shadow.primary },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  linkBtn:     { paddingVertical: 14, alignItems: 'center' },
  linkText:    { fontSize: 14, color: C.textSub },
  linkEmphasis:{ color: C.primary, fontWeight: '600' },

  backChip:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primaryBg, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, alignSelf: 'flex-start', marginBottom: 20 },
  backChipText: { fontSize: 12, color: C.primary, fontWeight: '700' },

  dots:     { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 28, marginTop: 4 },
  dot:      { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, backgroundColor: 'transparent' },
  dotFilled:{ backgroundColor: C.primary, borderColor: C.primary },

  padLoader:   { alignItems: 'center', paddingVertical: 36, gap: 14 },
  loadingText: { fontSize: 14, color: C.textSub },

  pad:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, paddingBottom: 8 },
  key:     { width: 82, height: 82, borderRadius: 41, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  keyGhost:{ backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { fontSize: 24, fontWeight: '500', color: C.text },
  keyDel:  { fontSize: 22, color: C.primary },

  successState:  { alignItems: 'center', paddingVertical: 40, gap: 16 },
  successCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.success, justifyContent: 'center', alignItems: 'center', ...shadow.success },
  successCheck:  { fontSize: 28, color: '#fff', fontWeight: '800' },
  successText:   { fontSize: 15, color: C.success, fontWeight: '700' },

  bioSection:    { alignItems: 'center', paddingVertical: 32, gap: 16 },
  bioCircle:     { width: 100, height: 100, borderRadius: 50, backgroundColor: C.primaryBg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.primaryLight, ...shadow.md },
  bioLabel:      { fontSize: 15, color: C.textSub, fontWeight: '600' },

  switchAuthBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 16 },
  switchAuthText: { fontSize: 14, color: C.primary, fontWeight: '600' },
});
