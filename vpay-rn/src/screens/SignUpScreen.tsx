import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Platform,
  KeyboardAvoidingView, StatusBar, Easing, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../../App';
import { C, shadow } from '../theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'SignUp'> };

type Step = 'phone' | 'newPin' | 'confirmPin';

const PIN_LENGTH = 6;
const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];
const phoneToEmail = (e164: string) => `vpay_${e164.replace('+', '')}@vpay.local`;

const STEP_CONFIG: Record<Step, { title: string; sub: string }> = {
  phone:      { title: 'Your mobile number',   sub: 'This will be your VPay ID' },
  newPin:     { title: 'Create a PIN',          sub: 'Choose a 6-digit PIN for your account' },
  confirmPin: { title: 'Confirm your PIN',      sub: 'Enter the same PIN again' },
};

export default function SignUpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [step,       setStep]       = useState<Step>('phone');
  const [phone,      setPhone]      = useState('');
  const [newPin,     setNewPin]     = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [focused,    setFocused]    = useState(false);

  const cardAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const e164 = `+91${phone.replace(/\s/g, '')}`;

  useEffect(() => {
    Animated.timing(cardAnim, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

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

  const goToNewPin = () => {
    const cleaned = phone.replace(/\s/g, '');
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setError('');
    crossFade(() => { setStep('newPin'); setNewPin(''); });
  };

  const activePin        = step === 'newPin' ? newPin : confirmPin;
  const setActivePin     = step === 'newPin' ? setNewPin : setConfirmPin;
  const activePinLength  = activePin.length;

  const handleKey = (key: string) => {
    if (loading) return;
    if (key === 'del') { setActivePin(p => p.slice(0, -1)); return; }
    if (activePinLength >= PIN_LENGTH) return;
    const next = activePin + key;
    setActivePin(next);
    if (next.length === PIN_LENGTH) {
      if (step === 'newPin') {
        crossFade(() => { setStep('confirmPin'); setConfirmPin(''); setError(''); });
      } else {
        submitSignUp(newPin, next);
      }
    }
  };

  const submitSignUp = async (pin: string, confirm: string) => {
    if (pin !== confirm) {
      setError("PINs don't match — try again");
      shake();
      crossFade(() => { setStep('newPin'); setNewPin(''); setConfirmPin(''); });
      return;
    }

    setLoading(true);
    setError('');
    const email = phoneToEmail(e164);

    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password: pin,
      options: { data: { phone: e164 } },
    });

    if (signUpErr) {
      setLoading(false);
      setConfirmPin('');
      if (signUpErr.message.includes('already registered')) {
        setError('This number already has an account. Sign in instead.');
        crossFade(() => { setStep('phone'); setNewPin(''); setConfirmPin(''); });
      } else {
        Alert.alert('Sign Up Failed', signUpErr.message);
      }
      return;
    }

    setLoading(false);
    // Supabase session update triggers App.tsx to navigate to ProfileSetup
  };

  const goBack = () => {
    if (step === 'newPin')     crossFade(() => { setStep('phone');   setNewPin('');    setError(''); });
    if (step === 'confirmPin') crossFade(() => { setStep('newPin');  setConfirmPin(''); setError(''); });
    if (step === 'phone')      navigation.goBack();
  };

  const cardY = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });

  const dots = step !== 'phone'
    ? (step === 'newPin' ? newPin : confirmPin)
    : null;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* ── Hero ── */}
      <View style={s.hero}>
        <TouchableOpacity onPress={goBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={s.heroContent}>
          <Text style={s.heroTitle}>Create account</Text>
          <Text style={s.heroSub}>Set up your VPay wallet in seconds</Text>
        </View>

        {/* Step indicator */}
        <View style={s.stepIndicator}>
          {(['phone', 'newPin', 'confirmPin'] as Step[]).map((s_, i) => (
            <View
              key={i}
              style={[
                si.dot,
                step === s_ && si.dotActive,
                (['phone','newPin','confirmPin'] as Step[]).indexOf(step) > i && si.dotDone,
              ]}
            />
          ))}
        </View>
      </View>

      {/* ── Card ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Animated.View style={[s.card, { opacity: cardAnim, transform: [{ translateY: cardY }], paddingBottom: insets.bottom + 16 }]}>
          <Animated.View style={{ opacity: fadeAnim }}>

            <Text style={s.cardTitle}>{STEP_CONFIG[step].title}</Text>
            <Text style={s.cardSub}>{STEP_CONFIG[step].sub}</Text>

            {step === 'phone' ? (
              <View>
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
                    onSubmitEditing={goToNewPin}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    autoFocus
                  />
                </View>

                {!!error && <Text style={s.errorText}>{error}</Text>}

                <TouchableOpacity style={s.primaryBtn} onPress={goToNewPin} activeOpacity={0.88}>
                  <Text style={s.primaryBtnText}>Continue</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.linkBtn} onPress={() => navigation.navigate('SignIn')} activeOpacity={0.7}>
                  <Text style={s.linkText}>Already have an account?{' '}
                    <Text style={s.linkEmphasis}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </View>

            ) : (
              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <View style={s.dots}>
                  {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                    <View key={i} style={[s.dot, i < (dots?.length ?? 0) && s.dotFilled]} />
                  ))}
                </View>

                {!!error && <Text style={[s.errorText, s.errorCenter]}>{error}</Text>}

                {loading ? (
                  <View style={s.padLoader}>
                    <ActivityIndicator size="large" color={C.primary} />
                    <Text style={s.loadingText}>Creating your account…</Text>
                  </View>
                ) : (
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

  hero:           { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  backBtn:        { marginBottom: 14, width: 36, height: 36, justifyContent: 'center' },
  backIcon:       { fontSize: 22, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  heroContent:    {},
  heroTitle:      { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroSub:        { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  stepIndicator:  { flexDirection: 'row', gap: 6, marginTop: 16 },

  card:      { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 28, paddingHorizontal: 28, flex: 1 },
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
});

const si = StyleSheet.create({
  dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive:{ backgroundColor: '#fff', width: 20 },
  dotDone:  { backgroundColor: 'rgba(255,255,255,0.6)' },
});
