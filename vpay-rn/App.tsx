import 'react-native-url-polyfill/auto';
import './src/i18n';

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, AppState } from 'react-native';
import { NavigationContainer }        from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider }           from 'react-native-safe-area-context';

import { supabase }   from './src/lib/supabase';
import { api }        from './src/lib/api';
import { useStore }   from './src/store/store';
import { C }          from './src/theme';

import LockScreen           from './src/components/LockScreen';
import LandingScreen        from './src/screens/LandingScreen';
import SignInScreen         from './src/screens/SignInScreen';
import SignUpScreen         from './src/screens/SignUpScreen';
import OnboardingScreen     from './src/screens/OnboardingScreen';
import ProfileSetupScreen   from './src/screens/ProfileSetupScreen';
import HomeScreen           from './src/screens/HomeScreen';
import ConfirmPaymentScreen from './src/screens/ConfirmPaymentScreen';
import BalanceScreen        from './src/screens/BalanceScreen';
import HistoryScreen        from './src/screens/HistoryScreen';
import ProfileScreen        from './src/screens/ProfileScreen';

export type RootStackParamList = {
  Landing:        undefined;
  SignIn:         undefined;
  SignUp:         undefined;
  Onboarding:     undefined;
  ProfileSetup:   undefined;
  Home:           undefined;
  ConfirmPayment: { receiverName: string; receiverPhone: string; amount: number };
  Balance:        undefined;
  History:        undefined;
  Profile:        undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function SplashScreen() {
  const logoScale   = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoScale,   { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={sp.root}>
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <View style={sp.logoCircle}>
          <Text style={sp.logoV}>V</Text>
        </View>
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
        <Text style={sp.name}>VPay</Text>
        <Text style={sp.tag}>Voice-first payments</Text>
      </Animated.View>
    </View>
  );
}

const bd = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title:   { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  url:     { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 32 },
  btn:     { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 36, paddingVertical: 13, marginBottom: 16 },
  btnText: { color: C.primary, fontSize: 16, fontWeight: '700' },
  signOut: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
});

const sp = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', gap: 20 },
  logoCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center' },
  logoV:      { fontSize: 42, fontWeight: '800', color: '#fff' },
  name:       { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 6 },
  tag:        { fontSize: 15, color: 'rgba(255,255,255,0.65)' },
});

export default function App() {
  const { session, profile, setSession, setProfile } = useStore();
  const [hydrated,       setHydrated]       = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [backendDown,    setBackendDown]    = useState(false);
  const [locked,         setLocked]         = useState(false);

  const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  const lastActiveRef = useRef<number>(Date.now());

  // Lock on background → foreground if idle > 5 min
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const isLoggedIn = !!session && !!profile?.onboarding_completed;
        if (isLoggedIn && Date.now() - lastActiveRef.current > IDLE_TIMEOUT) {
          setLocked(true);
        }
      } else {
        lastActiveRef.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [session, profile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setHydrated(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async () => {
    if (!session) { setProfile(null); return; }
    setProfileLoading(true);
    setBackendDown(false);
    try {
      const r = await api.get('/profile');
      const raw = r.data.profile;
      // Treat null/undefined onboarding_completed as true (pre-migration safety)
      setProfile({ ...raw, onboarding_completed: raw.onboarding_completed ?? true });
    } catch (err: any) {
      if (err.response?.status === 404) {
        setProfile(null);
      } else {
        setBackendDown(true);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, [session?.user?.id]);

  if (!hydrated || profileLoading) return <SplashScreen />;

  if (backendDown && session) {
    return (
      <View style={bd.root}>
        <Text style={bd.title}>Cannot reach backend</Text>
        <Text style={bd.url}>{process.env.EXPO_PUBLIC_API_URL}</Text>
        <TouchableOpacity style={bd.btn} onPress={fetchProfile}>
          <Text style={bd.btnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={bd.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (locked) {
    return (
      <SafeAreaProvider>
        <LockScreen onUnlock={() => {
          setLocked(false);
          lastActiveRef.current = Date.now();
        }} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'ios_from_right' }}>

          {!session ? (
            /* ── Unauthenticated ── */
            <>
              <Stack.Screen name="Landing"  component={LandingScreen} />
              <Stack.Screen name="SignIn"   component={SignInScreen} />
              <Stack.Screen name="SignUp"   component={SignUpScreen} />
            </>

          ) : !profile ? (
            /* ── Authenticated but no profile yet ── */
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />

          ) : !profile.onboarding_completed ? (
            /* ── Profile exists but onboarding not done ── */
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />

          ) : (
            /* ── Fully set up ── */
            <>
              <Stack.Screen name="Home"           component={HomeScreen} />
              <Stack.Screen name="ConfirmPayment" component={ConfirmPaymentScreen} />
              <Stack.Screen name="Balance"        component={BalanceScreen} />
              <Stack.Screen name="History"        component={HistoryScreen} />
              <Stack.Screen name="Profile"        component={ProfileScreen} />
            </>
          )}

        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
