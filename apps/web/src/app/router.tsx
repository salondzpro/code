import { createBrowserRouter } from 'react-router';
import { ProShell } from '@/components/ProShell';
import { ClientLayout, PlainLayout, RequireAuth, RequireClient, RequirePro } from './guards';
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
// Pro
import { Dashboard } from '@/pages/pro/Dashboard';
import { Onboarding } from '@/pages/pro/Onboarding';
import { Agenda } from '@/pages/pro/Agenda';
import { Requests } from '@/pages/pro/Requests';
import { Services } from '@/pages/pro/Services';
import { Team } from '@/pages/pro/Team';
import { Hours } from '@/pages/pro/Hours';
import { Blocks } from '@/pages/pro/Blocks';
import { SalonSettings } from '@/pages/pro/SalonSettings';

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
              // anciens chemins
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
          { path: 'onboarding', element: <Onboarding /> },
          {
            element: <ProShell />,
            children: [
              { index: true, element: <Dashboard /> },
              { path: 'agenda', element: <Agenda /> },
              { path: 'reservations', element: <Requests /> },
              { path: 'services', element: <Services /> },
              { path: 'equipe', element: <Team /> },
              { path: 'horaires', element: <Hours /> },
              { path: 'blocages', element: <Blocks /> },
              { path: 'salon', element: <SalonSettings /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
