import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons }          from '@expo/vector-icons';
import { supabase }          from '../lib/supabase';
import { useStore }          from '../store/store';
import { useBiometric }      from '../hooks/useBiometric';
import { C, shadow }         from '../theme';

const PIN_LENGTH = 6;
const KEYS       = ['1','2','3','4','5','6','7','8','9','','0','del'];

interface Props {
  onUnlock: () => void;
}

export default function LockScreen({ onUnlock }: Props) {
  const insets  = useSafeAreaInsets();
  const { profile } = useStore();
  const { isAvailable, isEnabled, authenticate, getType } = useBiometric();

  const [pin,         setPin]         = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [showPin,     setShowPin]     = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'faceid' | 'none'>('none');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    init();
  }, []);

  const init = async () => {
    const type      = await getType();
    setBiometricType(type);
    const available = await isAvailable();
    const enabled   = await isEnabled();
    if (available && enabled) {
      tryBiometric();
    } else {
      setShowPin(true);
    }
  };

  const tryBiometric = async () => {
    const success = await authenticate('Unlock VPay');
    if (success) {
      onUnlock();
    } else {
      setShowPin(true);
    }
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const handleKey = (key: string) => {
    if (loading) return;
    if (key === 'del') { setPin(p => p.slice(0, -1)); setError(''); return; }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) verifyPin(next);
  };

  const verifyPin = async (currentPin: string) => {
    if (!profile?.phone_number) return;
    setLoading(true);
    setError('');
    const email = `vpay_${profile.phone_number.replace('+', '')}@vpay.local`;
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: currentPin });
    setLoading(false);
    if (!err) {
      onUnlock();
    } else {
      setPin('');
      setError('Incorrect PIN. Try again.');
      shake();
    }
  };

  const biometricIcon = biometricType === 'faceid' ? 'scan-outline' : 'finger-print-outline';
  const biometricLabel = biometricType === 'faceid' ? 'Face ID' : 'Fingerprint';

  const firstName = profile?.name?.split(' ')[0] ?? 'there';

  return (
    <Animated.View style={[s.root, { opacity: fadeAnim, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Top section */}
      <View style={s.top}>
        <View style={s.logoBox}>
          <Text style={s.logoV}>V</Text>
        </View>
        <Text style={s.title}>VPay is locked</Text>
        <Text style={s.sub}>Welcome back, {firstName}</Text>
      </View>

      {/* PIN or biometric prompt */}
      {!showPin ? (
        <View style={s.biometricSection}>
          <TouchableOpacity style={s.biometricBtn} onPress={tryBiometric} activeOpacity={0.8}>
            <Ionicons name={biometricIcon as any} size={52} color="#fff" />
          </TouchableOpacity>
          <Text style={s.biometricLabel}>Tap to use {biometricLabel}</Text>
          <TouchableOpacity onPress={() => setShowPin(true)} style={s.usePinBtn} activeOpacity={0.7}>
            <Text style={s.usePinText}>Use PIN instead</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={[s.pinSection, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={s.pinLabel}>Enter your PIN</Text>

          {/* Dots */}
          <View style={s.dots}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View key={i} style={[s.dot, i < pin.length && s.dotFilled]} />
            ))}
          </View>

          {!!error && <Text style={s.errorText}>{error}</Text>}

          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator color="#fff" size="large" />
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

          {/* Show biometric again if available */}
          {biometricType !== 'none' && (
            <TouchableOpacity onPress={tryBiometric} style={s.switchBioBtn} activeOpacity={0.7}>
              <Ionicons name={biometricIcon as any} size={20} color="rgba(255,255,255,0.7)" />
              <Text style={s.switchBioText}>Use {biometricLabel}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 40 },

  top:     { alignItems: 'center', gap: 12, marginTop: 20 },
  logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  logoV:   { fontSize: 36, fontWeight: '800', color: '#fff' },
  title:   { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  sub:     { fontSize: 15, color: 'rgba(255,255,255,0.65)' },

  biometricSection: { alignItems: 'center', gap: 16 },
  biometricBtn:     { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', ...shadow.primary },
  biometricLabel:   { fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  usePinBtn:        { marginTop: 8, paddingVertical: 10, paddingHorizontal: 20 },
  usePinText:       { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },

  pinSection: { width: '100%', alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  pinLabel:   { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 8 },

  dots:     { flexDirection: 'row', gap: 16, marginBottom: 12 },
  dot:      { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'transparent' },
  dotFilled:{ backgroundColor: '#fff', borderColor: '#fff' },

  errorText: { fontSize: 13, color: '#FFB3B3', marginBottom: 8 },

  loadingWrap: { paddingVertical: 36 },

  pad:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  key:     { width: 78, height: 78, borderRadius: 39, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  keyGhost:{ backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { fontSize: 24, fontWeight: '500', color: '#fff' },
  keyDel:  { fontSize: 22, color: 'rgba(255,255,255,0.8)' },

  switchBioBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, padding: 10 },
  switchBioText:{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
});
