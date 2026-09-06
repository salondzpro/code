import { createBrowserRouter } from 'react-router';
import { ClientLayout, PlainLayout, ProLayout, RequireAuth, RequireClient, RequirePro } from './guards';
import { ErrorBoundary } from '@/pages/ErrorBoundary';
import { NotFound } from '@/pages/NotFound';
// Parcours de connexion (design AUTH 01 → 16)
import { Intro } from '@/pages/auth/Intro';
import { Welcome } from '@/pages/auth/Welcome';
import { Phone } from '@/pages/auth/Phone';
import { Channel } from '@/pages/auth/Channel';
import { Code } from '@/pages/auth/Code';
import { WelcomeBack } from '@/pages/auth/WelcomeBack';
import { ProfileSetup } from '@/pages/auth/ProfileSetup';
import { Market } from '@/pages/auth/Market';
import { ProWelcome } from '@/pages/pro/Welcome';
// Client (design C-H / C-F)
import { Marketplace } from '@/pages/client/Marketplace';
import { Localisation } from '@/pages/client/Localisation';
import { MapView } from '@/pages/client/MapView';
import { SearchPage } from '@/pages/client/SearchPage';
import { CategoryResults } from '@/pages/client/CategoryResults';
import { Salon } from '@/pages/client/Salon';
import { SalonWorks } from '@/pages/client/SalonWorks';
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
import { AccountNotifications } from '@/pages/AccountNotifications';
// Pro (design PRO-F 01 → 26)
import { Step1Market } from '@/pages/pro/onboarding/Step1Market';
import { Step2Name } from '@/pages/pro/onboarding/Step2Name';
import { Step3Identity } from '@/pages/pro/onboarding/Step3Identity';
import { Step4Address } from '@/pages/pro/onboarding/Step4Address';
import { Step5Catalog } from '@/pages/pro/onboarding/Step5Catalog';
import { Step6Service } from '@/pages/pro/onboarding/Step6Service';
import { Step7ServicePhotos } from '@/pages/pro/onboarding/Step7ServicePhotos';
import { Step8Works } from '@/pages/pro/onboarding/Step8Works';
import { Step9Hours } from '@/pages/pro/onboarding/Step9Hours';
import { Step10Availability } from '@/pages/pro/onboarding/Step10Availability';
import { Publish } from '@/pages/pro/onboarding/Publish';
import { ProLink, ProQr } from '@/pages/pro/Link';
import { ProHome } from '@/pages/pro/Home';
import { Revenue } from '@/pages/pro/Revenue';
import { AgendaPro } from '@/pages/pro/AgendaPro';
import { Clients } from '@/pages/pro/Clients';
import { ProServices } from '@/pages/pro/ProServices';
import { ProProfile } from '@/pages/pro/ProProfile';
import { ProBookingDetail, ProBookingReschedule } from '@/pages/pro/ProBookingDetail';
import { ProBookingNew } from '@/pages/pro/ProBookingNew';
import { Team } from '@/pages/pro/Team';
import { Closures } from '@/pages/pro/Closures';
import { Requests } from '@/pages/pro/Requests';

export const router = createBrowserRouter([
  {
    errorElement: <ErrorBoundary />,
    children: [
      // ---- Connexion (sans barre d'onglets) ----
      {
        element: <PlainLayout />,
        children: [
          { path: '/intro', element: <Intro /> },
          { path: '/bienvenue', element: <Welcome /> },
          { path: '/connexion', element: <Phone /> },
          { path: '/connexion/canal', element: <Channel /> },
          { path: '/connexion/code', element: <Code /> },
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
              { path: '/recherche', element: <SearchPage /> },
              { path: '/categorie/:category', element: <CategoryResults /> },
              { path: '/rendez-vous', element: <Bookings /> },
              { path: '/favoris', element: <Favorites /> },
              { path: '/profil', element: <Profile /> },
              { path: '/reglages', element: <Settings /> },
              { path: '/notifications', element: <AccountNotifications /> },
              { path: '/compte', element: <Profile /> },
              { path: '/compte/reservations', element: <Bookings /> },
              { path: '/compte/favoris', element: <Favorites /> },
              { path: '/compte/notifications', element: <AccountNotifications /> },
            ],
          },
          { path: '/carte', element: <MapView /> },
          {
            element: <PlainLayout />,
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
        element: <PlainLayout />,
        children: [
          { path: '/s/:slug', element: <Salon /> },
          { path: '/s/:slug/realisations', element: <SalonWorks /> },
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
              { path: 'onboarding/5', element: <Step5Catalog /> },
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
              { path: 'blocages', element: <Closures /> },
              { path: 'services', element: <ProServices /> },
              { path: 'reservations', element: <Requests /> },
            ],
          },
          {
            element: <ProLayout />,
            children: [
              { index: true, element: <ProHome /> },
              { path: 'agenda', element: <AgendaPro /> },
              { path: 'chiffre-affaires', element: <Revenue /> },
              { path: 'clients', element: <Clients /> },
              { path: 'equipe', element: <Team /> },
              { path: 'prestations', element: <ProServices /> },
              { path: 'profil', element: <ProProfile /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
