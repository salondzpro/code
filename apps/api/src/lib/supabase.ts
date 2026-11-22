import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Client "admin" (clé secrète) : contourne la RLS.
 * Toute la logique d'autorisation est donc dans les routes (preHandlers).
 */
/** Toute requête vers Supabase expire : une base lente ne doit pas empiler les requêtes jusqu'à saturer l'instance. */
const fetchOnce: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) });

/**
 * « JWT issued at future » (PGRST303, 21 nov. 2026, vu dans les journaux de prod) : Supabase change
 * la clé secrète en un jeton daté à la seconde ; quand l'horloge de la base retarde d'un instant, elle
 * le refuse — la page d'un salon répondait alors 500 au hasard. On réessaie (deux fois au plus, après
 * 400 puis 900 ms) : le jeton suivant passe. Rien d'autre n'est rejoué (le corps est une chaîne).
 */
const fetchWithTimeout: typeof fetch = async (input, init) => {
  for (let essai = 0; ; essai++) {
    const res = await fetchOnce(input, init);
    if (res.status !== 401 || essai >= 2) return res;
    const texte = await res.clone().text().catch(() => '');
    if (!texte.includes('PGRST303')) return res;
    await new Promise((r) => setTimeout(r, essai === 0 ? 400 : 900));
  }
};

export const db: SupabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { 'x-application-name': 'salondz-api' }, fetch: fetchWithTimeout },
});

/** Client "utilisateur" (clé publique + JWT) : respecte la RLS — utile pour des lectures déléguées. */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
