/**
 * État du parcours de connexion (AUTH 04 → 12) partagé entre les écrans, et visuels
 * repris du design (photos Unsplash référencées dans le fichier Claude Design).
 */
import type { UserRole } from '@salondz/constants';
import type { OtpChannel } from './auth';

const KEY = 'salondz:authFlow';

export interface AuthFlowState {
  role: UserRole;
  /** Numéro E.164 (+213…) ou e-mail si canal e-mail. */
  identifier: string;
  channel: OtpChannel;
  /** Où aller après la connexion. */
  next: string;
  sentAt?: number;
}

export function readAuthFlow(): AuthFlowState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthFlowState) : null;
  } catch {
    return null;
  }
}

export function writeAuthFlow(patch: Partial<AuthFlowState>): AuthFlowState {
  const next = { role: 'client' as UserRole, identifier: '', channel: 'whatsapp' as OtpChannel, next: '/', ...readAuthFlow(), ...patch };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : le parcours continue en mémoire */
  }
  return next;
}

export function clearAuthFlow(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** « +213 6 61 24 87 90 » (présentation du design) à partir d'un E.164. */
export function formatIntlDZ(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  const local = digits.startsWith('213') ? digits.slice(3) : digits.replace(/^0/, '');
  if (local.length !== 9) return e164;
  return `+213 ${local[0]} ${local.slice(1, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

/** « 6 61 24 87 90 » : 9 chiffres saisis après +213, groupés comme dans le design. */
export function groupLocalDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 9);
  const parts = [d.slice(0, 1), d.slice(1, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(' ');
}

/** Le secours e-mail n'est proposé que si le projet Supabase n'a pas de fournisseur SMS (VITE_AUTH_EMAIL_FALLBACK=1). */
export const EMAIL_FALLBACK = import.meta.env.VITE_AUTH_EMAIL_FALLBACK === '1' || import.meta.env.DEV;

export const DESIGN_IMAGES = {
  intro: { src: 'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=900&q=75&auto=format&fit=crop', credit: 'Benyamin Bohlouli · Unsplash' },
  welcomeBack: { src: 'https://images.unsplash.com/photo-1554519934-e32b1629d9ee?w=400&q=75&auto=format&fit=crop', credit: 'Jessie Dee Dabrowski · Unsplash' },
  marketMen: { src: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&q=75&auto=format&fit=crop', credit: 'Photo by Allef Vinicius on Unsplash' },
  marketWomen: { src: 'https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=900&q=75&auto=format&fit=crop', credit: 'Photo by Lindsay Cash on Unsplash' },
  pro: { src: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=900&q=75&auto=format&fit=crop', credit: 'Nathon Oski · Unsplash' },
} as const;
