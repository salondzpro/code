import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe, useProSalon } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { PublicHeader } from '@/components/PublicHeader';
import { ProHeader } from '@/components/ProHeader';
import { useRealtimeBookings, useRealtimeMyBookings } from '@/lib/realtime';
import { api } from '@/lib/api';
import { refreshWebPushIfGranted } from '@/lib/webpush';
import { Splash } from '@/pages/auth/Splash';
import { ErrorMessage } from '@/components/ErrorMessage';
import { AppFrame, BottomNav } from '@/components/AppFrame';

/** Colonne app + barre d'onglets client (Marketplace · Rendez-vous · Profil). */
export function ClientLayout() {
  return (
    <AppFrame>
      <PublicHeader />
      <Outlet />
      <BottomNav kind="client" />
    </AppFrame>
  );
}

/**
 * Parcours client SANS barre d'onglets (fiche salon, détail d'un rendez-vous, réservation) :
 * l'en-tête Salon DZ y reste, car c'est le seul moyen de revenir à l'accueil ou d'ouvrir le
 * menu depuis ces écrans. Distinct de `PlainLayout`, qui sert la connexion et l'onboarding
 * pro, où cet en-tête n'aurait rien à faire.
 */
export function ClientPlainLayout() {
  return (
    <AppFrame>
      <PublicHeader />
      <Outlet />
    </AppFrame>
  );
}

/** Colonne app + barre d'onglets pro (Accueil · Agenda · Clients · Équipe · Prestations · Profil). */
export function ProLayout() {
  /**
   * L'écoute temps réel des réservations vit ICI, et non plus dans l'accueil et l'agenda :
   * la pastille des demandes à confirmer est dans la barre d'onglets, donc présente sur
   * tous les écrans pro. Abonnée seulement depuis deux écrans, elle restait figée dès que
   * le professionnel était ailleurs. Un seul canal pour toute la session pro (deux
   * abonnements au même nom ne sont pas fiables).
   */
  const salonId = useProSalon().data?.salon?.id;
  useRealtimeBookings(salonId);
  return (
    <AppFrame>
      <ProHeader />
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
  // Mes rendez-vous et notifications se rafraîchissent quand le salon confirme, déplace ou annule.
  useRealtimeMyBookings(session?.user.id);
  /**
   * Abonnement navigateur rafraîchi quand la permission est DÉJÀ accordée : un abonnement
   * peut être renouvelé par le navigateur, et un jeton périmé ne reçoit plus rien sans que
   * personne s'en aperçoive. Aucune demande n'est affichée ici — elle vient du réglage.
   */
  const pushRefreshed = useRef(false);
  useEffect(() => {
    if (!session || pushRefreshed.current) return;
    pushRefreshed.current = true;
    void refreshWebPushIfGranted(api);
  }, [session]);
  if (loading) return <Splash />;
  if (!session)
    return (
      <Navigate
        to={
          location.pathname === '/'
            ? '/intro'
            : `/connexion?next=${encodeURIComponent(location.pathname + location.search)}`
        }
        replace
      />
    );
  if (me.isPending) return <Splash />;
  if (me.isError) return <ErrorMessage error={me.error} retry={() => me.refetch()} />;
  const p = me.data.profile;
  const next = encodeURIComponent(location.pathname + location.search);
  // Nom ET numéro obligatoires : le salon doit pouvoir joindre la personne.
  if (!p.fullName || !p.phone) return <Navigate to={`/profil/creer?next=${next}`} replace />;
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
  const me = useMe(!!session);
  // Même rafraîchissement de l'abonnement push que côté client : le pro est le premier à devoir
  // recevoir une demande, même l'application fermée.
  const pushRefreshed = useRef(false);
  useEffect(() => {
    if (!session || pushRefreshed.current) return;
    pushRefreshed.current = true;
    void refreshWebPushIfGranted(api);
  }, [session]);

  if (loading) return <Splash />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?role=pro&next=${next}`} replace />;
  }
  if (salonQuery.isPending || me.isPending) return <Splash />;
  // Le professionnel aussi complète nom et numéro avant d'entrer : ses clients l'appellent.
  if (me.data && (!me.data.profile.fullName || !me.data.profile.phone) && !onboarding)
    return <Navigate to={`/profil/creer?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (salonQuery.isError)
    return <ErrorMessage error={salonQuery.error} retry={() => salonQuery.refetch()} />;

  const salon = salonQuery.data.salon;
  if (!salon) {
    if (!onboarding || step === null || step > 4)
      return <Navigate to="/pro/onboarding/1" replace />;
    return <Outlet />;
  }
  if (onboarding && (step === null || step <= 4) && !path.endsWith('/publier'))
    return <Navigate to={salon.services.length === 0 ? '/pro/onboarding/6' : '/pro'} replace />;
  return <Outlet />;
}
