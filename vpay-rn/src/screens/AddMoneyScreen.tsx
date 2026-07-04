import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Easing, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }               from 'react-native-safe-area-context';
import { NativeStackNavigationProp }  from '@react-navigation/native-stack';
import { useTranslation }             from 'react-i18next';
import { useStripe }                  from '@stripe/stripe-react-native';
import { api }                        from '../lib/api';
import { useStore }                   from '../store/store';
import { RootStackParamList }         from '../../App';
import { C, shadow }                  from '../theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'AddMoney'> };

const PRESETS = [100, 200, 500, 1000, 2000, 5000];
type Step = 'input' | 'processing' | 'success' | 'error';

// ── Success animation ──────────────────────────────────────────────────────
function SuccessView({ amount, newBalance, onDone }: {
  amount: number; newBalance: number; onDone: () => void;
}) {
  const { t } = useTranslation();
  const circleAnim = useRef(new Animated.Value(0)).current;
  const textAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(circleAnim, { toValue: 1, tension: 85, friction: 7, useNativeDriver: true }),
      Animated.timing(textAnim,   { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={sv.root}>
      <Animated.View style={[sv.circle, { transform: [{ scale: circleAnim }] }]}>
        <Text style={sv.check}>✓</Text>
      </Animated.View>
      <Animated.View style={[sv.textBlock, { opacity: textAnim }]}>
        <Text style={sv.title}>{t('addMoney.successTitle')}</Text>
        <Text style={sv.amount}>
          +₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
        <Text style={sv.balance}>
          {t('addMoney.newBalance', { amount: newBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) })}
        </Text>
        <Text style={sv.hint}>{t('addMoney.returningHint')}</Text>
      </Animated.View>
    </View>
  );
}

const sv = StyleSheet.create({
  root:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.white, gap: 24 },
  circle:    { width: 100, height: 100, borderRadius: 50, backgroundColor: C.success, justifyContent: 'center', alignItems: 'center' },
  check:     { fontSize: 44, color: '#fff', fontWeight: '800' },
  textBlock: { alignItems: 'center', gap: 6 },
  title:     { fontSize: 24, fontWeight: '800', color: C.text },
  amount:    { fontSize: 42, fontWeight: '800', color: C.success, letterSpacing: -1.5 },
  balance:   { fontSize: 15, color: C.textSub, marginTop: 4 },
  hint:      { fontSize: 13, color: C.textMuted, marginTop: 20 },
});

