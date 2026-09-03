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
});
