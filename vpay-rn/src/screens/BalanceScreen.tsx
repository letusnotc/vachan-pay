import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation }            from 'react-i18next';
import { api }                       from '../lib/api';
import { RootStackParamList }        from '../../App';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Balance'> };

const BalanceScreen: React.FC<Props> = ({ navigation }) => {
  const { t }          = useTranslation();
  const [balance, setBalance]   = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get('/profile/balance')
      .then(r => setBalance(Number(r.data.balance)))
      .catch(() => Alert.alert(t('common.error'), 'Failed to fetch balance'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← {t('common.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('balance.title')}</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('balance.available')}</Text>
          {loading
            ? <ActivityIndicator size="large" color="#6C63FF" style={{ marginTop: 12 }} />
            : <Text style={styles.amount}>₹{balance?.toFixed(2) ?? '—'}</Text>
          }
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => Alert.alert('Coming soon', 'Add money feature coming soon!')}>
          <Text style={styles.addBtnText}>{t('balance.addMoney')}</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#F8F9FA' },
  container:  { flex: 1, padding: 24 },
  back:       { marginBottom: 20 },
  backText:   { color: '#6C63FF', fontSize: 15, fontWeight: '600' },
  title:      { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 24 },
  card:       { backgroundColor: '#6C63FF', borderRadius: 24, padding: 32, alignItems: 'center',
                shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.4, shadowRadius: 16, elevation: 10, marginBottom: 28 },
  cardLabel:  { fontSize: 14, color: '#D4D0FF', marginBottom: 8 },
  amount:     { fontSize: 48, fontWeight: '800', color: '#fff' },
  addBtn:     { borderWidth: 2, borderColor: '#6C63FF', borderRadius: 14,
                paddingVertical: 14, alignItems: 'center' },
  addBtnText: { color: '#6C63FF', fontSize: 15, fontWeight: '700' }
});

export default BalanceScreen;
