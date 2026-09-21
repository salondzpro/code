/**
 * Session et connexion, par E-MAIL — comme le site : mot de passe pour le quotidien, lien de
 * connexion par e-mail en secours, réinitialisation du mot de passe. L'adresse est vérifiée à
 * l'inscription par le lien de confirmation. Le numéro de téléphone n'est plus un moyen de
 * connexion : c'est une donnée du profil, obligatoire et contrôlée dans sa forme seulement
 * (aucun SMS, aucun WhatsApp — les rappels passent par les notifications de l'application).
 *
 * Les e-mails (confirmation, lien, réinitialisation) sont envoyés par NOTRE API, jamais par le SMTP
 * de Supabase. Les liens s'ouvrent dans le navigateur du téléphone (salondz.com), qui confirme le
 * compte ; on revient ensuite dans l'application se connecter avec son mot de passe.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, queryKeys } from '@salondz/api-client';
import type { UserRole } from '@salondz/constants';
import { api } from './api';
import { unregisterPush } from './push';
import { supabase } from './supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** true tant que la session persistée n'a pas été lue. */
  loading: boolean;
  /** Connexion par e-mail et mot de passe. */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Inscription : le compte est créé (rôle en métadonnée) et le lien de confirmation part par e-mail. */
  signUpWithPassword: (email: string, password: string, role: UserRole, next: string) => Promise<void>;
  /** Lien de connexion par e-mail (sans mot de passe). */
  sendMagicLink: (email: string, next: string) => Promise<void>;
  /** Renvoie le lien de confirmation d'inscription. */
  resendConfirmation: (email: string, next: string) => Promise<void>;
  /** E-mail de réinitialisation du mot de passe. */
  sendPasswordReset: (email: string) => Promise<void>;
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

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string, role: UserRole, next: string) => {
    // Compte créé par l'API, qui envoie elle-même le lien de confirmation. Jamais de session
    // tout de suite : il faut d'abord confirmer l'adresse.
    await api.auth.signup({ email: email.trim().toLowerCase(), password, role, next });
  }, []);

  const sendMagicLink = useCallback(async (email: string, next: string) => {
    await api.auth.magicLink({ email: email.trim().toLowerCase(), next });
  }, []);

  const resendConfirmation = useCallback(async (email: string, next: string) => {
    await api.auth.resendConfirmation({ email: email.trim().toLowerCase(), next });
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await api.auth.passwordReset({ email: email.trim().toLowerCase(), next: '/' });
  }, []);

  const signOut = useCallback(async () => {
    // Ce téléphone cesse de recevoir les notifications de ce compte AVANT que la session ne se ferme.
    // Un échec (hors ligne, jeton refusé) ne doit jamais empêcher de se déconnecter.
    await unregisterPush(api).catch(() => undefined);
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading, signInWithPassword, signUpWithPassword, sendMagicLink, resendConfirmation, sendPasswordReset, signOut }),
    [session, loading, signInWithPassword, signUpWithPassword, sendMagicLink, resendConfirmation, sendPasswordReset, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() doit être utilisé sous <AuthProvider>');
  return ctx;
}

export type AuthErrorKind =
  | 'no_account'
  | 'unconfirmed'
  | 'credentials'
  | 'exists'
  | 'rate'
  | 'expired'
  | 'password'
  | 'email'
  | 'network'
  | 'other';

const API_KINDS: Record<string, AuthErrorKind> = {
  NO_ACCOUNT: 'no_account',
  EMAIL_EXISTS: 'exists',
  ALREADY_CONFIRMED: 'exists',
  EMAIL_INVALID: 'email',
  EMAIL_QUOTA: 'rate',
  RATE_LIMITED: 'rate',
};

/**
 * Toute erreur d'authentification est traduite ici, en français, à partir du CODE renvoyé par
 * Supabase quand il existe et sinon du message (même table que le site, `apps/web/src/lib/auth.tsx`).
 * Jamais de texte anglais brut à l'écran : le dernier recours est un message générique. `kind` sert
 * à proposer la suite (créer un compte, renvoyer le lien, réinitialiser le mot de passe).
 */
export function describeAuthError(err: unknown): { kind: AuthErrorKind; text: string } {
  // Erreurs de NOTRE API : déjà en français, avec un code métier.
  if (err instanceof ApiError) {
    if (err.isNetwork) return { kind: 'network', text: 'Connexion perdue. Vérifiez votre réseau et réessayez.' };
    if (err.status === 429) return { kind: 'rate', text: 'Trop de tentatives. Réessayez dans quelques minutes.' };
    return { kind: API_KINDS[err.code] ?? 'other', text: err.message || 'Une erreur est survenue. Réessayez.' };
  }
  const e = err as { code?: string; message?: string; status?: number } | null;
  const code = (e?.code ?? '').toLowerCase();
  const msg = (e?.message ?? (typeof err === 'string' ? err : '')).toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => code === n || msg.includes(n));

  if (has('signups not allowed for otp', 'signup_disabled', 'otp_disabled', 'user_not_found', 'user not found'))
    return { kind: 'no_account', text: 'Aucun compte n’est associé à cette adresse.' };
  if (has('email_not_confirmed', 'email not confirmed'))
    return { kind: 'unconfirmed', text: 'Votre adresse n’est pas encore confirmée : ouvrez le lien reçu par e-mail.' };
  if (has('invalid_credentials', 'invalid login credentials'))
    return { kind: 'credentials', text: 'E-mail ou mot de passe incorrect.' };
  if (has('user_already_exists', 'email_exists', 'already registered', 'already exists', 'un compte existe déjà'))
    return { kind: 'exists', text: 'Un compte existe déjà avec cette adresse. Connectez-vous, ou réinitialisez votre mot de passe.' };
  if (has('over_email_send_rate_limit', 'email rate limit'))
    return { kind: 'rate', text: 'Le service ne peut plus envoyer d’e-mail pour le moment. Réessayez dans une heure, ou connectez-vous si votre compte existe déjà.' };
  if (has('over_request_rate_limit', 'rate limit', 'too many requests', 'security purposes')) {
    const m = msg.match(/after (\d+) seconds/);
    return { kind: 'rate', text: m ? `Patientez ${m[1]} secondes avant de redemander un e-mail.` : 'Trop de tentatives. Réessayez dans quelques minutes.' };
  }
  if (has('otp_expired', 'token has expired', 'link is invalid', 'expired', 'invalid or has expired', 'access_denied'))
    return { kind: 'expired', text: 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.' };
  if (has('weak_password', 'password should be at least', 'password is too weak'))
    return { kind: 'password', text: 'Mot de passe trop court : 8 caractères au minimum.' };
  if (has('same_password', 'should be different from the old password'))
    return { kind: 'password', text: 'Choisissez un mot de passe différent de l’ancien.' };
  if (has('email_address_invalid', 'invalid email', 'unable to validate email', 'is invalid', 'validation_failed'))
    return { kind: 'email', text: 'Adresse e-mail invalide.' };
  if (has('failed to fetch', 'network', 'networkerror', 'load failed', 'fetch'))
    return { kind: 'network', text: 'Connexion perdue. Vérifiez votre réseau et réessayez.' };
  if (e?.status && e.status >= 500) return { kind: 'other', text: 'Le service est momentanément indisponible. Réessayez dans un instant.' };
  return { kind: 'other', text: 'Une erreur est survenue. Réessayez.' };
}

export const authErrorText = (err: unknown): string => describeAuthError(err).text;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 8;
