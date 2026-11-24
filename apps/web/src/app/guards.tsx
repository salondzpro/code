import { ReminderConfirm } from '@/components/ReminderConfirm';
import { NotificationsGate } from '@/components/NotificationsGate';
import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe, useProPendingUnseenCount, useProSalon } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { PublicHeader } from '@/components/PublicHeader';
import { AppBanner } from '@/components/AppBanner';
import { ProHeader } from '@/components/ProHeader';
import { useRealtimeBookings, useRealtimeMyBookings } from '@/lib/realtime';
import { api } from '@/lib/api';
import { refreshWebPushIfGranted } from '@/lib/webpush';
import { PageLoading } from '@/components/PageLoading';
import { ErrorState } from '@/components/ErrorMessage';
import { AppFrame, BottomNav } from '@/components/AppFrame';
import { ProRail } from '@/components/ProNav';
import { useDesktop } from '@/lib/breakpoint';
import { useActingAs } from '@/lib/actingAs';
import { useAutoLocate } from '@/lib/useAutoLocate';
import { ActingAsBanner } from '@/components/ActingAsBanner';
import { CompteRefuse, estRefusCompte } from '@/components/CompteRefuse';
import { APPLI } from '@/lib/flavor';
import { trace } from '@/lib/traceConnexion';
import { AccountSuspendedNotice, SalonSuspendedNotice } from '@/components/SuspensionNotice';

