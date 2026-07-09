import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types/database';
import type { Session, AuthError } from '@supabase/supabase-js';

const GUEST_KEY = 'app_guest_mode';

// Normalize Saudi phone numbers to international format
// Accepts: 05XXXXXXXX, +9665XXXXXXXX, 9665XXXXXXXX, 5XXXXXXXX
// Returns: +9665XXXXXXXX
function normalizeSaudiPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');

  // 05XXXXXXXX (10 digits starting with 05)
  if (/^05\d{8}$/.test(digits)) {
    return '+966' + digits.substring(1);
  }
  // 5XXXXXXXX (9 digits starting with 5)
  if (/^5\d{8}$/.test(digits)) {
    return '+966' + digits;
  }
  // +9665XXXXXXXX or 9665XXXXXXXX (12 digits)
  if (/^9665\d{8}$/.test(digits)) {
    return '+' + digits;
  }
  // +966XXXXXXXXX (any 12+ digits starting with 966)
  if (/^966\d{9,}$/.test(digits)) {
    return '+' + digits;
  }

  return null;
}

// Map Supabase auth error codes/messages to user-friendly Arabic messages
const AUTH_ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'Email not confirmed': 'البريد الإلكتروني غير مفعل. تحقق من بريدك',
  'User already registered': 'البريد الإلكتروني مسجل مسبقاً. سجل الدخول',
  'User not found': 'البريد الإلكتروني غير مسجل في النظام',
  'Invalid email': 'صيغة البريد الإلكتروني غير صحيحة',
  'Invalid password': 'كلمة المرور غير صحيحة',
  'Password is too weak': 'كلمة المرور ضعيفة جداً. استخدم 6 أحرف على الأقل',
  'Unable to validate email': 'تعذر التحقق من البريد الإلكتروني',
  'Signups not allowed': 'التسجيل غير مسموح حالياً',
  'Email rate limit exceeded': 'كثرة المحاولات. انتظر قليلاً ثم أعد المحاولة',
  'User is disabled': 'تم تعطيل هذا الحساب. تواصل مع الدعم',
};

// Translate Supabase auth error to Arabic
function translateAuthError(error: AuthError): string {
  const msg = error.message || '';
  const code = error.code || '';

  if (code === 'invalid_credentials' || code === 'invalid_login_credentials') {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  }
  if (code === 'email_not_confirmed') {
    return 'البريد الإلكتروني غير مفعل. تحقق من بريدك';
  }
  if (code === 'user_already_exists') {
    return 'البريد الإلكتروني مسجل مسبقاً. سجل الدخول';
  }
  if (code === 'user_not_found') {
    return 'البريد الإلكتروني غير مسجل في النظام';
  }
  if (code === 'invalid_email') {
    return 'صيغة البريد الإلكتروني غير صحيحة';
  }
  if (code === 'invalid_password') {
    return 'كلمة المرور غير صحيحة';
  }
  if (code === 'weak_password') {
    return 'كلمة المرور ضعيفة جداً. استخدم 6 أحرف على الأقل';
  }

  if (AUTH_ERROR_MAP[msg]) {
    return AUTH_ERROR_MAP[msg];
  }

  for (const [key, ar] of Object.entries(AUTH_ERROR_MAP)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) {
      return ar;
    }
  }

  return msg || 'حدث خطأ أثناء عملية التحقق (code: ' + (code || 'unknown') + ')';
}

