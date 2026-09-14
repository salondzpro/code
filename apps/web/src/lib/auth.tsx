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

/** Message lisible pour les erreurs de connexion les plus courantes de Supabase. */
export function authErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.toLowerCase();
  if (/invalid login credentials/.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/email not confirmed/.test(m)) return 'Adresse non confirmée : cliquez le lien reçu par e-mail.';
  if (/rate limit|too many requests|security purposes/.test(m)) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (/already registered|already exists/.test(m)) return 'Un compte existe déjà avec cette adresse.';
  if (/password should be at least|weak password/.test(m)) return 'Mot de passe trop court : 8 caractères au minimum.';
  if (/invalid email|is invalid/.test(m)) return 'Adresse e-mail invalide.';
  if (/fetch|network/.test(m)) return 'Connexion perdue. Vérifiez votre réseau et réessayez.';
  return msg;
}
