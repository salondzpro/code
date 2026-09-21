import { createApiClient } from '@salondz/api-client';
import { env } from './env';
import { supabase } from './supabase';
import { isDemo } from '@/demo/session';
import { actingAsToken } from './actingAs';

export const api = createApiClient({
  baseUrl: env.apiUrl,
  timeoutMs: 15_000,
  /**
   * Démonstration : tout est servi dans le navigateur (aucune requête ne part). Le moteur
   * (monde, règles, routeur) est chargé À LA DEMANDE : un visiteur ordinaire ne télécharge
   * jamais ce code.
   */
  fetch: async (input, init) => {
    if (!isDemo()) return fetch(input, init);
    const { demoFetch } = await import('@/demo/fetch');
    return demoFetch(input, init);
  },
  /**
   * Un administrateur qui pilote l'espace d'un professionnel : le jeton n'a d'effet que derrière
   * `requireAdmin`, côté serveur, qui le vérifie à chaque requête et journalise chaque écriture.
   */
  actingAsToken: () => (isDemo() ? null : actingAsToken()),
  getAccessToken: async () => {
    if (isDemo()) return 'demo';
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
  // Jeton refusé (session révoquée, expirée, mot de passe changé ailleurs) : on repart de la connexion
  // en gardant la page visée, au lieu de laisser un écran « Accès refusé » sans issue.
  onUnauthorized: () => {
    if (isDemo()) return;
    void supabase.auth.signOut().finally(() => {
      const next = window.location.pathname + window.location.search;
      window.location.assign(`/connexion?next=${encodeURIComponent(next)}`);
    });
  },
});
