import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/** Client navigateur (clé publique) : auth, realtime (affichage), storage. */
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'salondz-auth',
  },
  realtime: { params: { eventsPerSecond: 5 } },
});
