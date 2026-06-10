import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation }            from 'react-i18next';
import { api }                       from '../lib/api';
import { RootStackParamList }        from '../../App';

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

const HistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { t }    = useTranslation();
  const [txns,   setTxns]    = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payment/history')
      .then(r => setTxns(r.data.transactions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

  const renderItem = ({ item }: { item: Transaction }) => {
    const isSent   = item.type === 'sent';
    const counterparty = isSent ? item.receiver : item.sender;
    const name = counterparty?.name || counterparty?.phone_number || '—';

    return (
      <View style={styles.row}>
        <View style={[styles.dot, isSent ? styles.dotRed : styles.dotGreen]} />
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>{name}</Text>
          <Text style={styles.rowDate}>{formatDate(item.created_at)}</Text>
        </View>
        <Text style={[styles.rowAmount, isSent ? styles.amountRed : styles.amountGreen]}>
          {isSent ? '−' : '+'}₹{Number(item.amount).toFixed(2)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← {t('common.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('history.title')}</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#6C63FF" style={{ marginTop: 40 }} />
        ) : txns.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>{t('history.empty')}</Text>
          </View>
        ) : (
          <FlatList
            data={txns}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F8F9FA' },
  container:    { flex: 1, padding: 24 },
  back:         { marginBottom: 20 },
  backText:     { color: '#6C63FF', fontSize: 15, fontWeight: '600' },
  title:        { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 20 },
  row:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
                  borderRadius: 14, padding: 14, marginBottom: 10,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  dot:          { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  dotRed:       { backgroundColor: '#EF4444' },
  dotGreen:     { backgroundColor: '#10B981' },
  rowInfo:      { flex: 1 },
  rowName:      { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  rowDate:      { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  rowAmount:    { fontSize: 16, fontWeight: '700' },
  amountRed:    { color: '#EF4444' },
  amountGreen:  { color: '#10B981' },
  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon:    { fontSize: 52, marginBottom: 12 },
  emptyText:    { fontSize: 16, color: '#9CA3AF' }
});

export default HistoryScreen;
