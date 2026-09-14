import { createClient } from '@supabase/supabase-js';
import { REALTIME_EVENTS_PER_SECOND } from '@salondz/constants';
import { env } from './env';

/** Client navigateur (clé publique) : auth, realtime (affichage), storage. */
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    /**
     * Flux IMPLICITE : le lien reçu par e-mail porte la session (jetons dans le fragment de
     * l'URL) et fonctionne depuis n'importe quel navigateur. En PKCE, le lien n'ouvrait de
     * session que dans le navigateur qui l'avait demandé : ouvert depuis l'application
     * Gmail ou un autre navigateur, il retombait sur la connexion.
     */
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'salondz-auth',
  },
  realtime: { params: { eventsPerSecond: REALTIME_EVENTS_PER_SECOND } },
});
