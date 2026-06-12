import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types/database';
import type { Session, AuthError } from '@supabase/supabase-js';

// Normalize Saudi phone numbers to international format
// Accepts: 05XXXXXXXX, +9665XXXXXXXX, 9665XXXXXXXX, 5XXXXXXXX
// Returns: +9665XXXXXXXX
function normalizeSaudiPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  console.log('[Auth] Phone normalization: input="' + input + '" digits="' + digits + '"');

  // 05XXXXXXXX (10 digits starting with 05)
  if (/^05\d{8}$/.test(digits)) {
    return '+966' + digits.substring(1); // +9665XXXXXXXX
  }
  // 5XXXXXXXX (9 digits starting with 5)
  if (/^5\d{8}$/.test(digits)) {
    return '+966' + digits;
  }
  // +9665XXXXXXXX (12 digits)
  if (/^9665\d{8}$/.test(digits)) {
    return '+' + digits;
  }
  // 9665XXXXXXXX (11 digits)
  if (/^9665\d{8}$/.test(digits)) {
    return '+' + digits;
  }
  // +966XXXXXXXXX (any 12+ digits starting with 966)
  if (/^966\d{9,}$/.test(digits)) {
    return '+' + digits;
  }

  return null; // Not a valid Saudi phone format
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
  console.log('[Auth] Supabase auth error - code:', code, 'message:', msg);

  // Check by error code first (more reliable)
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

  // Check exact message match
  if (AUTH_ERROR_MAP[msg]) return AUTH_ERROR_MAP[msg];

  // Partial match fallback
  for (const [key, arMsg] of Object.entries(AUTH_ERROR_MAP)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return arMsg;
  }

  // Return code + message for debugging if no match
  console.warn('[Auth] Unmapped error, returning original message');
  return msg || 'حدث خطأ أثناء عملية التحقق (' + (code || 'unknown') + ')';
}

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, fullName: string, role: UserRole, phone: string) => Promise<{ error: string | null }>;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
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
    console.log('[Auth] Fetching profile for user:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Auth] Profile fetch error:', error.code, error.message);
        setProfile(null);
        return null;
      }

      console.log('[Auth] Profile fetched:', data ? 'found' : 'not found');
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

  const signIn = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    console.log('[Auth] ====== SIGNIN ATTEMPT ======');
    console.log('[Auth] Identifier:', identifier);
    console.log('[Auth] Has @ symbol:', identifier.includes('@'));
    console.log('[Auth] Password length:', password.length);

    // Validate inputs
    if (!identifier || !password) {
      console.log('[Auth] Missing identifier or password');
      return { error: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور' };
    }

    // Determine if identifier is email or phone
    const isEmail = identifier.includes('@');
    let loginEmail = identifier.toLowerCase().trim();
    password = password.trim();

    if (!isEmail) {
      // Try to normalize as phone number
      const normalizedPhone = normalizeSaudiPhone(identifier);
      console.log('[Auth] Phone normalization result:', normalizedPhone);

      if (normalizedPhone) {
        // Phone login not supported - guide user to use email
        console.log('[Auth] Phone login attempted but not supported');
        return { error: 'تسجيل الدخول بالجوال غير مدعوم حالياً. الرجاء استخدام البريد الإلكتروني' };
      } else {
        // Not a valid phone format - could be malformed email
        console.log('[Auth] Invalid phone format and no @ symbol, treating as potential invalid email');
        return { error: 'الرجاء إدخال بريد إلكتروني صحيح' };
      }
    }

    // Attempt login with email
    console.log('[Auth] Calling Supabase signInWithPassword with email:', loginEmail);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password
      });

      console.log('[Auth] Supabase response received');
      console.log('[Auth] Has error:', !!error);
      console.log('[Auth] Has data:', !!data);
      console.log('[Auth] Has session:', !!data?.session);
      console.log('[Auth] Has user:', !!data?.user);

      if (error) {
        console.log('[Auth] signIn error code:', error.code);
        console.log('[Auth] signIn error message:', error.message);
        console.log('[Auth] signIn error status:', error.status);
        return { error: translateAuthError(error) };
      }

      const user = data.user;
      if (!user) {
        console.error('[Auth] No user in response but no error either!');
        return { error: 'حدث خطأ غير متوقع. حاول مرة أخرى' };
      }

      console.log('[Auth] ====== LOGIN SUCCESS ======');
      console.log('[Auth] User ID:', user.id);
      console.log('[Auth] User email:', user.email);
      console.log('[Auth] Session created:', !!data.session);

      // Fetch or create profile
      let p = await fetchProfile(user.id);
      console.log('[Auth] Profile exists:', !!p);

      if (!p) {
        console.log('[Auth] Profile missing, creating default profile');
        const { error: createError } = await supabase.from('profiles').insert({
          id: user.id,
          full_name: user.email?.split('@')[0] || 'مستخدم',
          role: 'advertiser',
          phone: '',
        });
        if (!createError) {
          p = await fetchProfile(user.id);
          console.log('[Auth] Default profile created');
        } else {
          console.error('[Auth] Profile creation failed:', createError.message);
          // Don't block login for profile creation failure
        }
      }

      if (p) {
        console.log('[Auth] Profile status:', p.account_status);
        if (p.account_status === 'banned') {
          console.log('[Auth] Account is banned, signing out');
          await supabase.auth.signOut();
          setProfile(null);
          setSession(null);
          return { error: 'تم حظر هذا الحساب. تواصل مع الدعم.' };
        }
        if (p.account_status === 'suspended') {
          console.log('[Auth] Account is suspended, signing out');
          await supabase.auth.signOut();
          setProfile(null);
          setSession(null);
          return { error: 'هذا الحساب موقوف مؤقتاً. تواصل مع الدعم.' };
        }
      }

      console.log('[Auth] ====== SIGNIN COMPLETE ======');
      return { error: null };
    } catch (e: any) {
      console.error('[Auth] Unexpected error during signIn:', e);
      return { error: 'حدث خطأ في الاتصال. تحقق من الشبكة وأعد المحاولة' };
    }
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
