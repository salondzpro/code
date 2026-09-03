/**
 * Variables publiques Expo (inlinées au build). Elles doivent être dans
 * `apps/mobile/.env` (Expo lit le .env du dossier de l'app, pas celui de la racine).
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Copiez apps/mobile/.env.example vers apps/mobile/.env et renseignez-la.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  /** URL du site web (liens partageables des salons). */
  webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? 'https://salondz.pages.dev',
} as const;
