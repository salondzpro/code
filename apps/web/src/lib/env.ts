import { z } from 'zod';

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  VITE_API_URL: z.string().url(),
  VITE_SENTRY_DSN: z.string().optional(),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  // Affiché en console uniquement : évite un écran blanc silencieux en dev.
  console.error('Variables VITE_* manquantes ou invalides :', parsed.error.flatten().fieldErrors);
  throw new Error('Configuration front invalide (voir .env.example)');
}

export const env = {
  supabaseUrl: parsed.data.VITE_SUPABASE_URL,
  supabasePublishableKey: parsed.data.VITE_SUPABASE_PUBLISHABLE_KEY,
  apiUrl: parsed.data.VITE_API_URL,
  sentryDsn: parsed.data.VITE_SENTRY_DSN || undefined,
  isDev: import.meta.env.DEV,
};
