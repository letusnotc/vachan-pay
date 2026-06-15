import 'react-native-url-polyfill/auto';
import './src/i18n';

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer }         from '@react-navigation/native';
import { createNativeStackNavigator }  from '@react-navigation/native-stack';
import { SafeAreaProvider }            from 'react-native-safe-area-context';

import { supabase }   from './src/lib/supabase';
import { api }        from './src/lib/api';
import { useStore }   from './src/store/store';

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

export default function App() {
  const { session, profile, setSession, setProfile } = useStore();
  const [hydrated, setHydrated]             = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [backendDown, setBackendDown]       = useState(false);

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

  const fetchProfile = async () => {
    if (!session) { setProfile(null); return; }
    setProfileLoading(true);
    setBackendDown(false);
    try {
      const r = await api.get('/profile');
      setProfile(r.data.profile);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setProfile(null); // No profile yet — show setup
      } else {
        // Network error or server error — don't wipe the profile state
        setBackendDown(true);
        console.error('[App] profile fetch failed:', err.message, err.code);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  // Fetch profile whenever session changes
  useEffect(() => { fetchProfile(); }, [session?.user?.id]);

  if (!hydrated || profileLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (backendDown && session) {
    return (
      <View style={styles.splash}>
        <Text style={styles.errText}>Cannot reach backend{'\n'}at {process.env.EXPO_PUBLIC_API_URL}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchProfile}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
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
  splash:      { flex: 1, backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center', padding: 24 },
  errText:     { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  retryBtn:    { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12 },
  retryText:   { color: '#6C63FF', fontSize: 16, fontWeight: '700' },
  signOutText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
});
