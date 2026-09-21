import { Suspense, lazy, type ComponentType } from 'react';
import { Splash } from '@/pages/auth/Splash';
import { createBrowserRouter, Navigate } from 'react-router';
import {
  ClientLayout,
  ClientPlainLayout,
  PlainLayout,
  ProLayout,
  RequireAuth,
  RequireClient,
  RequirePro,
} from './guards';
import { ScrollToTop } from './ScrollToTop';
import { ErrorBoundary } from '@/pages/ErrorBoundary';
import { NotFound } from '@/pages/NotFound';
// Parcours de connexion (design AUTH 01 → 16)
import { Intro } from '@/pages/auth/Intro';
import { Welcome } from '@/pages/auth/Welcome';
import { Login } from '@/pages/auth/Login';
import { SignUp } from '@/pages/auth/SignUp';
import { EmailSent } from '@/pages/auth/EmailSent';
import { ForgotPassword, NewPassword } from '@/pages/auth/Password';
import { WelcomeBack } from '@/pages/auth/WelcomeBack';
import { ProfileSetup } from '@/pages/auth/ProfileSetup';
import { Market } from '@/pages/auth/Market';
import { ProWelcome } from '@/pages/pro/Welcome';
// Client (design C-H / C-F)
import { Marketplace } from '@/pages/client/Marketplace';
import { Localisation } from '@/pages/client/Localisation';
import { CategoryRedirect } from '@/pages/client/CategoryRedirect';
import { Salon } from '@/pages/client/Salon';
import { SalonWorks } from '@/pages/client/SalonWorks';
import { SalonReviews } from '@/pages/client/SalonReviews';
import { SalonServices } from '@/pages/client/SalonServices';
import { ServiceDetail } from '@/pages/client/ServiceDetail';
import { BookingServices } from '@/pages/client/BookingServices';
import { BookingWhen } from '@/pages/client/BookingWhen';
import { BookingDetails } from '@/pages/client/BookingDetails';
import { BookingReview } from '@/pages/client/BookingReview';
import { BookingConfirmed } from '@/pages/client/BookingConfirmed';
import { Bookings } from '@/pages/client/Bookings';
import { BookingDetail } from '@/pages/client/BookingDetail';
import { BookingReschedule } from '@/pages/client/BookingReschedule';
import { Rate } from '@/pages/client/Rate';
import { Favorites } from '@/pages/client/Favorites';
import { Profile } from '@/pages/client/Profile';
import { Settings } from '@/pages/client/Settings';
import { AccountInfo } from '@/pages/client/AccountInfo';
import { AccountNotifications } from '@/pages/AccountNotifications';
// Pro (design PRO-F 01 → 26)


/**
 * Page chargée à la demande : l'espace pro, l'inscription pro, la carte et les pages légales ne font
 * pas partie du premier chargement d'une cliente (4G). Le nom exporté est résolu à l'ouverture.
 */
