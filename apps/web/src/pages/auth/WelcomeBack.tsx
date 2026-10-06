/**
 * AUTH 14 — Retour dans l'app : relais sans écran. La session (lien e-mail, connexion, compte déjà
 * ouvert) est lue, puis on entre directement : profil incomplet → création, marché manquant → choix,
 * sinon la page visée. L'ancien « Bon retour, Inès · Continuer » n'apportait rien (16 sept. 2026).
 */
import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { useMe } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { readAuthFlow } from '@/lib/authFlow';
import { supabase } from '@/lib/supabase';
import { PageLoading } from '@/components/PageLoading';

/**
 * Jetons arrivés par une PASSATION depuis le navigateur (`lib/appHandoff.ts`). Supabase ne lit le
 * fragment qu'au démarrage du client, en regardant l'adresse de la page : ici on arrive par une
 * navigation INTERNE du routeur, qu'il ne voit pas. Sans ce relais, l'application s'ouvrirait bien
 * mais resterait déconnectée — c'est-à-dire tout ce que la passation devait éviter.
 */
function useSessionDepuisFragment(session: unknown): 'inutile' | 'en-cours' | 'fini' {
  const [etat, setEtat] = useState<'inutile' | 'en-cours' | 'fini'>('inutile');
  useEffect(() => {
    if (session) return;
    const f = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const access_token = f.get('access_token');
    const refresh_token = f.get('refresh_token');
    if (!access_token || !refresh_token) return;
    setEtat('en-cours');
    void supabase.auth
      .setSession({ access_token, refresh_token })
      .catch(() => undefined)
      .finally(() => {
        // Les jetons ne doivent pas rester dans la barre d'adresse ni dans l'historique.
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setEtat('fini');
      });
  }, [session]);
  return etat;
}

export function WelcomeBack() {
  const [params] = useSearchParams();
  const { session, loading } = useAuth();
  const me = useMe(!!session);
  // Page d'atterrissage des liens e-mail : la session arrive dans l'URL et met un instant à
  // être lue. Rediriger avant la fin du chargement renvoyait sur la connexion à chaque lien.
  // Lien expiré ou déjà utilisé : Supabase le dit dans le fragment de l'URL. On le traduit
  // sur l'écran de connexion plutôt que d'y arriver sans explication.
  const reprise = useSessionDepuisFragment(session);
  const hashErr = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  // Session en cours d'installation depuis les jetons : on attend, sinon on repartirait sur la
  // connexion alors que tout est là.
  if (reprise === 'en-cours') return <PageLoading />;
  if (!session && (hashErr.get('error') || hashErr.get('error_code')))
    return <Navigate to={`/connexion?erreur=${encodeURIComponent(hashErr.get('error_code') ?? hashErr.get('error') ?? 'lien')}`} replace />;
  if (loading) return <PageLoading />;
  if (!session) return <Navigate to="/connexion" replace />;
  // Profil injoignable (réseau) : on entre quand même, les gardes des pages feront le reste.
  if (!me.data && !me.isError) return <PageLoading />;

  const profile = me.data?.profile;
  const next = params.get('next') ?? readAuthFlow()?.next ?? (profile?.role === 'pro' ? '/pro' : '/');
  const q = `?next=${encodeURIComponent(next)}`;
  // Le nom, le numéro et le marché servent à RÉSERVER. Qui entre dans l'administration ne réserve
  // rien : on ne lui réclame pas de quoi être rappelé pour un rendez-vous qu'il ne prendra pas.
  // Rien à contourner ici — c'est `requireAdmin`, côté serveur, qui ouvre ou non la porte.
  if (!next.startsWith('/admin')) {
    if (!profile?.fullName || !profile.phone) return <Navigate to={`/profil/creer${q}`} replace />;
    if (profile.role !== 'pro' && !profile.market) return <Navigate to={`/marche${q}`} replace />;
  }
  return <Navigate to={next} replace />;
}
