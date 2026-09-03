import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Client "admin" (clé secrète) : contourne la RLS.
 * Toute la logique d'autorisation est donc dans les routes (preHandlers).
 */
export const db: SupabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { 'x-application-name': 'salondz-api' } },
});

/** Client "utilisateur" (clé publique + JWT) : respecte la RLS — utile pour des lectures déléguées. */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