// ── Main screen ────────────────────────────────────────────────────────────
export default function AddMoneyScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { setProfile, profile } = useStore();

  const [amount,     setAmount]     = useState('');
  const [step,       setStep]       = useState<Step>('input');
  const [newBalance, setNewBalance] = useState<number>(0);
  const [errorMsg,   setErrorMsg]   = useState('');

  const mountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(mountAnim, {
      toValue: 1, duration: 420,
      easing:  Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const parsed  = parseFloat(amount);
  const isValid = !isNaN(parsed) && parsed >= 50 && parsed <= 100_000;

  const handleAddMoney = useCallback(async () => {
    if (!isValid) {
      Alert.alert(t('addMoney.invalidTitle'), t('addMoney.invalidBody'));
      return;
    }

    setStep('processing');
    setErrorMsg('');

    try {
      // 1 ── Ask backend to create a PaymentIntent
      // idempotencyKey = amount + timestamp — prevents duplicate PaymentIntents on network retry
      const idempotencyKey = `${parsed}-${Date.now()}`;
      const { data } = await api.post('/stripe/create-payment-intent', { amount: parsed, idempotencyKey });
      const { clientSecret, paymentIntentId } = data;

      // 2 ── Initialise the Stripe Payment Sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret:   clientSecret,
        merchantDisplayName:         'VPay Wallet',
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: { name: profile?.name ?? undefined },
        appearance: {
          colors: { primary: C.primary, background: C.bg },
        },
      });

      if (initError) throw new Error(initError.message);

      // 3 ── Present the Stripe Payment Sheet to the user
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        // User tapped "Close" / cancelled — silently go back to input
        if (
          presentError.code === 'Canceled' ||
          (presentError.message ?? '').toLowerCase().includes('cancel')
        ) {
          setStep('input');
          return;
        }
        throw new Error(presentError.message);
      }

      // 4 ── Payment succeeded on device — confirm with backend
      //      Backend re-validates with Stripe before crediting the wallet
      const { data: confirmData } = await api.post('/stripe/confirm-topup', { paymentIntentId });

      const nb = confirmData.newBalance ?? (profile?.wallet_balance ?? 0) + parsed;
      setNewBalance(nb);

      // Update Zustand so HomeScreen / BalanceScreen show the new balance instantly
      if (profile) {
        setProfile({ ...profile, wallet_balance: nb });
      }

      setStep('success');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        t('addMoney.genericError');
      setErrorMsg(msg);
      setStep('error');
    }
  }, [isValid, parsed, initPaymentSheet, presentPaymentSheet, profile, setProfile, t]);

  // ── Success state ──────────────────────────────────────────────
  if (step === 'success') {
    return (
      <SuccessView
        amount={parsed}
        newBalance={newBalance}
        onDone={() => navigation.goBack()}
      />
    );
  }

  const mountY = mountAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <Animated.View style={[s.header, { opacity: mountAnim }]}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={s.backBtn}
              activeOpacity={0.7}
            >
              <Text style={s.backArrow}>←</Text>
            </TouchableOpacity>
            <Text style={s.title}>{t('addMoney.title')}</Text>
          </Animated.View>

          <Animated.View style={{ opacity: mountAnim, transform: [{ translateY: mountY }] }}>

            {/* ── Current balance card ── */}
            <View style={s.balanceCard}>
              <View style={s.balanceDec} />
              <Text style={s.balanceLabel}>{t('addMoney.currentBalance')}</Text>
              <Text style={s.balanceAmount}>
                ₹{(profile?.wallet_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {/* ── Amount input ── */}
            <View style={s.inputCard}>
              <Text style={s.fieldLabel}>{t('addMoney.enterAmount')}</Text>
              <View style={s.amountRow}>
                <Text style={s.rupeeSymbol}>₹</Text>
                <TextInput
                  style={s.amountInput}
                  value={amount}
                  onChangeText={(txt) => {
                    // Only allow digits and one decimal point
                    const clean = txt.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                    setAmount(clean);
                    if (step === 'error') setStep('input');
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={C.textMuted}
                  selectTextOnFocus
                  editable={step !== 'processing'}
                />
              </View>
              <Text style={s.limitNote}>{t('addMoney.limitNote')}</Text>
            </View>

            {/* ── Quick-pick presets ── */}
            <View style={s.presetsWrap}>
              <Text style={s.presetsLabel}>{t('addMoney.quickAmounts')}</Text>
              <View style={s.presets}>
                {PRESETS.map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[s.presetBtn, amount === String(v) && s.presetBtnActive]}
                    onPress={() => { setAmount(String(v)); if (step === 'error') setStep('input'); }}
                    activeOpacity={0.75}
                    disabled={step === 'processing'}
                  >
                    <Text style={[s.presetText, amount === String(v) && s.presetTextActive]}>
                      ₹{v >= 1000 ? `${v / 1000}K` : v}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Error banner ── */}
            {step === 'error' && !!errorMsg && (
              <View style={s.errorBanner}>
                <Text style={s.errorText}>⚠  {errorMsg}</Text>
                <TouchableOpacity onPress={() => setStep('input')} style={s.errorRetry}>
                  <Text style={s.errorRetryText}>{t('addMoney.tryAgain')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Stripe security badge ── */}
            <View style={s.stripeBadge}>
              <Text style={s.stripeBadgeText}>{t('addMoney.securedByStripe')}</Text>
            </View>

            {/* ── CTA button ── */}
            <TouchableOpacity
              style={[s.addBtn, (!isValid || step === 'processing') && s.addBtnDisabled]}
              onPress={handleAddMoney}
              disabled={!isValid || step === 'processing'}
              activeOpacity={0.88}
            >
              {step === 'processing' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.addBtnText}>
                  {isValid
                    ? t('addMoney.addButtonAmount', { amount: parsed.toLocaleString('en-IN', { minimumFractionDigits: 2 }) })
                    : t('addMoney.addButton')}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={s.disclaimer}>{t('addMoney.disclaimer')}</Text>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  container: { padding: 24, paddingBottom: 48 },

  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  backBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center', ...shadow.sm },
  backArrow: { fontSize: 18, color: C.text },
  title:     { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  balanceCard:   { backgroundColor: C.primary, borderRadius: 24, padding: 24, marginBottom: 20, overflow: 'hidden', ...shadow.primary },
  balanceDec:    { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)', top: -50, right: -40 },
  balanceLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  balanceAmount: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1.2 },

  inputCard:   { backgroundColor: C.white, borderRadius: 20, padding: 20, marginBottom: 16, ...shadow.md },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1, marginBottom: 12 },
  amountRow:   { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: C.primary, paddingBottom: 8 },
  rupeeSymbol: { fontSize: 32, fontWeight: '700', color: C.primary, marginRight: 4 },
  amountInput: { flex: 1, fontSize: 40, fontWeight: '800', color: C.text, letterSpacing: -1 },
  limitNote:   { fontSize: 12, color: C.textMuted, marginTop: 10 },

  presetsWrap:      { marginBottom: 16 },
  presetsLabel:     { fontSize: 13, fontWeight: '600', color: C.textSub, marginBottom: 10 },
  presets:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetBtn:        { borderWidth: 1.5, borderColor: C.border, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.white },
  presetBtnActive:  { borderColor: C.primary, backgroundColor: C.primaryBg },
  presetText:       { fontSize: 14, fontWeight: '600', color: C.textSub },
  presetTextActive: { color: C.primary },

  errorBanner:     { backgroundColor: C.errorBg, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.error, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText:       { color: C.error, fontSize: 13, fontWeight: '600', flex: 1 },
  errorRetry:      { marginLeft: 10 },
  errorRetryText:  { color: C.primary, fontSize: 13, fontWeight: '700' },

  stripeBadge:     { alignItems: 'center', marginBottom: 16 },
  stripeBadgeText: { fontSize: 12, color: C.textMuted, fontWeight: '500' },

  addBtn:         { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 17, alignItems: 'center', ...shadow.primary, marginBottom: 16 },
  addBtnDisabled: { opacity: 0.45 },
  addBtnText:     { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  disclaimer: { fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 16 },
});
