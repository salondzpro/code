import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { ApiProvider } from '@salondz/api-client';
import './styles/index.css';
import { env } from './lib/env';
import { api } from './lib/api';
import { queryClient } from './lib/query-client';
import { AuthProvider } from './lib/auth';
import { router } from './app/router';

if (env.sentryDsn) {
  // Chargé à la demande : ne pèse pas sur le bundle initial
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({ dsn: env.sentryDsn, environment: env.isDev ? 'development' : 'production', tracesSampleRate: 0.05 });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiProvider api={api}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ApiProvider>
    </QueryClientProvider>
  </StrictMode>,
);
