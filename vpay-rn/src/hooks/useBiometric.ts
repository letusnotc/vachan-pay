import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore          from 'expo-secure-store';
import AsyncStorage              from '@react-native-async-storage/async-storage';

const PREF_KEY = 'vpay_biometric_enabled';
const pinKey   = (phone: string) => `vpay_pin_${phone.replace(/\D/g, '')}`;

export const useBiometric = () => {

  const isAvailable = async (): Promise<boolean> => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  };

  const isEnabled = async (): Promise<boolean> => {
    const val = await AsyncStorage.getItem(PREF_KEY);
    return val === 'true';
  };

  const setEnabled = async (value: boolean): Promise<void> => {
    await AsyncStorage.setItem(PREF_KEY, value ? 'true' : 'false');
  };

  const authenticate = async (reason: string): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         reason,
        fallbackLabel:         'Use PIN instead',
        cancelLabel:           'Cancel',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  };

  const getType = async (): Promise<'fingerprint' | 'faceid' | 'none'> => {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'faceid';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
    return 'none';
  };

  // Stores PIN securely (keyed by E.164 phone) after a successful sign-in
  const storePin = async (phone: string, pin: string): Promise<void> => {
    await SecureStore.setItemAsync(pinKey(phone), pin);
  };

  // Returns stored PIN for biometric sign-in, or null if not yet stored
  const getStoredPin = async (phone: string): Promise<string | null> => {
    return SecureStore.getItemAsync(pinKey(phone));
  };

  const clearStoredPin = async (phone: string): Promise<void> => {
    await SecureStore.deleteItemAsync(pinKey(phone));
  };

  return { isAvailable, isEnabled, setEnabled, authenticate, getType, storePin, getStoredPin, clearStoredPin };
};
