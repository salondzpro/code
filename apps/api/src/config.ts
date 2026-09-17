import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  /** Origine publique de l'API (liens des e-mails). OBLIGATOIRE en production : jamais déduite de l'en-tête Host. */
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
  /** Code d'accès de `salondz.com/moi` (plan de production en ligne). */
  PLAN_ACCESS_CODE: z.string().min(3).max(40).default('123'),
  SENTRY_DSN: z.string().optional(),
  /**
   * Web Push (VAPID). Absentes, l'envoi vers les navigateurs est simplement désactivé :
   * le mobile continue de recevoir ses notifications par Expo, et rien ne casse.
   */
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:contact@salondz.com'),
  /** E-mails transactionnels via Resend (confirmation, lien de connexion, mot de passe). Absente : envoi refusé proprement. */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Salon DZ <noreply@salondz.com>'),
  /** Adresse de réponse des e-mails transactionnels (boîte lue par l'équipe). */
  EMAIL_REPLY_TO: z.string().default('support@salondz.com'),
  /** Origine du site web (liens envoyés par e-mail). Absente : première origine CORS en https. */
  WEB_URL: z.string().url().optional(),
  /** Comptes de démonstration à accès direct (POST /v1/auth/dev-login). DÉSACTIVÉS sauf `TEST_LOGIN_ENABLED=1` explicite. */
  TEST_LOGIN_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === '1'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Configuration invalide :');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && !parsed.data.API_PUBLIC_URL) {
  console.error('❌ API_PUBLIC_URL est obligatoire en production (origine des liens envoyés par e-mail).');
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  webUrl:
    parsed.data.WEB_URL ??
    parsed.data.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('https://'))[0] ??
    parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)[0] ??
    'http://localhost:9000',
};
export type Config = typeof config;