interface SignUpExtra {
  country?: string;
  countryCode?: string;
  phoneNumber?: string;
  fullPhoneNumber?: string;
}

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isGuest: boolean;
  signUp: (email: string, password: string, fullName: string, role: UserRole, phone: string, extra?: SignUpExtra) => Promise<{ error: string | null }>;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  enterGuestMode: () => Promise<void>;
  exitGuestMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isGuest: false,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
  enterGuestMode: async () => {},
  exitGuestMode: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        setProfile(null);
        return null;
      }

      setProfile(data);
      return data;
    } catch (e) {
      console.error('[Auth] Profile fetch exception:', e);
      setProfile(null);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id);
  };

  useEffect(() => {
    const init = async () => {
      // Check persisted guest mode
      try {
        const guestVal = Platform.OS === 'web'
          ? localStorage.getItem(GUEST_KEY)
          : await AsyncStorage.getItem(GUEST_KEY);
        if (guestVal === 'true') {
          setIsGuest(true);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('[Auth] Failed to read guest storage:', e);
      }

      // Normal auth check
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      if (s?.user) {
        await fetchProfile(s.user.id);
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        (async () => {
          await fetchProfile(s.user.id);
          setLoading(false);
        })();
      } else if (event !== 'INITIAL_SESSION') {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: UserRole, phone: string, extra?: SignUpExtra) => {
    if ((role as string) === 'admin') return { error: 'غير مسموح بإنشاء حساب مشرف' };

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { error: translateAuthError(error) };
    }

    const user = data.user;

    if (!data.session) {
      return { error: 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتفعيل الحساب' };
    }

    if (user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: fullName,
        role,
        phone,
        country: extra?.country ?? null,
        country_code: extra?.countryCode ?? null,
        phone_number: extra?.phoneNumber ?? null,
        full_phone_number: extra?.fullPhoneNumber ?? phone ?? null,
      });
      if (profileError) {
        return { error: 'فشل إنشاء الملف الشخصي: ' + (profileError.message || 'خطأ غير معروف') };
      }
      await fetchProfile(user.id);
    }
    return { error: null };
  };

  const signIn = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    if (!identifier || !password) {
      return { error: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور' };
    }

    const isEmail = identifier.includes('@');
    const loginEmail = identifier.toLowerCase().trim();
    const trimmedPassword = password.trim();

    if (!isEmail) {
      const normalizedPhone = normalizeSaudiPhone(identifier);
      if (normalizedPhone) {
        return { error: 'تسجيل الدخول بالجوال غير مدعوم حالياً. الرجاء استخدام البريد الإلكتروني' };
      } else {
        return { error: 'الرجاء إدخال بريد إلكتروني صحيح' };
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: trimmedPassword,
      });

      if (error) {
        return { error: translateAuthError(error) };
      }

      const user = data.user;
      if (!user) {
        return { error: 'حدث خطأ غير متوقع. حاول مرة أخرى' };
      }

      // Fetch or create profile
      let p = await fetchProfile(user.id);

      if (!p) {
        const { error: createError } = await supabase.from('profiles').insert({
          id: user.id,
          full_name: user.email?.split('@')[0] || 'مستخدم',
          role: 'advertiser',
          phone: '',
        });
        if (!createError) {
          p = await fetchProfile(user.id);
        }
      }

      if (p) {
        if (p.account_status === 'banned') {
          await supabase.auth.signOut();
          setProfile(null);
          setSession(null);
          return { error: 'تم حظر هذا الحساب. تواصل مع الدعم.' };
        }
        if (p.account_status === 'suspended') {
          await supabase.auth.signOut();
          setProfile(null);
          setSession(null);
          return { error: 'هذا الحساب موقوف مؤقتاً. تواصل مع الدعم.' };
        }
      }

      return { error: null };
    } catch (e: any) {
      console.error('[Auth] Unexpected sign-in error:', e);
      return { error: 'حدث خطأ في الاتصال. تحقق من الشبكة وأعد المحاولة' };
    }
  };

  const enterGuestMode = async () => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(GUEST_KEY, 'true');
      } else {
        await AsyncStorage.setItem(GUEST_KEY, 'true');
      }
    } catch (e) {
      console.warn('[Auth] Failed to persist guest mode:', e);
    }
    setIsGuest(true);
  };

  const exitGuestMode = async () => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(GUEST_KEY);
      } else {
        await AsyncStorage.removeItem(GUEST_KEY);
      }
    } catch (e) {
      console.warn('[Auth] Failed to clear guest mode:', e);
    }
    setIsGuest(false);
  };

  const signOut = async () => {
    await exitGuestMode();
    await supabase.auth.signOut();
    setProfile(null);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ session, profile, loading, isAdmin, isGuest, signUp, signIn, signOut, refreshProfile, enterGuestMode, exitGuestMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
