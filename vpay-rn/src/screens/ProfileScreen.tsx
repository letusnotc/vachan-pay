import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Animated, Easing, Switch,
} from 'react-native';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation }            from 'react-i18next';
import { supabase }                  from '../lib/supabase';
import { useStore }                  from '../store/store';
import { useBiometric }              from '../hooks/useBiometric';
import LanguageSwitcher              from '../components/LanguageSwitcher';
import { RootStackParamList }        from '../../App';
import { C, shadow }                 from '../theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'> };

function InfoRow({
  label, value, children,
}: {
  label: string; value?: string | null; children?: React.ReactNode;
}) {
  return (
    <View style={row.wrap}>
      <View style={row.labelGroup}>
        <View style={row.dot} />
        <Text style={row.label}>{label}</Text>
      </View>
      <View style={row.right}>
        {children ?? <Text style={row.value}>{value || '—'}</Text>}
      </View>
    </View>
  );
}
const row = StyleSheet.create({
  wrap:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  labelGroup: { flexDirection: 'row', alignItems: 'center' },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primaryBg, marginRight: 8 },
  label:      { fontSize: 14, color: C.textSub },
  right:      { flexDirection: 'row', alignItems: 'center' },
  value:      { fontSize: 15, fontWeight: '600', color: C.text },
});

export default function ProfileScreen({ navigation }: Props) {
  const { t }                  = useTranslation();
  const { profile, setSession } = useStore();
  const { isAvailable, isEnabled, setEnabled, authenticate, getType } = useBiometric();

  const [biometricOn,        setBiometricOn]        = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType,      setBiometricType]      = useState<'fingerprint' | 'faceid' | 'none'>('none');

  useEffect(() => {
    (async () => {
      const available = await isAvailable();
      const enabled   = await isEnabled();
      const type      = await getType();
      setBiometricAvailable(available);
      setBiometricOn(enabled);
      setBiometricType(type);
    })();
  }, []);

  const mountAnim  = useRef(new Animated.Value(0)).current;
  const avatarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(avatarAnim, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }),
      Animated.timing(mountAnim,  { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const initials = profile?.name
    ?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  const avatarScale = avatarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const success = await authenticate('Confirm to enable biometric login');
      if (!success) return;
    }
    await setEnabled(value);
    setBiometricOn(value);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          setSession(null);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>{t('profile.title')}</Text>
        </View>

        {/* Avatar section */}
        <Animated.View style={[s.avatarSection, { opacity: avatarAnim, transform: [{ scale: avatarScale }] }]}>
          <View style={s.avatarRing}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={s.profileName}>{profile?.name}</Text>
          <View style={s.verifiedBadge}>
            <Text style={s.verifiedText}>✓  VPay Member</Text>
          </View>
        </Animated.View>

        {/* Info card */}
        <Animated.View style={[s.card, { opacity: mountAnim }]}>
          <InfoRow label={t('profile.phone')} value={profile?.phone_number} />
          <View style={s.divider} />
          <InfoRow label="Email" value={profile?.email} />
          <View style={s.divider} />
          <InfoRow label={t('profile.language')}>
            <LanguageSwitcher />
          </InfoRow>
          {biometricAvailable && (
            <>
              <View style={s.divider} />
              <InfoRow label="Biometrics">
                <Switch
                  value={biometricOn}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: C.border, true: C.primaryLight }}
                  thumbColor={biometricOn ? C.primary : '#fff'}
                />
              </InfoRow>
            </>
          )}
        </Animated.View>

        {/* Sign out */}
        <Animated.View style={{ opacity: mountAnim }}>
          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
            <Text style={s.signOutText}>Sign Out Wallet Account</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 24 },

  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 },
  backBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center', ...shadow.sm },
  backArrow: { fontSize: 18, color: C.text },
  title:     { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarRing:    { width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: C.primaryBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatar:        { width: 90, height: 90, borderRadius: 45, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', ...shadow.primary },
  avatarText:    { fontSize: 34, fontWeight: '800', color: '#fff' },
  profileName:   { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 8, letterSpacing: -0.3 },
  verifiedBadge: { backgroundColor: C.successBg, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 5 },
  verifiedText:  { fontSize: 13, fontWeight: '700', color: C.success },

  card:    { backgroundColor: C.white, borderRadius: 20, paddingVertical: 4, marginBottom: 20, ...shadow.md },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 20 },

  signOutBtn:  { borderWidth: 1.5, borderColor: C.error, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: C.white },
  signOutText: { color: C.error, fontSize: 15, fontWeight: '700' },
});
