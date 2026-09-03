import { createBrowserRouter } from 'react-router';
import { AppShell } from '@/components/AppShell';
import { ProShell } from '@/components/ProShell';
import { RequireAuth, RequirePro } from './guards';
import { ErrorBoundary } from '@/pages/ErrorBoundary';
import { NotFound } from '@/pages/NotFound';
import { Home } from '@/pages/Home';
import { Search } from '@/pages/Search';
import { SalonPage } from '@/pages/SalonPage';
import { BookingFlow } from '@/pages/BookingFlow';
import { Login } from '@/pages/Login';
import { Account } from '@/pages/Account';
import { AccountBookings } from '@/pages/AccountBookings';
import { AccountNotifications } from '@/pages/AccountNotifications';
import { AccountFavorites } from '@/pages/AccountFavorites';
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
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <Home /> },
      { path: 'recherche', element: <Search /> },
      { path: 's/:slug', element: <SalonPage /> },
      { path: 's/:slug/reserver', element: <BookingFlow /> },
      { path: 'connexion', element: <Login /> },
      {
        path: 'compte',
        element: <RequireAuth />,
        children: [
          { index: true, element: <Account /> },
          { path: 'reservations', element: <AccountBookings /> },
          { path: 'notifications', element: <AccountNotifications /> },
          { path: 'favoris', element: <AccountFavorites /> },
        ],
      },
      {
        path: 'pro',
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
