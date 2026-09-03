import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { env } from './env';

/**
 * SecureStore limite chaque valeur à 2048 octets ; une session Supabase
 * (access + refresh token + user) dépasse souvent cette taille.
 * → on découpe en morceaux `${key}__i`, avec `${key}__n` = nombre de morceaux.
 */
const CHUNK_SIZE = 1800;
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

const secureChunkedStorage: SupportedStorage = {
  async getItem(key) {
    const k = safeKey(key);
    const n = Number(await SecureStore.getItemAsync(`${k}__n`));
    if (!n) return null;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(`${k}__${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key, value) {
    const k = safeKey(key);
    const previous = Number(await SecureStore.getItemAsync(`${k}__n`)) || 0;
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(`${k}__${i}`, chunks[i]!);
    for (let i = chunks.length; i < previous; i++) await SecureStore.deleteItemAsync(`${k}__${i}`);
    await SecureStore.setItemAsync(`${k}__n`, String(chunks.length));
  },
  async removeItem(key) {
    const k = safeKey(key);
    const n = Number(await SecureStore.getItemAsync(`${k}__n`)) || 0;
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}__${i}`);
    await SecureStore.deleteItemAsync(`${k}__n`);
  },
};

const storage: SupportedStorage = Platform.OS === 'web' ? AsyncStorage : secureChunkedStorage;

export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Rafraîchissement du jeton uniquement quand l'app est au premier plan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
