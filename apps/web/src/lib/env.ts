import { z } from 'zod';

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  VITE_API_URL: z.string().url(),
  VITE_SENTRY_DSN: z.string().optional(),
  /** Clé publique VAPID : sans elle, les notifications navigateur sont simplement indisponibles. */
  VITE_VAPID_PUBLIC_KEY: z.string().optional(),
  /** Origine publique du site (liens partagés, QR, retours d'e-mail). Défaut : salondz.com en production, l'origine courante en dev. */
  VITE_PUBLIC_SITE_URL: z.string().url().optional(),
});

/** Adresse dédiée du portail d'administration (voir `docs/ADMIN.md`). */
export const ADMIN_HOST = 'admin.salondz.com';

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
  vapidPublicKey: parsed.data.VITE_VAPID_PUBLIC_KEY ?? null,
  sentryDsn: parsed.data.VITE_SENTRY_DSN || undefined,
  isDev: import.meta.env.DEV,
  /** Toujours le domaine officiel : un pro qui navigue sur l'ancienne adresse onrender partage quand même salondz.com. */
  siteUrl: (parsed.data.VITE_PUBLIC_SITE_URL ?? (import.meta.env.DEV ? window.location.origin : 'https://salondz.com')).replace(/\/$/, ''),
  /**
   * Le portail d'administration a sa propre adresse. Elle sert la MÊME application : ouvrir
   * `admin.salondz.com` revient à ouvrir `salondz.com/admin`, et le garde reste celui du serveur.
   * Ce n'est qu'une porte d'entrée plus courte à taper et à retenir.
   */
  adminHost: window.location.hostname === ADMIN_HOST,
};
