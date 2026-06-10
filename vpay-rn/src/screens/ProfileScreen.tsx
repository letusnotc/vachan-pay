import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation }            from 'react-i18next';
import { supabase }                  from '../lib/supabase';
import { useStore }                  from '../store/store';
import LanguageSwitcher              from '../components/LanguageSwitcher';
import { RootStackParamList }        from '../../App';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'> };

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { t }                  = useTranslation();
  const { profile, setSession } = useStore();

  const initials = profile?.name
    ?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '??';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          setSession(null);
        }
      }
    ]);
  };

  const Row = ({ icon, label, value }: { icon: string; label: string; value?: string | null }) => (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || '—'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← {t('common.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('profile.title')}</Text>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.nameText}>{profile?.name}</Text>
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <Row icon="📱" label={t('profile.phone')} value={profile?.phone_number} />
          <View style={styles.divider} />
          <Row icon="✉️"  label="Email"              value={profile?.email} />
          <View style={styles.divider} />
          {/* Language row */}
          <View style={styles.row}>
            <Text style={styles.rowIcon}>🌐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('profile.language')}</Text>
            </View>
            <LanguageSwitcher />
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F8F9FA' },
  container:   { flex: 1, padding: 24 },
  back:        { marginBottom: 20 },
  backText:    { color: '#6C63FF', fontSize: 15, fontWeight: '600' },
  title:       { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 24 },
  avatarWrap:  { alignItems: 'center', marginBottom: 28 },
  avatar:      { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6C63FF',
                 justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText:  { fontSize: 28, fontWeight: '700', color: '#fff' },
  nameText:    { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 8,
                 shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginBottom: 24 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12 },
  rowIcon:     { fontSize: 20, marginRight: 14 },
  rowLabel:    { fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue:    { fontSize: 15, color: '#1A1A1A', fontWeight: '500', marginTop: 2 },
  divider:     { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 12 },
  signOutBtn:  { borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 14,
                 paddingVertical: 14, alignItems: 'center' },
  signOutText: { color: '#EF4444', fontSize: 15, fontWeight: '700' }
});

export default ProfileScreen;
