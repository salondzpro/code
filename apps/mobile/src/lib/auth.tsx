import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import type { UserRole } from '@salondz/constants';
import { supabase } from './supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** true tant que la session persistée n'a pas été lue. */
  loading: boolean;
  /** Envoie un code à 6 chiffres par email (crée le compte si besoin). */
  signInWithEmailOtp: (email: string, role?: UserRole) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => mounted && setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      } else {
        void queryClient.invalidateQueries({ queryKey: ['me'] });
        void queryClient.invalidateQueries({ queryKey: ['pro'] });
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const signInWithEmailOtp = useCallback(async (email: string, role?: UserRole) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, data: role ? { role } : undefined },
    });
    if (error) throw new Error(mapAuthError(error.message));
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    });
    if (error) throw new Error(mapAuthError(error.message));
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

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (m.includes('expired')) return 'Code expiré. Demandez un nouveau code.';
  if (m.includes('invalid') || m.includes('token')) return 'Code incorrect. Vérifiez et réessayez.';
  if (m.includes('email')) return 'Adresse email invalide.';
  return message;
}
