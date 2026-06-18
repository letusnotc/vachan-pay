import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation }            from 'react-i18next';
import { api }                       from '../lib/api';
import { RootStackParamList }        from '../../App';
import { C, shadow }                 from '../theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'History'> };

interface Transaction {
  id:         string;
  amount:     number;
  type:       'sent' | 'received';
  status:     string;
  created_at: string;
  sender:     { name?: string; phone_number: string } | null;
  receiver:   { name?: string; phone_number: string } | null;
}

function initials(name?: string | null, phone?: string) {
  if (name) return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (phone ?? '?').slice(-2);
}

function Avatar({ name, phone, sent }: { name?: string | null; phone?: string; sent: boolean }) {
  const bg = sent ? C.errorBg : C.successBg;
  const fg = sent ? C.error   : C.success;
  return (
    <View style={av.wrap}>
      <View style={[av.circle, { backgroundColor: bg }]}>
        <Text style={[av.text, { color: fg }]}>{initials(name, phone)}</Text>
      </View>
      {/* Direction badge */}
      <View style={[av.dirBadge, { backgroundColor: sent ? C.error : C.success }]}>
        <Text style={av.dirBadgeText}>{sent ? '↑' : '↓'}</Text>
      </View>
    </View>
  );
}
const av = StyleSheet.create({
  wrap:        { width: 44, height: 44, marginRight: 14, position: 'relative' },
  circle:      { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  text:        { fontSize: 14, fontWeight: '800' },
  dirBadge:    { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: C.white },
  dirBadgeText:{ fontSize: 9, color: '#fff', fontWeight: '800', lineHeight: 11 },
});

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function TxnRow({ item, index }: { item: Transaction; index: number }) {
  const rowAnim = useRef(new Animated.Value(0)).current;
  const isSent  = item.type === 'sent';
  const party   = isSent ? item.receiver : item.sender;

  useEffect(() => {
    Animated.timing(rowAnim, {
      toValue: 1, duration: 320,
      delay: Math.min(index * 50, 300),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const rowY = rowAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <Animated.View style={[s.row, { opacity: rowAnim, transform: [{ translateY: rowY }] }]}>
      <Avatar name={party?.name} phone={party?.phone_number} sent={isSent} />
      <View style={s.rowInfo}>
        <Text style={s.rowName} numberOfLines={1}>{party?.name || party?.phone_number || '—'}</Text>
        <Text style={s.rowDate}>{isSent ? 'Sent' : 'Received'} · {formatDate(item.created_at)}</Text>
      </View>
      <View style={s.rowRight}>
        <Text style={[s.rowAmount, isSent ? s.amountSent : s.amountReceived]}>
          {isSent ? '−' : '+'}₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
        <Text style={s.upiTag}>UPI</Text>
        <View style={[s.statusPill, item.status === 'completed' ? s.pillGreen : s.pillGray]}>
          <Text style={[s.statusText, item.status === 'completed' ? s.statusGreen : s.statusGray]}>
            {item.status}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function HistoryScreen({ navigation }: Props) {
  const { t }              = useTranslation();
  const [txns, setTxns]    = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    api.get('/payment/history')
      .then(r => setTxns(r.data.transactions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>

        <Animated.View style={[s.header, { opacity: headerAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>{t('history.title')}</Text>
        </Animated.View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        ) : txns.length === 0 ? (
          <View style={s.center}>
            <View style={s.emptyIcon}>
              <Text style={s.emptyIconText}>—</Text>
            </View>
            <Text style={s.emptyTitle}>No transactions yet</Text>
            <Text style={s.emptyBody}>{t('history.empty')}</Text>
          </View>
        ) : (
          <>
            <Text style={s.sectionHeader}>Recent Activity</Text>
            <FlatList
              data={txns}
              keyExtractor={i => i.id}
              renderItem={({ item, index }) => <TxnRow item={item} index={index} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 24 },

  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center', ...shadow.sm },
  backArrow: { fontSize: 18, color: C.text },
  title:     { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  sectionHeader: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, paddingLeft: 4 },

  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon:    { width: 64, height: 64, borderRadius: 16, backgroundColor: C.primaryBg, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyIconText:{ fontSize: 24, color: C.primary, fontWeight: '800' },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: C.text },
  emptyBody:    { fontSize: 14, color: C.textMuted, textAlign: 'center' },

  row:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 18, padding: 14, ...shadow.sm },
  rowInfo:  { flex: 1 },
  rowName:  { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 3 },
  rowDate:  { fontSize: 12, color: C.textMuted },

  rowRight:       { alignItems: 'flex-end', gap: 3 },
  rowAmount:      { fontSize: 16, fontWeight: '700' },
  amountSent:     { color: C.error },
  amountReceived: { color: C.success },
  upiTag:         { fontSize: 9, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  statusPill:  { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  pillGreen:   { backgroundColor: C.successBg },
  pillGray:    { backgroundColor: C.bg },
  statusText:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  statusGreen: { color: C.success },
  statusGray:  { color: C.textMuted },
});
