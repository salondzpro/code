import { Navigate, Outlet, useLocation } from 'react-router';
import { useProSalon } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';

/** Exige une session ; sinon → /connexion?next=… */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Chargement…" />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?next=${next}`} replace />;
  }
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
  const onboarding = location.pathname.replace(/\/$/, '') === '/pro/onboarding';
  const salonQuery = useProSalon(!!session);

  if (loading) return <Spinner label="Chargement…" />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?role=pro&next=${next}`} replace />;
  }
  if (salonQuery.isPending) return <Spinner label="Chargement de votre espace…" />;
  if (salonQuery.isError) return <ErrorMessage error={salonQuery.error} retry={() => salonQuery.refetch()} />;

  const salon = salonQuery.data.salon;
  if (!salon && !onboarding) return <Navigate to="/pro/onboarding" replace />;
  if (salon && onboarding) return <Navigate to={salon.services.length === 0 ? '/pro/services' : '/pro'} replace />;
  return <Outlet />;
}
