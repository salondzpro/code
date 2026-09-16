/**
 * Démarrage de l'application, importé À LA DEMANDE par main.tsx une fois le dictionnaire de la langue
 * chargé : les modules qui traduisent au chargement (libellés de navigation, états vides) lisent
 * ainsi la bonne langue dès leur première évaluation.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { ApiProvider } from '@salondz/api-client';
import { api } from '../lib/api';
import { queryClient } from '../lib/query-client';
import { AuthProvider } from '../lib/auth';
import { router } from './router';

export function render(): void {
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
}
