import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  API_PUBLIC_URL: z.string().url().optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SECRET_KEY: z.string().min(10),
  /** Secret legacy HS256 — secours si le token n'est pas signé en ES256 (JWKS). */
  SUPABASE_JWT_SECRET: z.string().optional(),

  /** Origines autorisées (CSV). Vide = toutes en dev, aucune en prod. */
  CORS_ORIGINS: z.string().default(''),
  /** Jeton partagé pour /internal/* (appelé par pg_cron via pg_net). */
  INTERNAL_CRON_TOKEN: z.string().min(8),
  SENTRY_DSN: z.string().optional(),
  /**
   * Web Push (VAPID). Absentes, l'envoi vers les navigateurs est simplement désactivé :
   * le mobile continue de recevoir ses notifications par Expo, et rien ne casse.
   */
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:contact@salondz.dz'),
  /** Comptes de démonstration à accès direct (POST /v1/auth/dev-login). Mettre `0` pour désactiver. */
  TEST_LOGIN_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== '0'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Configuration invalide :');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
export type Config = typeof config;
