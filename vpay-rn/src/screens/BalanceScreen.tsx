import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Animated, Easing,
} from 'react-native';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation }            from 'react-i18next';
import { api }                       from '../lib/api';
import { RootStackParamList }        from '../../App';
import { C, shadow }                 from '../theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Balance'> };

export default function BalanceScreen({ navigation }: Props) {
  const { t }                     = useTranslation();
  const [balance, setBalance]     = useState<number | null>(null);
  const [loading, setLoading]     = useState(true);

  const cardAnim   = useRef(new Animated.Value(0)).current;
  const amountAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    api.get('/profile/balance')
      .then(r => {
        setBalance(Number(r.data.balance));
        Animated.stagger(100, [
          Animated.spring(cardAnim,   { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
          Animated.timing(amountAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
      })
      .catch(() => Alert.alert(t('common.error'), 'Failed to fetch balance'))
      .finally(() => setLoading(false));
  }, []);

  const cardScale = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const amountY   = amountAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>{t('balance.title')}</Text>
        </View>

        {/* Balance card */}
        <Animated.View style={[s.card, { opacity: cardAnim, transform: [{ scale: cardScale }] }]}>
          <View style={s.cardDec1} />
          <View style={s.cardDec2} />

          <Text style={s.cardLabel}>{t('balance.available')}</Text>

          {loading ? (
            <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" style={{ marginTop: 16, marginBottom: 8 }} />
          ) : (
            <Animated.View style={{ opacity: amountAnim, transform: [{ translateY: amountY }] }}>
              <Text style={s.amount}>
                ₹{balance?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
              </Text>
            </Animated.View>
          )}

          <View style={s.cardFooter}>
            <View style={s.badge}>
              <View style={s.badgeDot} />
              <Text style={s.badgeText}>VPay Wallet</Text>
            </View>
          </View>
        </Animated.View>

        {/* Info rows */}
        {!loading && balance !== null && (
          <Animated.View style={[s.infoCard, { opacity: amountAnim }]}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Account type</Text>
              <Text style={s.infoValue}>Prepaid Wallet</Text>
            </View>
            <View style={s.divider} />
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Status</Text>
              <View style={s.statusBadge}>
                <View style={s.statusDot} />
                <Text style={s.statusText}>Active</Text>
              </View>
            </View>
          </Animated.View>
        )}

        <TouchableOpacity
          style={s.addBtn}
          onPress={() => Alert.alert('Coming soon', 'Add money feature coming soon!')}
          activeOpacity={0.88}
        >
          <Text style={s.addBtnText}>{t('balance.addMoney')}</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 24 },

  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  backBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center', ...shadow.sm },
  backArrow: { fontSize: 18, color: C.text },
  title:     { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  card:       { backgroundColor: C.primary, borderRadius: 28, padding: 28, marginBottom: 16, overflow: 'hidden', ...shadow.primary },
  cardDec1:   { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -70, right: -50 },
  cardDec2:   { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: 20 },
  cardLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '500', marginBottom: 8 },
  amount:     { fontSize: 52, fontWeight: '800', color: '#fff', letterSpacing: -1.5, marginBottom: 20 },
  cardFooter: { flexDirection: 'row' },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  badgeDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  badgeText:  { fontSize: 12, color: '#fff', fontWeight: '600' },

  infoCard:   { backgroundColor: C.white, borderRadius: 18, padding: 6, marginBottom: 16, ...shadow.sm },
  infoRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  infoLabel:  { fontSize: 14, color: C.textSub },
  infoValue:  { fontSize: 14, fontWeight: '600', color: C.text },
  divider:    { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  statusBadge:{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.successBg, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  statusText: { fontSize: 13, fontWeight: '600', color: C.success },

  addBtn:     { backgroundColor: C.white, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: C.primary, ...shadow.sm },
  addBtnText: { color: C.primary, fontSize: 15, fontWeight: '700' },
});