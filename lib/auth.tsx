import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types/database';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: UserRole, phone: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
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
  };

  useEffect(() => {
    // Restore persisted session on mount, then let onAuthStateChange take over.
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // IMPORTANT: callback must be synchronous — use an immediately-invoked
    // async block to avoid deadlocking the Supabase auth internals.
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
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };

    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: fullName,
        role,
        phone,
      });
      if (profileError) return { error: profileError.message };
      await fetchProfile(user.id);
    }
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const user = (await supabase.auth.getUser()).data.user;
    if (user) await fetchProfile(user.id);
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
