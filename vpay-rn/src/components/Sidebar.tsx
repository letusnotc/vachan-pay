import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, TouchableWithoutFeedback,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';
import { RootStackParamList } from '../../App';
import { C, shadow } from '../theme';

type Props = {
  visible:    boolean;
  onClose:    () => void;
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.76;

type NavItemProps = {
  icon:    React.ComponentProps<typeof Ionicons>['name'];
  label:   string;
  desc:    string;
  onPress: () => void;
};

function NavItem({ icon, label, desc, onPress }: NavItemProps) {
  return (
    <TouchableOpacity style={ni.row} onPress={onPress} activeOpacity={0.72}>
      <View style={ni.iconBadge}>
        <Ionicons name={icon} size={20} color={C.primary} />
      </View>
      <View style={ni.textBlock}>
        <Text style={ni.label}>{label}</Text>
        <Text style={ni.desc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
    </TouchableOpacity>
  );
}

const ni = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  iconBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.primaryBg, justifyContent: 'center', alignItems: 'center' },
  textBlock: { flex: 1 },
  label:     { fontSize: 15, fontWeight: '600', color: C.text },
  desc:      { fontSize: 12, color: C.textSub, marginTop: 2 },
});

export default function Sidebar({ visible, onClose, navigation }: Props) {
  const insets  = useSafeAreaInsets();
  const profile = useStore(s => s.profile);

  // rendered stays true until the close animation fully finishes
  const [rendered, setRendered] = useState(false);

  const slideAnim   = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Step 1: mount the component when visible becomes true
  useEffect(() => {
    if (visible) setRendered(true);
  }, [visible]);

  // Step 2: once rendered (open animation) — fires when rendered flips to true
  useEffect(() => {
    if (!rendered) return;
    slideAnim.setValue(-SIDEBAR_WIDTH);
    overlayAnim.setValue(0);
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0,    duration: 280, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0.45, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [rendered]); // only depends on rendered, NOT visible

  // Step 3: close animation — fires when visible flips to false while mounted
  useEffect(() => {
    if (visible || !rendered) return;
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: -SIDEBAR_WIDTH, duration: 280, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0,              duration: 280, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [visible]); // only depends on visible

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible]);

  if (!rendered) return null;

  const navigate = (screen: keyof RootStackParamList) => {
    onClose();
    setTimeout(() => navigation.navigate(screen as any), 300);
  };

  const signOut = () => {
    onClose();
    setTimeout(() => supabase.auth.signOut(), 320);
  };

  const initials = profile?.name
    ?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  return (
    <View style={s.root}>
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.overlay, { opacity: overlayAnim }]} />
      </TouchableWithoutFeedback>

      {/* Panel */}
      <Animated.View
        style={[
          s.panel,
          {
            transform: [{ translateX: slideAnim }],
            paddingTop:    insets.top + 20,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        {/* Profile header */}
        <View style={s.profileSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName} numberOfLines={1}>{profile?.name ?? ''}</Text>
            <Text style={s.profilePhone}>{profile?.phone_number ?? ''}</Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.72}>
            <Ionicons name="close" size={18} color={C.textSub} />
          </TouchableOpacity>
        </View>

        <View style={s.divider} />

        {/* Navigation items */}
        <View style={s.navSection}>
          <NavItem
            icon="card-outline"
            label="Balance"
            desc="View wallet cash, add money"
            onPress={() => navigate('Balance')}
          />
          <View style={s.hairline} />
          <NavItem
            icon="time-outline"
            label="History"
            desc="Passbook audit, send receipts"
            onPress={() => navigate('History')}
          />
          <View style={s.hairline} />
          <NavItem
            icon="person-outline"
            label="Profile"
            desc="Wallet parameters, security"
            onPress={() => navigate('Profile')}
          />
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={s.signOutBtn} onPress={signOut} activeOpacity={0.75}>
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version footer */}
        <Text style={s.version}>VPay App v2.4.0</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 100 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },

  panel: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: C.white,
    paddingHorizontal: 24,
    ...shadow.lg,
  },

  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar:         { width: 64, height: 64, borderRadius: 16, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', ...shadow.primary },
  avatarText:     { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileInfo:    { flex: 1 },
  profileName:    { fontSize: 17, fontWeight: '700', color: C.text },
  profilePhone:   { fontSize: 13, color: C.textSub, marginTop: 2 },
  closeBtn:       { width: 32, height: 32, borderRadius: 8, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },

  divider:    { height: 1, backgroundColor: C.border, marginVertical: 20 },
  navSection: { flex: 1 },
  hairline:   { height: 1, backgroundColor: C.bg },

  signOutBtn:  { borderWidth: 1.5, borderColor: C.error, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  signOutText: { color: C.error, fontSize: 15, fontWeight: '600' },

  version: { fontSize: 10, color: C.textMuted, textAlign: 'center', marginTop: 12, fontVariant: ['tabular-nums'] },
});
