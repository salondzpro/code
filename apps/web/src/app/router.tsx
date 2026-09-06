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
// Client
import { Home } from '@/pages/Home';
import { Search } from '@/pages/Search';
import { SalonPage } from '@/pages/SalonPage';
import { BookingFlow } from '@/pages/BookingFlow';
import { Account } from '@/pages/Account';
import { AccountBookings } from '@/pages/AccountBookings';
import { AccountNotifications } from '@/pages/AccountNotifications';
import { AccountFavorites } from '@/pages/AccountFavorites';
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
      // ---- Espace client (onglets Marketplace · Rendez-vous · Profil) ----
      {
        element: <RequireClient />,
        children: [
          {
            element: <ClientLayout />,
            children: [
              { path: '/', element: <Home /> },
              { path: '/recherche', element: <Search /> },
              { path: '/rendez-vous', element: <AccountBookings /> },
              { path: '/profil', element: <Account /> },
              { path: '/favoris', element: <AccountFavorites /> },
              { path: '/notifications', element: <AccountNotifications /> },
              // anciens chemins
              { path: '/compte', element: <Account /> },
              { path: '/compte/reservations', element: <AccountBookings /> },
              { path: '/compte/notifications', element: <AccountNotifications /> },
              { path: '/compte/favoris', element: <AccountFavorites /> },
            ],
          },
        ],
      },
      // ---- Pages salon (publiques : lisibles sans compte, réservation avec compte) ----
      {
        element: <PlainLayout />,
        children: [
          { path: '/s/:slug', element: <SalonPage /> },
          { path: '/s/:slug/reserver', element: <BookingFlow /> },
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
