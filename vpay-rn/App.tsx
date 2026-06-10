import 'react-native-url-polyfill/auto';
import './src/i18n';

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer }         from '@react-navigation/native';
import { createNativeStackNavigator }  from '@react-navigation/native-stack';
import { SafeAreaProvider }            from 'react-native-safe-area-context';

import { supabase }   from './src/lib/supabase';
import { api }        from './src/lib/api';
import { useStore }   from './src/store/store';

import LoginScreen          from './src/screens/LoginScreen';
import OtpScreen            from './src/screens/OtpScreen';
import ProfileSetupScreen   from './src/screens/ProfileSetupScreen';
import HomeScreen           from './src/screens/HomeScreen';
import ConfirmPaymentScreen from './src/screens/ConfirmPaymentScreen';
import BalanceScreen        from './src/screens/BalanceScreen';
import HistoryScreen        from './src/screens/HistoryScreen';
import ProfileScreen        from './src/screens/ProfileScreen';

export type RootStackParamList = {
  Login:          undefined;
  Otp:            { phone: string };
  ProfileSetup:   undefined;
  Home:           undefined;
  ConfirmPayment: { receiverName: string; receiverPhone: string; amount: number };
  Balance:        undefined;
  History:        undefined;
  Profile:        undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { session, profile, setSession, setProfile } = useStore();
  const [hydrated, setHydrated]         = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Restore session on first load
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

  // Fetch profile whenever session changes
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    setProfileLoading(true);
    api.get('/profile')
      .then(r => setProfile(r.data.profile))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [session?.user?.id]);

  if (!hydrated || profileLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!session ? (
            <>
              <Stack.Screen name="Login"        component={LoginScreen} />
              <Stack.Screen name="Otp"          component={OtpScreen} />
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

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center' }
});
