import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Easing, ActivityIndicator,
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
import { C, shadow }      from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ConfirmPayment'>;
  route:      RouteProp<RootStackParamList, 'ConfirmPayment'>;
};

function RecipientAvatar({ name }: { name: string }) {
  const initials = name.trim()
    ? name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  return (
    <View style={av.wrap}>
      <View style={av.circle}>
        <Text style={av.text}>{initials}</Text>
      </View>
      <Text style={av.name}>{name || 'New recipient'}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  wrap:   { alignItems: 'center', marginBottom: 28 },
  circle: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.primaryBg, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: '#C9C4FF' },
  text:   { fontSize: 26, fontWeight: '800', color: C.primary },
  name:   { fontSize: 17, fontWeight: '700', color: C.text },
});

function SuccessState({ amount, name }: { amount: string; name: string }) {
  const circleScale = useRef(new Animated.Value(0.4)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity  = useRef(new Animated.Value(0)).current;
  const textY        = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(circleScale, { toValue: 1, tension: 90, friction: 7, useNativeDriver: true }),
      Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(textY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={sc.root}>
      <Animated.View style={[sc.circle, { transform: [{ scale: circleScale }] }]}>
        <Animated.Text style={[sc.check, { opacity: checkOpacity }]}>✓</Animated.Text>
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textY }], alignItems: 'center' }}>
        <Text style={sc.title}>Payment sent!</Text>
        <Text style={sc.amount}>
          ₹{parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
        <Text style={sc.sub}>to {name}</Text>
        <Text style={sc.hint}>Returning to home…</Text>
      </Animated.View>
    </View>
  );
}
const sc = StyleSheet.create({
  root:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.white, gap: 20 },
  circle: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.successBg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#6EE7B7' },
  check:  { fontSize: 44, color: C.success, fontWeight: '800' },
  title:  { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  amount: { fontSize: 38, fontWeight: '800', color: C.success, letterSpacing: -1, marginTop: 4 },
  sub:    { fontSize: 16, color: C.textSub, marginTop: 2 },
  hint:   { fontSize: 13, color: C.textMuted, marginTop: 24 },
});

export default function ConfirmPaymentScreen({ navigation, route }: Props) {
  const { t }        = useTranslation();
  const { language } = useStore();

  const receiverName  = route.params?.receiverName  ?? '';
  const [receiverPhone, setReceiverPhone] = useState(route.params?.receiverPhone ?? '');
  const [amount,        setAmount]        = useState(route.params?.amount ? String(route.params.amount) : '');
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [focused,  setFocused]  = useState<string | null>(null);

  const mountAnim = useRef(new Animated.Value(0)).current;

  const isVoicePrefilled = !!(route.params?.receiverPhone);

  useEffect(() => {
    Animated.timing(mountAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (isVoicePrefilled && receiverName && amount) {
      Speech.speak(
        t('voice.confirmPayment', { name: receiverName, amount }),
        { language: language === 'hi' ? 'hi-IN' : 'en-US', rate: 0.9 }
      );
    }
    return () => { Speech.stop(); };
  }, []);

  const handleConfirm = async () => {
    const phone  = normalizePhone(receiverPhone);
    const parsed = parseFloat(amount);
    if (!phone) { Alert.alert(t('common.error'), 'Enter recipient phone'); return; }
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) { Alert.alert(t('common.error'), 'Invalid phone — use 10-digit Indian number'); return; }
    if (isNaN(parsed) || parsed <= 0) { Alert.alert(t('common.error'), 'Enter a valid amount'); return; }

    setLoading(true);
    try {
      await api.post('/payment/transfer', { receiverPhone: phone, amount: parsed });
      setSuccess(true);
      Speech.speak(
        t('payment.success', { amount: parsed.toFixed(2), name: receiverName || phone }),
        { language: language === 'hi' ? 'hi-IN' : 'en-US' }
      );
      setTimeout(() => navigation.navigate('Home'), 2800);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.error || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return <SuccessState amount={amount} name={receiverName || receiverPhone} />;
  }

  const formattedAmount = amount && !isNaN(parseFloat(amount))
    ? `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : null;

  const mountY = mountAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <Animated.View style={[s.header, { opacity: mountAnim }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
              <Text style={s.backArrow}>←</Text>
            </TouchableOpacity>
            <Text style={s.title}>{t('payment.title')}</Text>
          </Animated.View>

          <Animated.View style={{ opacity: mountAnim, transform: [{ translateY: mountY }] }}>

            {/* Recipient */}
            <RecipientAvatar name={receiverName} />

            {/* Amount display (voice prefilled) */}
            {isVoicePrefilled && formattedAmount ? (
              <View style={s.amountCard}>
                <Text style={s.amountLabel}>{t('payment.amount')}</Text>
                <Text style={s.amountLarge}>{formattedAmount}</Text>
              </View>
            ) : null}

            {/* Manual input card */}
            {!isVoicePrefilled && (
              <View style={s.inputCard}>
                <Text style={s.fieldLabel}>{t('payment.to')}</Text>
                <TextInput
                  style={[s.input, focused === 'phone' && s.inputFocused]}
                  placeholder={t('payment.receiverPhone')}
                  placeholderTextColor={C.textMuted}
                  value={receiverPhone}
                  onChangeText={setReceiverPhone}
                  keyboardType="phone-pad"
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                />
                <Text style={[s.fieldLabel, { marginTop: 16 }]}>{t('payment.amount')}</Text>
                <TextInput
                  style={[s.input, focused === 'amount' && s.inputFocused]}
                  placeholder={t('payment.amountLabel')}
                  placeholderTextColor={C.textMuted}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  onFocus={() => setFocused('amount')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            )}

            {/* Buttons */}
            <View style={s.btnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                <Text style={s.cancelText}>{t('payment.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmBtn, loading && s.btnDisabled]}
                onPress={handleConfirm}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.confirmText}>{t('payment.confirm')}</Text>
                }
              </TouchableOpacity>
            </View>

          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  container: { padding: 24, paddingBottom: 40 },

  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 },
  backBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center', ...shadow.sm },
  backArrow: { fontSize: 18, color: C.text },
  title:     { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  amountCard:  { backgroundColor: C.white, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24, ...shadow.md },
  amountLabel: { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  amountLarge: { fontSize: 48, fontWeight: '800', color: C.text, letterSpacing: -1.5 },

  inputCard:   { backgroundColor: C.white, borderRadius: 20, padding: 20, marginBottom: 24, ...shadow.md },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  input:       { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, backgroundColor: C.bg, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.text },
  inputFocused:{ borderColor: C.primary },

  btnRow:      { flexDirection: 'row', gap: 12 },
  cancelBtn:   { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: C.white },
  cancelText:  { color: C.textSub, fontSize: 15, fontWeight: '600' },
  confirmBtn:  { flex: 2, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', ...shadow.primary },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  btnDisabled: { opacity: 0.6 },
});