function lazyNamed(loader: () => Promise<Record<string, unknown>>, name: string) {
  const Lazy = lazy(async () => ({ default: (await loader())[name] as ComponentType<Record<string, unknown>> }));
  return function LazyPage(props: Record<string, unknown>) {
    return (
      <Suspense fallback={<Splash />}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
const MapView = lazyNamed(() => import('@/pages/client/MapView'), 'MapView');
const Help = lazyNamed(() => import('@/pages/Legal'), 'Help');
const LegalNotice = lazyNamed(() => import('@/pages/Legal'), 'LegalNotice');
const Privacy = lazyNamed(() => import('@/pages/Legal'), 'Privacy');
const Terms = lazyNamed(() => import('@/pages/Legal'), 'Terms');
const Step1Market = lazyNamed(() => import('@/pages/pro/onboarding/Step1Market'), 'Step1Market');
const Step2Name = lazyNamed(() => import('@/pages/pro/onboarding/Step2Name'), 'Step2Name');
const Step3Identity = lazyNamed(() => import('@/pages/pro/onboarding/Step3Identity'), 'Step3Identity');
const Step4Address = lazyNamed(() => import('@/pages/pro/onboarding/Step4Address'), 'Step4Address');
const Step6Service = lazyNamed(() => import('@/pages/pro/onboarding/Step6Service'), 'Step6Service');
const Step7ServicePhotos = lazyNamed(() => import('@/pages/pro/onboarding/Step7ServicePhotos'), 'Step7ServicePhotos');
const Step8Works = lazyNamed(() => import('@/pages/pro/onboarding/Step8Works'), 'Step8Works');
const Step9Hours = lazyNamed(() => import('@/pages/pro/onboarding/Step9Hours'), 'Step9Hours');
const Step10Availability = lazyNamed(() => import('@/pages/pro/onboarding/Step10Availability'), 'Step10Availability');
const Publish = lazyNamed(() => import('@/pages/pro/onboarding/Publish'), 'Publish');
const ProPhotos = lazyNamed(() => import('@/pages/pro/Photos'), 'ProPhotos');
const ProLink = lazyNamed(() => import('@/pages/pro/Link'), 'ProLink');
const ProQr = lazyNamed(() => import('@/pages/pro/Link'), 'ProQr');
const ProHome = lazyNamed(() => import('@/pages/pro/Home'), 'ProHome');
const Revenue = lazyNamed(() => import('@/pages/pro/Revenue'), 'Revenue');
const AgendaPro = lazyNamed(() => import('@/pages/pro/AgendaPro'), 'AgendaPro');
const Clients = lazyNamed(() => import('@/pages/pro/Clients'), 'Clients');
const ClientDetail = lazyNamed(() => import('@/pages/pro/ClientDetail'), 'ClientDetail');
const ProServices = lazyNamed(() => import('@/pages/pro/ProServices'), 'ProServices');
const ProCategories = lazyNamed(() => import('@/pages/pro/ProCategories'), 'ProCategories');
const ProReviews = lazyNamed(() => import('@/pages/pro/ProReviews'), 'ProReviews');
const ProProfile = lazyNamed(() => import('@/pages/pro/ProProfile'), 'ProProfile');
const MonSalon = lazyNamed(() => import('@/pages/pro/MonSalon'), 'MonSalon');
const ProRules = lazyNamed(() => import('@/pages/pro/ProRules'), 'ProRules');
const ProSpecialties = lazyNamed(() => import('@/pages/pro/ProSpecialties'), 'ProSpecialties');
const ProAccount = lazyNamed(() => import('@/pages/pro/ProAccount'), 'ProAccount');
const ProBookingDetail = lazyNamed(() => import('@/pages/pro/ProBookingDetail'), 'ProBookingDetail');
const ProBookingReschedule = lazyNamed(() => import('@/pages/pro/ProBookingDetail'), 'ProBookingReschedule');
const ProBookingNew = lazyNamed(() => import('@/pages/pro/ProBookingNew'), 'ProBookingNew');
const Team = lazyNamed(() => import('@/pages/pro/Team'), 'Team');
const TeamNew = lazyNamed(() => import('@/pages/pro/TeamNew'), 'TeamNew');
const TeamMember = lazyNamed(() => import('@/pages/pro/TeamMember'), 'TeamMember');
const TeamMemberHours = lazyNamed(() => import('@/pages/pro/TeamMember'), 'TeamMemberHours');
const TeamMemberServices = lazyNamed(() => import('@/pages/pro/TeamMember'), 'TeamMemberServices');
const Closures = lazyNamed(() => import('@/pages/pro/Closures'), 'Closures');
const Requests = lazyNamed(() => import('@/pages/pro/Requests'), 'Requests');
// Administration de la place de marché (`docs/ADMIN.md`). Chargée à la demande : une poignée de
// personnes l'ouvrent, elle n'a rien à faire dans le premier chargement d'une cliente en 4G.
const AdminLayout = lazyNamed(() => import('@/pages/admin/AdminShell'), 'AdminLayout');
const AdminOverview = lazyNamed(() => import('@/pages/admin/AdminOverview'), 'AdminOverview');
const AdminSalons = lazyNamed(() => import('@/pages/admin/AdminSalons'), 'AdminSalons');
const AdminSalon = lazyNamed(() => import('@/pages/admin/AdminSalon'), 'AdminSalon');
const AdminProfiles = lazyNamed(() => import('@/pages/admin/AdminProfiles'), 'AdminProfiles');
const AdminProfile = lazyNamed(() => import('@/pages/admin/AdminProfiles'), 'AdminProfile');
const AdminBookings = lazyNamed(() => import('@/pages/admin/AdminBookings'), 'AdminBookings');
const AdminAudit = lazyNamed(() => import('@/pages/admin/AdminBookings'), 'AdminAudit');
const AdminReports = lazyNamed(() => import('@/pages/admin/AdminReports'), 'AdminReports');

export const router = createBrowserRouter([
  {
    errorElement: <ErrorBoundary />,
    // Chaque page s'ouvre en haut : le navigateur restaurerait sinon la position de la precedente.
    element: <ScrollToTop />,
    children: [
      // ---- Connexion (sans barre d'onglets) ----
      {
        element: <PlainLayout />,
        children: [
          { path: '/intro', element: <Intro /> },
          { path: '/bienvenue', element: <Welcome /> },
          { path: '/connexion', element: <Login /> },
          { path: '/inscription', element: <SignUp /> },
          { path: '/connexion/envoye', element: <EmailSent /> },
          { path: '/connexion/oubli', element: <ForgotPassword /> },
          { path: '/connexion/mot-de-passe', element: <NewPassword /> },
          { path: '/connexion/retour', element: <WelcomeBack /> },
          { path: '/pro/bienvenue', element: <ProWelcome /> },
          {
            element: <RequireAuth />,
            children: [
              { path: '/profil/creer', element: <ProfileSetup /> },
              { path: '/marche', element: <Market /> },
            ],
          },
        ],
      },
      // ---- Espace client : onglets Marketplace · Rendez-vous · Profil ----
      {
        element: <RequireClient />,
        children: [
          {
            element: <ClientLayout />,
            children: [
              { path: '/', element: <Marketplace /> },
              { path: '/categorie/:category', element: <CategoryRedirect /> },
              { path: '/rendez-vous', element: <Bookings /> },
              { path: '/favoris', element: <Favorites /> },
              { path: '/profil', element: <Profile /> },
              { path: '/reglages', element: <Settings /> },
              { path: '/compte/informations', element: <AccountInfo /> },
              { path: '/notifications', element: <AccountNotifications /> },
            ],
          },
          { path: '/carte', element: <MapView /> },
          {
            element: <ClientPlainLayout />,
            children: [
              { path: '/localisation', element: <Localisation /> },
              { path: '/rendez-vous/:id', element: <BookingDetail /> },
              { path: '/rendez-vous/:id/confirme', element: <BookingConfirmed /> },
              { path: '/rendez-vous/:id/reporter', element: <BookingReschedule /> },
              { path: '/rendez-vous/:id/noter', element: <Rate /> },
              { path: '/s/:slug/reserver/coordonnees', element: <BookingDetails /> },
              { path: '/s/:slug/reserver/recap', element: <BookingReview /> },
            ],
          },
        ],
      },
      // ---- Pages salon (publiques, lisibles sans compte) ----
      {
        element: <ClientPlainLayout />,
        children: [
          { path: '/cgu', element: <Terms /> },
          { path: '/confidentialite', element: <Privacy /> },
          { path: '/mentions-legales', element: <LegalNotice /> },
          { path: '/aide', element: <Help /> },
          { path: '/s/:slug', element: <Salon /> },
          { path: '/s/:slug/realisations', element: <SalonWorks /> },
          { path: '/s/:slug/avis', element: <SalonReviews /> },
          { path: '/s/:slug/prestations', element: <BookingServices /> },
          { path: '/s/:slug/catalogue', element: <SalonServices /> },
          { path: '/s/:slug/prestation/:serviceId', element: <ServiceDetail /> },
          { path: '/s/:slug/reserver/quand', element: <BookingWhen /> },
          { path: '/s/:slug/reserver', element: <BookingServices /> },
        ],
      },
      // ---- Espace pro ----
      {
        path: '/pro',
        element: <RequirePro />,
        children: [
          {
            element: <PlainLayout />,
            children: [
              { path: 'onboarding', element: <Step1Market /> },
              { path: 'onboarding/1', element: <Step1Market /> },
              { path: 'onboarding/2', element: <Step2Name /> },
              { path: 'onboarding/3', element: <Step3Identity /> },
              { path: 'onboarding/4', element: <Step4Address /> },
              { path: 'onboarding/5', element: <Navigate to="/pro/onboarding/6" replace /> },
              { path: 'onboarding/6', element: <Step6Service /> },
              { path: 'onboarding/6/:serviceId', element: <Step6Service /> },
              { path: 'onboarding/7/:serviceId', element: <Step7ServicePhotos /> },
              { path: 'onboarding/8', element: <Step8Works /> },
              { path: 'onboarding/9', element: <Step9Hours /> },
              { path: 'onboarding/10', element: <Step10Availability /> },
              { path: 'onboarding/publier', element: <Publish /> },
              { path: 'lien', element: <ProLink /> },
              { path: 'qr', element: <ProQr /> },
              { path: 'profil/horaires', element: <Step9Hours settings /> },
              { path: 'profil/regles', element: <Step10Availability settings /> },
              { path: 'rendez-vous/nouveau', element: <ProBookingNew /> },
              { path: 'rendez-vous/:id', element: <ProBookingDetail /> },
              { path: 'rendez-vous/:id/reporter', element: <ProBookingReschedule /> },
              { path: 'salon', element: <Step4Address settings /> },
              { path: 'photos', element: <ProPhotos /> },
              { path: 'blocages', element: <Closures /> },
              { path: 'services', element: <Navigate to="/pro/catalogue" replace /> },
              { path: 'realisations', element: <Step8Works settings /> },
            ],
          },
          {
            element: <ProLayout />,
            children: [
              { index: true, element: <ProHome /> },
              { path: 'agenda', element: <AgendaPro /> },
              { path: 'chiffre-affaires', element: <Revenue /> },
              { path: 'clients', element: <Clients /> },
              { path: 'clients/:key', element: <ClientDetail /> },
              { path: 'equipe', element: <Team /> },
              { path: 'equipe/nouveau', element: <TeamNew /> },
              { path: 'equipe/:id', element: <TeamMember /> },
              { path: 'equipe/:id/prestations', element: <TeamMemberServices /> },
              { path: 'equipe/:id/horaires', element: <TeamMemberHours /> },
              { path: 'prestations', element: <Navigate to="/pro/catalogue" replace /> },
              { path: 'catalogue', element: <ProServices /> },
              { path: 'categories', element: <ProCategories /> },
              { path: 'avis', element: <ProReviews /> },
              { path: 'reservations', element: <Requests /> },
              { path: 'profil', element: <ProProfile /> },
              { path: 'mon-salon', element: <MonSalon /> },
              { path: 'reglages/rendez-vous', element: <ProRules /> },
              { path: 'specialites', element: <ProSpecialties /> },
              { path: 'compte', element: <ProAccount /> },
              { path: 'compte/informations', element: <AccountInfo backTo="/pro/compte" /> },
              { path: 'notifications', element: <AccountNotifications /> },
            ],
          },
        ],
      },
      // ---- Administration de la place de marché ----
      // Le garde est SERVEUR (`requireAdmin`) : `AdminLayout` ne fait que renvoyer à l'accueil, sans
      // message, quand l'API répond 403. Une adresse devinée ne donne donc rien.
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminOverview /> },
          { path: 'salons', element: <AdminSalons /> },
          { path: 'salons/:id', element: <AdminSalon /> },
          { path: 'comptes', element: <AdminProfiles /> },
          { path: 'comptes/:id', element: <AdminProfile /> },
          { path: 'rendez-vous', element: <AdminBookings /> },
          { path: 'signalements', element: <AdminReports /> },
          { path: 'journal', element: <AdminAudit /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
