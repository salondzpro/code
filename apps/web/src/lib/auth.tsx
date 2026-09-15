/**
 * Session et connexion, par E-MAIL (comme les outils du métier) : mot de passe pour le
 * quotidien, lien de connexion envoyé par e-mail en secours, réinitialisation du mot de
 * passe. L'adresse est vérifiée à l'inscription par le lien de confirmation de Supabase.
 * Le numéro de téléphone n'est plus un moyen de connexion : c'est une donnée du profil,
 * obligatoire et contrôlée dans sa forme seulement (aucun SMS envoyé).
 *
 * Les comptes de démonstration (numéro + code fixe) gardent leur accès direct par l'API.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@salondz/api-client';
import { isTestPhone, type UserRole } from '@salondz/constants';
import { api } from './api';
import { supabase } from './supabase';

/** Page qui reçoit les liens envoyés par e-mail (confirmation, connexion, mot de passe). */
export function authRedirectUrl(path: string, next?: string): string {
  const url = new URL(path, window.location.origin);
  if (next) url.searchParams.set('next', next);
  return url.toString();
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Connexion par e-mail et mot de passe. */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /**
   * Inscription : crée le compte (rôle en métadonnée, lu par le trigger de profil) et envoie
   * le lien de confirmation. Renvoie `true` si une session est ouverte tout de suite (projet
   * sans confirmation d'e-mail), `false` s'il faut d'abord cliquer le lien reçu.
   */
  signUpWithPassword: (email: string, password: string, role: UserRole, next: string) => Promise<boolean>;
  /** Lien de connexion par e-mail (sans mot de passe). */
  sendMagicLink: (email: string, next: string) => Promise<void>;
  /** Renvoie le lien de confirmation d'inscription. */
  resendConfirmation: (email: string, next: string) => Promise<void>;
  /** E-mail de réinitialisation du mot de passe. */
  sendPasswordReset: (email: string) => Promise<void>;
  /** Nouveau mot de passe (session ouverte par le lien de réinitialisation). */
  updatePassword: (password: string) => Promise<void>;
  /** Comptes de démonstration : numéro + code fixe → vraie session par l'API. */
  demoLogin: (phone: string, code: string) => Promise<void>;
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

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string, role: UserRole, next: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role }, emailRedirectTo: authRedirectUrl('/connexion/retour', next) },
    });
    if (error) throw error;
    // Adresse déjà inscrite : Supabase répond sans erreur mais sans identité (anti-énumération).
    if (data.user && data.user.identities && data.user.identities.length === 0)
      throw new Error('Un compte existe déjà avec cette adresse. Connectez-vous, ou réinitialisez votre mot de passe.');
    return !!data.session;
  }, []);

  const sendMagicLink = useCallback(async (email: string, next: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: authRedirectUrl('/connexion/retour', next) },
    });
    if (error) throw error;
  }, []);

  const resendConfirmation = useCallback(async (email: string, next: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authRedirectUrl('/connexion/retour', next) },
    });
    if (error) throw error;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl('/connexion/mot-de-passe'),
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const demoLogin = useCallback(async (phone: string, code: string) => {
    if (!isTestPhone(phone)) throw new Error('Compte de démonstration inconnu.');
    const { accessToken, refreshToken } = await api.auth.devLogin({ phone, code: code.trim() });
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signInWithPassword,
      signUpWithPassword,
      sendMagicLink,
      resendConfirmation,
      sendPasswordReset,
      updatePassword,
      demoLogin,
      signOut,
    }),
    [session, loading, signInWithPassword, signUpWithPassword, sendMagicLink, resendConfirmation, sendPasswordReset, updatePassword, demoLogin, signOut],
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

/**
 * Toute erreur d'authentification est traduite ici, en français, à partir du CODE renvoyé
 * par Supabase quand il existe et sinon du message. Jamais de texte anglais brut à l'écran :
 * le dernier recours est un message générique.
 */
export function describeAuthError(err: unknown): { kind: AuthErrorKind; text: string } {
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
  if (has('over_email_send_rate_limit', 'email rate limit')) {
    // Quota d'envoi d'e-mails du service (et non une faute de l'utilisateur) : on le dit.
    return {
      kind: 'rate',
      text: 'Le service ne peut plus envoyer d’e-mail pour le moment. Réessayez dans une heure, ou connectez-vous si votre compte existe déjà.',
    };
  }
  if (has('over_request_rate_limit', 'rate limit', 'too many requests', 'security purposes')) {
    const m = msg.match(/after (\d+) seconds/);
    return {
      kind: 'rate',
      text: m ? `Patientez ${m[1]} secondes avant de redemander un e-mail.` : 'Trop de tentatives. Réessayez dans quelques minutes.',
    };
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

/** Message lisible pour les erreurs de connexion les plus courantes de Supabase. */
export function authErrorText(err: unknown): string {
  return describeAuthError(err).text;
}
