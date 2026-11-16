/**
 * Adresse INTERNE du compte d'un portail quand la vraie adresse sert déjà à un compte de l'autre côté
 * (16 nov. 2026, voir `@salondz/constants` → `alias.ts`). MÊME calcul que l'API (`routes/auth.ts`) :
 * `<rôle>-<24 premiers hex de SHA-256(adresse en minuscules)>@alias.salondz.com`.
 */
import { ALIAS_DOMAIN, isAliasEmail } from '@salondz/constants';
import type { User } from '@supabase/supabase-js';

export async function aliasEmail(email: string, role: 'client' | 'pro'): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${role}-${hex.slice(0, 24)}@${ALIAS_DOMAIN}`;
}

/** L'adresse à MONTRER : la vraie (`contact_email`) pour un compte interne, jamais l'interne. */
export function visibleEmail(user: Pick<User, 'email' | 'user_metadata'> | null | undefined): string | null {
  if (!user?.email) return null;
  if (!isAliasEmail(user.email)) return user.email;
  const contact = user.user_metadata?.contact_email;
  return typeof contact === 'string' ? contact : null;
}
