import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore          from 'expo-secure-store';

const PREF_KEY = 'vpay_biometric_enabled';
const pinKey       = (phone: string) => `vpay_pin_${phone.replace(/\D/g, '')}`;
// Unauthenticated marker — just "has this phone enrolled biometric sign-in",
// not the PIN itself. Lets the UI decide whether to show the biometric
// prompt without triggering a live OS authentication just to render a screen.
const pinExistsKey = (phone: string) => `vpay_pin_exists_${phone.replace(/\D/g, '')}`;

export const useBiometric = () => {

  const isAvailable = async (): Promise<boolean> => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  };

  // M-2: moved from AsyncStorage (plain-text) to SecureStore — readable
  // only via the OS Keychain/Keystore, not from a rooted device's filesystem.
  const isEnabled = async (): Promise<boolean> => {
    const val = await SecureStore.getItemAsync(PREF_KEY);
    return val === 'true';
  };

  const setEnabled = async (value: boolean): Promise<void> => {
    await SecureStore.setItemAsync(PREF_KEY, value ? 'true' : 'false');
  };

  const authenticate = async (reason: string): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         reason,
        fallbackLabel:         'Use PIN instead',
        cancelLabel:           'Cancel',
        disableDeviceFallback: true,
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

  // C-3 (biometric half): requireAuthentication ties decryption of this
  // specific item to a live OS-level biometric/device-credential check —
  // Android's setUserAuthenticationRequired(true) on the underlying Keystore
  // key, iOS's biometryCurrentSet access control on the Keychain item. This
  // means even a rooted/jailbroken device that dumps SecureStore's storage
  // still can't decrypt the PIN without a live fingerprint/face/passcode
  // check at read time — not just app-level control flow, which a rooted
  // device could bypass by calling the storage APIs directly.
  const PIN_AUTH_OPTIONS = {
    requireAuthentication: true,
    authenticationPrompt:  'Authenticate to sign in to VPay',
  } as const;

  // Stores PIN securely (keyed by E.164 phone) after a successful sign-in
  const storePin = async (phone: string, pin: string): Promise<void> => {
    await SecureStore.setItemAsync(pinKey(phone), pin, PIN_AUTH_OPTIONS);
    await SecureStore.setItemAsync(pinExistsKey(phone), 'true'); // no auth gate — just a marker
  };

  // Cheap, unauthenticated check for "is biometric sign-in set up for this
  // phone" — safe to call on screen mount to decide whether to show the
  // biometric UI at all, without prompting the OS authenticator.
  const hasStoredPin = async (phone: string): Promise<boolean> => {
    const val = await SecureStore.getItemAsync(pinExistsKey(phone));
    return val === 'true';
  };

  // Returns the stored PIN for biometric sign-in, or null if not stored /
  // the user cancelled or failed the OS prompt. On both platforms this
  // itself triggers a live biometric/passcode prompt (per requireAuthentication
  // above) — call this once, at the moment of actually signing in, not for
  // existence checks (use hasStoredPin for that), and don't also call
  // authenticate() first or the user sees two prompts back to back.
  const getStoredPin = async (phone: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(pinKey(phone), PIN_AUTH_OPTIONS);
    } catch {
      return null;
    }
  };

  const clearStoredPin = async (phone: string): Promise<void> => {
    await SecureStore.deleteItemAsync(pinKey(phone));
    await SecureStore.deleteItemAsync(pinExistsKey(phone));
  };

  return { isAvailable, isEnabled, setEnabled, authenticate, getType, storePin, hasStoredPin, getStoredPin, clearStoredPin };
};
