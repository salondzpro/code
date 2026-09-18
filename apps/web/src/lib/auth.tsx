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
import { ApiError, queryKeys } from '@salondz/api-client';
import { demoAccountFor, type UserRole } from '@salondz/constants';
import { api } from './api';
import { env } from './env';
import { supabase } from './supabase';
import { t } from '@/i18n';

/** Page qui reçoit les liens envoyés par e-mail (confirmation, connexion, mot de passe). */
export function authRedirectUrl(path: string, next?: string): string {
  // Les liens e-mail reviennent sur le domaine officiel (en dev : l'origine locale).
  const url = new URL(path, env.siteUrl);
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
  /** Compte de démonstration : adresse e-mail (accès direct) ou ancien numéro. */
  demoLogin: (identifier: string) => Promise<void>;
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
    // Compte créé par l'API, qui envoie elle-même le lien de confirmation (nos e-mails, pas
    // le SMTP de Supabase). Jamais de session tout de suite : il faut cliquer le lien.
    await api.auth.signup({ email, password, role, next });
    return false;
  }, []);

  const sendMagicLink = useCallback(async (email: string, next: string) => {
    await api.auth.magicLink({ email, next });
  }, []);

  const resendConfirmation = useCallback(async (email: string, next: string) => {
    await api.auth.resendConfirmation({ email, next });
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await api.auth.passwordReset({ email, next: '/' });
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const demoLogin = useCallback(async (identifier: string) => {
    const acct = demoAccountFor(identifier);
    if (!acct) throw new Error('Compte de démonstration inconnu.');
    const { accessToken, refreshToken } = await api.auth.devLogin({ email: acct.email });
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
const API_KINDS: Record<string, AuthErrorKind> = {
  NO_ACCOUNT: 'no_account',
  EMAIL_EXISTS: 'exists',
  ALREADY_CONFIRMED: 'exists',
  EMAIL_INVALID: 'email',
  EMAIL_QUOTA: 'rate',
  RATE_LIMITED: 'rate',
};

export function describeAuthError(err: unknown): { kind: AuthErrorKind; text: string } {
  // Erreurs de NOTRE API : déjà en français, avec un code métier.
  if (err instanceof ApiError) {
    if (err.isNetwork) return { kind: 'network', text: t("Connexion perdue. Vérifiez votre réseau et réessayez.") };
    if (err.status === 429) return { kind: 'rate', text: t("Trop de tentatives. Réessayez dans quelques minutes.") };
    return { kind: API_KINDS[err.code] ?? 'other', text: err.message || 'Une erreur est survenue. Réessayez.' };
  }
  const e = err as { code?: string; message?: string; status?: number } | null;
  const code = (e?.code ?? '').toLowerCase();
  const msg = (e?.message ?? (typeof err === 'string' ? err : '')).toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => code === n || msg.includes(n));

  if (has('signups not allowed for otp', 'signup_disabled', 'otp_disabled', 'user_not_found', 'user not found'))
    return { kind: 'no_account', text: t("Aucun compte n’est associé à cette adresse.") };
  if (has('email_not_confirmed', 'email not confirmed'))
    return { kind: 'unconfirmed', text: t("Votre adresse n’est pas encore confirmée : ouvrez le lien reçu par e-mail.") };
  if (has('invalid_credentials', 'invalid login credentials'))
    return { kind: 'credentials', text: t("E-mail ou mot de passe incorrect.") };
  if (has('user_already_exists', 'email_exists', 'already registered', 'already exists', 'un compte existe déjà'))
    return { kind: 'exists', text: t("Un compte existe déjà avec cette adresse. Connectez-vous, ou réinitialisez votre mot de passe.") };
  if (has('over_email_send_rate_limit', 'email rate limit')) {
    // Quota d'envoi d'e-mails du service (et non une faute de l'utilisateur) : on le dit.
    return {
      kind: 'rate',
      text: t("Le service ne peut plus envoyer d’e-mail pour le moment. Réessayez dans une heure, ou connectez-vous si votre compte existe déjà."),
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
    return { kind: 'expired', text: t("Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.") };
  if (has('weak_password', 'password should be at least', 'password is too weak'))
    return { kind: 'password', text: t("Mot de passe trop court : 8 caractères au minimum.") };
  if (has('same_password', 'should be different from the old password'))
    return { kind: 'password', text: t("Choisissez un mot de passe différent de l’ancien.") };
  if (has('email_address_invalid', 'invalid email', 'unable to validate email', 'is invalid', 'validation_failed'))
    return { kind: 'email', text: t("Adresse e-mail invalide.") };
  if (has('failed to fetch', 'network', 'networkerror', 'load failed', 'fetch'))
    return { kind: 'network', text: t("Connexion perdue. Vérifiez votre réseau et réessayez.") };
  if (e?.status && e.status >= 500) return { kind: 'other', text: t("Le service est momentanément indisponible. Réessayez dans un instant.") };
  return { kind: 'other', text: t("Une erreur est survenue. Réessayez.") };
}

/** Message lisible pour les erreurs de connexion les plus courantes de Supabase. */
export function authErrorText(err: unknown): string {
  return describeAuthError(err).text;
}
