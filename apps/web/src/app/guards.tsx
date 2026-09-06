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

/** Colonne app + barre d'onglets pro (Accueil · Agenda · Clients · Équipe · Prestations · Profil). */
export function ProLayout() {
  return (
    <AppFrame>
      <Outlet />
      <BottomNav kind="pro" />
    </AppFrame>
  );
}

/** Colonne app sans barre d'onglets (parcours de connexion, écrans plein cadre, assistants). */
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
 * Espace pro : session requise. Sans salon → onboarding étapes 1 à 4 (le salon est créé à l'étape 4) ;
 * avec salon → tout l'espace pro, y compris les étapes 5 à 10 (réutilisées comme réglages).
 * (C'est ce garde qui redirige après la création : la mise en cache du salon déclenche ce rendu.)
 */
export function RequirePro() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '');
  const stepMatch = path.match(/^\/pro\/onboarding\/(\d+)/);
  const step = stepMatch ? Number(stepMatch[1]) : null;
  const onboarding = path.startsWith('/pro/onboarding');
  const salonQuery = useProSalon(!!session);

  if (loading) return <Splash />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?role=pro&next=${next}`} replace />;
  }
  if (salonQuery.isPending) return <Splash />;
  if (salonQuery.isError) return <ErrorMessage error={salonQuery.error} retry={() => salonQuery.refetch()} />;

  const salon = salonQuery.data.salon;
  if (!salon) {
    if (!onboarding || step === null || step > 4) return <Navigate to="/pro/onboarding/1" replace />;
    return <Outlet />;
  }
  if (onboarding && (step === null || step <= 4) && !path.endsWith('/publier')) return <Navigate to={salon.services.length === 0 ? '/pro/onboarding/5' : '/pro'} replace />;
  return <Outlet />;
}