/** Colonne app + barre d'onglets client (Marketplace · Rendez-vous · Profil). */
export function ClientLayout() {
  // Reprend une mesure de position ACCEPTÉE dans la fenêtre « Par défaut : Alger » (place de marché).
  useAutoLocate();
  // Comme l'espace pro (refonte du 1er nov., étendue aux clientes le 14 nov. 2026) : sur téléphone,
  // plus d'en-tête ni de tiroir — le titre est dans la page, la cloche sur l'accueil. L'en-tête ne
  // reste que sur ordinateur, où il porte la navigation.
  // En-tête façon Planity sur TOUS les écrans (19 nov. 2026, demande du propriétaire).
  return (
    <AppFrame className="cl-frame">
      <PublicHeader />
      <AccountSuspendedNotice />
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
  const { pathname } = useLocation();
  // Pages d'un salon et de sa réservation, sur le site en téléphone : « Ouvrir dans l'application ».
  const banniere = /^\/s\//.test(pathname) || /^\/rendez-vous\/[^/]+\/confirme/.test(pathname);
  return (
    <AppFrame className="cl-frame">
      {banniere && <AppBanner />}
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
  const salon = useProSalon().data?.salon ?? null;
  const { session } = useAuth();
  useRealtimeBookings(salon?.id, session?.user.id);
  const pending = useProPendingUnseenCount(!!salon);
  /**
   * À partir de 1 024 px, la navigation quitte la barre d'onglets flottante pour un RAIL
   * permanent à gauche, comme les outils du métier : on voit où l'on est et où aller sans
   * ouvrir de tiroir. En dessous, `ProRail` n'est pas monté et la coque est celle du
   * téléphone, inchangée (`.pro-shell` et `.pro-main` sont alors de simples blocs).
   */
  const desktop = useDesktop();
  return (
    // Refonte du 1er nov. 2026 : sur téléphone, plus d'en-tête ni de tiroir (titre dans la page, cloche
    // sur l'accueil, « + » dans l'agenda, gestion dans « Plus »). L'en-tête ne reste qu'avec le rail.
    <AppFrame className="pro-frame">
      <ActingAsBanner />
      <ReminderConfirm />
      {desktop && <ProHeader />}
      <SalonSuspendedNotice />
      <div className="pro-shell">
        {desktop && <ProRail salon={salon} pending={pending} />}
        <div className="pro-main">
          <Outlet />
        </div>
      </div>
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
  if (loading) return <PageLoading />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?next=${next}`} replace />;
  }
  return <Outlet />;
}

/**
 * Ce qu'un visiteur consulte sans compte : la place de marché, la carte et le choix du lieu. Les
 * pages de salon et le choix du créneau sont publics aussi (`routesPubliques`) ; la connexion se
 * demande quand on valide un créneau, à `/s/:slug/reserver/coordonnees`.
 */
const LIBRE_ACCES = /^\/(salons|carte|localisation|categorie\/[^/]+)?\/?$/;

/**
 * Espace client. Sans session : les pages en libre accès s'ouvrent, les autres mènent à la
 * connexion. Avec une session : profil complété (AUTH 13) et marché choisi (AUTH 15).
 */
export function RequireClient() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const me = useMe(!!session);
  trace('garde-client', { session: !!session, loading, me: me.status, err: (me.error as { code?: string } | null)?.code });
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
  if (loading) return <PageLoading />;
  if (!session) {
    if (LIBRE_ACCES.test(location.pathname)) return <Outlet />;
    return <Navigate to={`/connexion?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (me.isPending) return <PageLoading />;
  if (me.isError) {
    if (estRefusCompte(me.error)) return <CompteRefuse cote="client" />;
    return <ErrorState error={me.error} retry={() => me.refetch()} accueil={false} />;
  }
  const p = me.data.profile;
  /**
   * UN RÔLE, UN ESPACE. Un professionnel n'a rien à faire dans la place de marché : c'est ce qui
   * le ramenait à l'ouverture de l'application. Celle-ci démarre sur `/`, et ce garde laissait
   * passer tout le monde — un professionnel rouvrait donc son application en client, et devait
   * retrouver son espace à la main.
   */
  // SÉPARATION STRICTE (16 nov. 2026) : un compte pro n'entre JAMAIS dans l'espace client et n'est
  // jamais renvoyé vers son espace pro — session fermée, « Aucun compte client associé à ces
  // identifiants. ». Seule exception, sur le SITE : les pages en libre accès (place de marché, carte)
  // restent consultables comme par un visiteur.
  if (p.role === 'pro') {
    if (APPLI === null && LIBRE_ACCES.test(location.pathname)) return <Outlet />;
    return <CompteRefuse cote="client" />;
  }
  const next = encodeURIComponent(location.pathname + location.search);
  // Nom ET numéro obligatoires (17 nov. 2026, demande du propriétaire) : le salon doit pouvoir joindre
  // la personne. Un compte créé sans numéro le donne à « Vos coordonnées » avant d'entrer.
  if (!p.fullName || !p.phone) return <Navigate to={`/profil/creer?next=${next}`} replace />;
  if (!p.market) return <Navigate to={`/marche?next=${next}`} replace />;
  // Notifications demandées à chaque ouverture tant qu'elles ne sont pas actives (17 nov. 2026).
  return (
    <>
      <Outlet />
      <NotificationsGate />
    </>
  );
}

/**
 * Espace pro : session requise. Sans salon → onboarding étapes 1 à 4 (le salon est créé à l'étape 4) ;
 * avec salon → tout l'espace pro, y compris les étapes 5 à 10 (réutilisées comme réglages).
 * (C'est ce garde qui redirige après la création : la mise en cache du salon déclenche ce rendu.)
 */
export function RequirePro() {
  const { session, loading } = useAuth();
  const acting = useActingAs();
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '');
  const stepMatch = path.match(/^\/pro\/onboarding\/(\d+)/);
  const step = stepMatch ? Number(stepMatch[1]) : null;
  const onboarding = path.startsWith('/pro/onboarding');
  const salonQuery = useProSalon(!!session);
  const me = useMe(!!session);
  trace('garde-pro', { session: !!session, loading, me: me.status, salon: salonQuery.status, err: (salonQuery.error as { code?: string } | null)?.code ?? (me.error as { code?: string } | null)?.code });
  // Même rafraîchissement de l'abonnement push que côté client : le pro est le premier à devoir
  // recevoir une demande, même l'application fermée.
  const pushRefreshed = useRef(false);
  useEffect(() => {
    if (!session || pushRefreshed.current) return;
    pushRefreshed.current = true;
    void refreshWebPushIfGranted(api);
  }, [session]);

  if (loading) return <PageLoading />;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/pro/bienvenue?next=${next}`} replace />;
  }
  // SÉPARATION STRICTE (16 nov. 2026) : un compte client n'entre jamais dans l'espace pro (pas
  // d'inscription de salon proposée). L'administrateur qui pilote un salon reste admis.
  if (!acting && (estRefusCompte(salonQuery.error) || estRefusCompte(me.error) || (me.data && me.data.profile.role !== 'pro')))
    return <CompteRefuse cote="pro" />;
  if (salonQuery.isPending || me.isPending) return <PageLoading />;
  // Le professionnel aussi complète nom et numéro avant d'entrer : ses clients l'appellent.
  // Un administrateur qui pilote le salon d'un autre n'a pas à donner son propre numéro : ce sont
  // les coordonnées DU SALON que les clients voient et appellent.
  if (me.data && !acting && (!me.data.profile.fullName || !me.data.profile.phone) && !onboarding)
    return <Navigate to={`/profil/creer?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (salonQuery.isError)
    return <ErrorState error={salonQuery.error} retry={() => salonQuery.refetch()} accueil={false} />;

  const salon = salonQuery.data.salon;
  if (!salon) {
    if (!onboarding || step === null || step > 4)
      return <Navigate to="/pro/onboarding/1" replace />;
    return <Outlet />;
  }
  if (onboarding && (step === null || step <= 4) && !path.endsWith('/prestations'))
    return <Navigate to={salon.services.length === 0 ? '/pro/onboarding/prestations' : '/pro'} replace />;
  return <Outlet />;
}
