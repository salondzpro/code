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
  /** Synthèse des avis par IA (`lib/reviewSummary.ts`). Absente : pas de synthèse, rien d'autre ne change. */
  ANTHROPIC_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Salon DZ <noreply@salondz.com>'),
  /** Codes de connexion par WhatsApp (`lib/whatsapp.ts`). Absentes : connexion par numéro indisponible. */
  WHATSAPP_TOKEN: z.string().optional(),
  /** Paiement des abonnements des pros (Chargily Pay V2). `test_sk_…` = environnement de test. Absente : paiement en ligne indisponible. */
  CHARGILY_SECRET_KEY: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  /** Compte WhatsApp Business : lecture de l'état du modèle de code (approuvé ou non). */
  WHATSAPP_WABA_ID: z.string().optional(),
  /** Webhook Meta : jeton de vérification de l'abonnement et clé secrète de l'app (signature des envois). */
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  /** `1` : secours par message texte si le modèle manque (TESTS seulement — non livré hors fenêtre de 24 h). */
  WHATSAPP_TEXT_FALLBACK: z
    .string()
    .optional()
    .transform((v) => v === '1'),
  WHATSAPP_TEMPLATE: z.string().default('code_connexion'),
  /** Plafond d'envois de codes WhatsApp par 24 h pour TOUTE la plateforme (chaque message est facturé). */
  WHATSAPP_DAILY_CAP: z.coerce.number().int().positive().default(300),
  /** Sous-plafond quotidien pour les numéros FRANÇAIS (+33), plus chers à l'envoi. */
  WHATSAPP_DAILY_CAP_FR: z.coerce.number().int().positive().default(60),
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
