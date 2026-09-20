/**
 * AUTH 14 — Retour dans l'app : relais sans écran. La session (lien e-mail, connexion, compte déjà
 * ouvert) est lue, puis on entre directement : profil incomplet → création, marché manquant → choix,
 * sinon la page visée. L'ancien « Bon retour, Inès · Continuer » n'apportait rien (16 sept. 2026).
 */
import { Navigate, useSearchParams } from 'react-router';
import { useMe } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { readAuthFlow } from '@/lib/authFlow';
import { Splash } from './Splash';

export function WelcomeBack() {
  const [params] = useSearchParams();
  const { session, loading } = useAuth();
  const me = useMe(!!session);
  // Page d'atterrissage des liens e-mail : la session arrive dans l'URL et met un instant à
  // être lue. Rediriger avant la fin du chargement renvoyait sur la connexion à chaque lien.
  // Lien expiré ou déjà utilisé : Supabase le dit dans le fragment de l'URL. On le traduit
  // sur l'écran de connexion plutôt que d'y arriver sans explication.
  const hashErr = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (!session && (hashErr.get('error') || hashErr.get('error_code')))
    return <Navigate to={`/connexion?erreur=${encodeURIComponent(hashErr.get('error_code') ?? hashErr.get('error') ?? 'lien')}`} replace />;
  if (loading) return <Splash />;
  if (!session) return <Navigate to="/connexion" replace />;
  // Profil injoignable (réseau) : on entre quand même, les gardes des pages feront le reste.
  if (!me.data && !me.isError) return <Splash />;

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
