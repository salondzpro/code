import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe, useProSalon } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { Splash } from '@/pages/auth/Splash';
import { ErrorMessage } from '@/components/ErrorMessage';
import { AppFrame, BottomNav } from '@/components/AppFrame';

/** Colonne app + barre d'onglets client (Marketplace · Rendez-vous · Profil). */
export function ClientLayout() {
  return (
    <AppFrame>
      <Outlet />
      <BottomNav kind="client" />
    </AppFrame>
  );
}

/** Colonne app sans barre d'onglets (parcours de connexion, écrans plein cadre). */
export function PlainLayout() {
  return (
    <AppFrame>
      <Outlet />
    </AppFrame>
  );
}

/** Exige une session ; sinon → /connexion?next=… */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?next=${next}`} replace />;
  }
  return <Outlet />;
}

/**
 * Espace client : session requise, profil complété (prénom) et marché choisi.
 * Sans session → introduction (AUTH 02). Profil incomplet → AUTH 13. Sans marché → AUTH 15.
 */
export function RequireClient() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const me = useMe(!!session);
  if (loading) return <Splash />;
  if (!session) return <Navigate to={location.pathname === '/' ? '/intro' : `/connexion?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (me.isPending) return <Splash />;
  if (me.isError) return <ErrorMessage error={me.error} retry={() => me.refetch()} />;
  const p = me.data.profile;
  const next = encodeURIComponent(location.pathname + location.search);
  if (!p.fullName) return <Navigate to={`/profil/creer?next=${next}`} replace />;
  if (!p.market && p.role !== 'pro') return <Navigate to={`/marche?next=${next}`} replace />;
  return <Outlet />;
}

/**
 * Espace pro : session requise ; sans salon → /pro/onboarding ; avec salon sur
 * l'onboarding → /pro/services tant qu'aucun service n'existe, sinon /pro.
 * (C'est ce garde, et non la page Onboarding, qui redirige après la création :
 * la mise en cache du salon déclenche ce rendu avant la fin de la mutation.)
 */
export function RequirePro() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const onboarding = location.pathname.replace(/\/$/, '').startsWith('/pro/onboarding');
  const salonQuery = useProSalon(!!session);

  if (loading) return <Splash />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?role=pro&next=${next}`} replace />;
  }
  if (salonQuery.isPending) return <Splash />;
  if (salonQuery.isError) return <ErrorMessage error={salonQuery.error} retry={() => salonQuery.refetch()} />;

  const salon = salonQuery.data.salon;
  if (!salon && !onboarding) return <Navigate to="/pro/onboarding" replace />;
  if (salon && onboarding) return <Navigate to={salon.services.length === 0 ? '/pro/services' : '/pro'} replace />;
  return <Outlet />;
}
