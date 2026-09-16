import { createApiClient } from '@salondz/api-client';
import { env } from './env';
import { supabase } from './supabase';

export const api = createApiClient({
  baseUrl: env.apiUrl,
  timeoutMs: 15_000,
  getAccessToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
  // Jeton refusé (session révoquée, expirée, mot de passe changé ailleurs) : on repart de la connexion
  // en gardant la page visée, au lieu de laisser un écran « Accès refusé » sans issue.
  onUnauthorized: () => {
    void supabase.auth.signOut().finally(() => {
      const next = window.location.pathname + window.location.search;
      window.location.assign(`/connexion?next=${encodeURIComponent(next)}`);
    });
  },
});
