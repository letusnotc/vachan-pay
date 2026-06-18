import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { C } from '../theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Landing'> };

export default function LandingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const logoAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const btnAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(140, [
      Animated.timing(logoAnim, { toValue: 1, duration: 650, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }),
      Animated.timing(textAnim, { toValue: 1, duration: 500,  easing: Easing.out(Easing.cubic),     useNativeDriver: true }),
      Animated.timing(btnAnim,  { toValue: 1, duration: 450,  easing: Easing.out(Easing.cubic),     useNativeDriver: true }),
    ]).start();
  }, []);

  const logoScale = logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const textY     = textAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const btnY      = btnAnim.interpolate({  inputRange: [0, 1], outputRange: [28, 0] });

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 28 }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Decorative background circles */}
      <View style={s.dec1} />
      <View style={s.dec2} />
      <View style={s.dec3} />

      {/* Brand */}
      <View style={s.center}>
        <Animated.View style={[s.logoWrap, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}>
          <View style={s.logoOuter}>
            <View style={s.logoInner}>
              <View style={s.logoWhiteBox}>
                <Text style={s.logoV}>V</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[s.textBlock, { opacity: textAnim, transform: [{ translateY: textY }] }]}>
          <Text style={s.appName}>VPay</Text>
          <Text style={s.tagline}>Voice-first payments for India</Text>
        </Animated.View>
      </View>

      {/* Buttons */}
      <Animated.View style={[s.btnArea, { opacity: btnAnim, transform: [{ translateY: btnY }] }]}>
        <TouchableOpacity
          style={s.btnPrimary}
          onPress={() => navigation.navigate('SignIn')}
          activeOpacity={0.88}
        >
          <Text style={s.btnPrimaryText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.btnOutline}
          onPress={() => navigation.navigate('SignUp')}
          activeOpacity={0.88}
        >
          <Text style={s.btnOutlineText}>Create Account</Text>
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          By continuing you agree to VPay's terms of service
        </Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.primary, justifyContent: 'space-between' },

  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 32 },
  logoWrap: { alignItems: 'center' },

  logoOuter: {
    width: 128,
    height: 128,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 128,
    height: 128,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.11)',
    transform: [{ rotate: '12deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWhiteBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-12deg' }],
  },
  logoV: { fontSize: 46, fontWeight: '800', color: C.primary },

  textBlock: { alignItems: 'center', gap: 8 },
  appName:   { fontSize: 48, fontWeight: '800', color: '#fff', letterSpacing: -1.2 },
  tagline:   { fontSize: 15, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22 },

  dec1: { position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: 'rgba(255,255,255,0.04)', top: -100, right: -110 },
  dec2: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.04)', bottom: 100, left: -90 },
  dec3: { position: 'absolute', width: 110, height: 110, borderRadius: 55,  backgroundColor: 'rgba(255,255,255,0.04)', top: 180,   right: 24 },

  btnArea:        { paddingHorizontal: 28, gap: 12 },
  btnPrimary:     { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  btnPrimaryText: { color: C.primary, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  btnOutline:     { borderRadius: 16, paddingVertical: 18, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.36)' },
  btnOutlineText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  disclaimer:     { fontSize: 12, color: 'rgba(255,255,255,0.32)', textAlign: 'center', marginTop: 4 },
});
