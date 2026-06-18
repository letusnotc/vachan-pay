import 'react-native-url-polyfill/auto';
import './src/i18n';

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { NavigationContainer }        from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider }           from 'react-native-safe-area-context';

import { supabase }   from './src/lib/supabase';
import { api }        from './src/lib/api';
import { useStore }   from './src/store/store';
import { C }          from './src/theme';

import LoginScreen          from './src/screens/LoginScreen';
import ProfileSetupScreen   from './src/screens/ProfileSetupScreen';
import HomeScreen           from './src/screens/HomeScreen';
import ConfirmPaymentScreen from './src/screens/ConfirmPaymentScreen';
import BalanceScreen        from './src/screens/BalanceScreen';
import HistoryScreen        from './src/screens/HistoryScreen';
import ProfileScreen        from './src/screens/ProfileScreen';

export type RootStackParamList = {
  Login:          undefined;
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

const sp = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', gap: 20 },
  logoCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center' },
  logoV:      { fontSize: 42, fontWeight: '800', color: '#fff' },
  name:       { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 6 },
  tag:        { fontSize: 15, color: 'rgba(255,255,255,0.65)' },
});

export default function App() {
  const { session, profile, setSession, setProfile } = useStore();
  const [hydrated, setHydrated]             = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

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

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    setProfileLoading(true);
    api.get('/profile')
      .then(r => setProfile(r.data.profile))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [session?.user?.id]);

  if (!hydrated || profileLoading) return <SplashScreen />;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'ios_from_right' }}>
          {!session ? (
            <>
              <Stack.Screen name="Login"        component={LoginScreen} />
              <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
            </>
          ) : !profile ? (
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          ) : (
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