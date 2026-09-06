import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@salondz/api-client';
import type { UserRole } from '@salondz/constants';
import { supabase } from './supabase';

/** Canal d'envoi du code (design AUTH 06). L'e-mail n'est proposé que si le fournisseur SMS n'est pas configuré. */
export type OtpChannel = 'whatsapp' | 'sms' | 'email';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** true tant que la session persistée n'a pas été lue. */
  loading: boolean;
  /** Envoie un code à 6 chiffres sur WhatsApp ou par SMS (crée le compte si besoin, avec le rôle en métadonnée). */
  sendPhoneOtp: (phoneE164: string, channel: 'whatsapp' | 'sms', role?: UserRole) => Promise<void>;
  verifyPhoneOtp: (phoneE164: string, token: string) => Promise<void>;
  /** Secours e-mail (projet sans fournisseur SMS) : même parcours, code reçu par e-mail. */
  sendEmailOtp: (email: string, role?: UserRole) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void qc.invalidateQueries({ queryKey: queryKeys.me });
        void qc.invalidateQueries({ queryKey: queryKeys.pro.all });
        if (event === 'SIGNED_OUT') qc.clear();
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  const sendPhoneOtp = useCallback(async (phone: string, channel: 'whatsapp' | 'sms', role?: UserRole) => {
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel, shouldCreateUser: true, data: role ? { role } : undefined } });
    if (error) throw new Error(mapAuthError(error.message));
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token: token.trim(), type: 'sms' });
    if (error) throw new Error(mapAuthError(error.message));
  }, []);

  const sendEmailOtp = useCallback(async (email: string, role?: UserRole) => {
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, data: role ? { role } : undefined } });
    if (error) throw new Error(mapAuthError(error.message));
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: 'email' });
    if (error) throw new Error(mapAuthError(error.message));
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading, sendPhoneOtp, verifyPhoneOtp, sendEmailOtp, verifyEmailOtp, signOut }),
    [session, loading, sendPhoneOtp, verifyPhoneOtp, sendEmailOtp, verifyEmailOtp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() doit être utilisé sous <AuthProvider>');
  return ctx;
}

/** Messages Supabase → français ; les mots-clés « expired » / « network » sont conservés pour les écrans de code. */
function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (m.includes('expired')) return 'Code expiré (expired). Demandez un nouveau code.';
  if (m.includes('network') || m.includes('fetch')) return 'Connexion perdue (network). Réessayez.';
  if (m.includes('invalid') || m.includes('token')) return 'Code incorrect. Vérifiez et réessayez.';
  return message;
}
