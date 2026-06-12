import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types/database';
import type { Session, AuthError } from '@supabase/supabase-js';

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
  console.log('[Auth] Supabase error:', error.code, msg);

  // Check exact match first
  if (AUTH_ERROR_MAP[msg]) return AUTH_ERROR_MAP[msg];

  // Partial match fallback
  for (const [key, arMsg] of Object.entries(AUTH_ERROR_MAP)) {
    if (msg.includes(key)) return arMsg;
  }

  // Generic fallback
  return msg || 'حدث خطأ أثناء عملية التحقق';
}

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, fullName: string, role: UserRole, phone: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data);
    return data;
  };

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        (async () => {
          await fetchProfile(s.user.id);
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: UserRole, phone: string) => {
    // Prevent registering as admin via signup
    if ((role as string) === 'admin') return { error: 'غير مسموح بإنشاء حساب مشرف' };

    console.log('[Auth] signUp attempt:', email, 'role:', role);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.log('[Auth] signUp error:', error.code, error.message);
      return { error: translateAuthError(error) };
    }

    // New user created
    const user = data.user;
    console.log('[Auth] signUp success, user:', user?.id, 'session:', !!data.session);

    // If session is null, email confirmation may be required
    if (!data.session) {
      return { error: 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتفعيل الحساب' };
    }

    if (user) {
      console.log('[Auth] creating profile for user:', user.id);
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: fullName,
        role,
        phone,
      });
      if (profileError) {
        console.error('[Auth] profile insert error:', profileError.code, profileError.message);
        return { error: 'فشل إنشاء الملف الشخصي: ' + (profileError.message || 'خطأ غير معروف') };
      }
      await fetchProfile(user.id);
    }
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    console.log('[Auth] signIn attempt:', email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.log('[Auth] signIn error:', error.code, error.message);
      return { error: translateAuthError(error) };
    }

    console.log('[Auth] signIn success, user:', data.user?.id);
    const user = data.user;
    if (user) {
      const p = await fetchProfile(user.id);
      console.log('[Auth] profile fetched:', p?.id, 'status:', p?.account_status);
      // Block banned accounts from logging in
      if (p?.account_status === 'banned') {
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
        return { error: 'تم حظر هذا الحساب. تواصل مع الدعم.' };
      }
      if (p?.account_status === 'suspended') {
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
        return { error: 'هذا الحساب موقوف مؤقتاً. تواصل مع الدعم.' };
      }
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ session, profile, loading, isAdmin, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
