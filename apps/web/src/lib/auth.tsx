import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@salondz/api-client';
import type { UserRole } from '@salondz/constants';
import { supabase } from './supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Envoie un code OTP par email (crée le compte si besoin, avec le rôle en métadonnée). */
  signInWithEmailOtp: (email: string, role?: UserRole) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        qc.invalidateQueries({ queryKey: queryKeys.me });
        if (event === 'SIGNED_OUT') qc.clear();
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const signInWithEmailOtp = useCallback(async (email: string, role?: UserRole) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: role ? { role } : undefined },
    });
    if (error) throw error;
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading, signInWithEmailOtp, verifyEmailOtp, signOut }),
    [session, loading, signInWithEmailOtp, verifyEmailOtp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() doit être utilisé sous <AuthProvider>');
  return ctx;
}
