import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
}

// expo-secure-store caps individual values at 2048 bytes (a Keychain/Keystore
// limit, not ours). A Supabase session blob (access + refresh token + user
// metadata) can exceed that. This adapter transparently splits large values
// across multiple SecureStore entries — each chunk still passes through the
// OS secure enclave, so the JWT is encrypted at rest either way, but we never
// hit the size ceiling.
const CHUNK_SIZE = 1800; // safety margin under the 2048-byte limit
const chunkKey  = (key: string, i: number) => `${key}_chunk_${i}`;
const countKey  = (key: string) => `${key}_chunk_count`;

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const countStr = await SecureStore.getItemAsync(countKey(key));
    if (!countStr) {
      // Not chunked — either a small value stored directly, or nothing yet
      return SecureStore.getItemAsync(key);
    }
    const count = parseInt(countStr, 10);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(chunkKey(key, i));
      if (chunk === null) return null; // corrupted/missing chunk — treat as no session
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStoreAdapter.removeItem(key); // clear any prior chunked layout first

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(chunkKey(key, i), c)));
  },

  removeItem: async (key: string): Promise<void> => {
    const countStr = await SecureStore.getItemAsync(countKey(key));
    if (countStr) {
      const count = parseInt(countStr, 10);
      await Promise.all(
        Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i)))
      );
      await SecureStore.deleteItemAsync(countKey(key));
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:            SecureStoreAdapter,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false
  }
});
