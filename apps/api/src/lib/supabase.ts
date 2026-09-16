import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Client "admin" (clé secrète) : contourne la RLS.
 * Toute la logique d'autorisation est donc dans les routes (preHandlers).
 */
/** Toute requête vers Supabase expire : une base lente ne doit pas empiler les requêtes jusqu'à saturer l'instance. */
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) });

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
