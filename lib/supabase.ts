import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Debug: Log Supabase configuration
console.log('[Supabase] ====== CLIENT INITIALIZATION ======');
console.log('[Supabase] URL:', supabaseUrl || 'MISSING');
console.log('[Supabase] Anon Key:', supabaseAnonKey ? `SET (${supabaseAnonKey.substring(0, 20)}...)` : 'MISSING');
console.log('[Supabase] Platform:', Platform.OS);
console.log('[Supabase] ===================================');

// On web, AsyncStorage falls back to in-memory storage and loses the session
// on refresh. Use localStorage directly so the session survives page reloads.
const storage = Platform.OS === 'web'
  ? {
      getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
      removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
    }
  : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

console.log('[Supabase] Client created successfully');
