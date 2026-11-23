/**
 * RÈGLES DES CODES DE CONNEXION PAR WHATSAPP (23 nov. 2026, demande du propriétaire : « limite les
 * renvois, prolonge la durée, sécurité très renforcée contre les robots, comme Uber »).
 *
 * Chaque message WhatsApp est FACTURÉ par Meta : un robot qui demande des codes en boucle (« SMS
 * pumping ») vide le budget. Défenses, de la moins chère à la plus chère pour l'attaquant :
 *   1. Numéro MOBILE algérien seulement (+213 5/6/7, 9 chiffres) — aucun fixe, aucun étranger.
 *   2. PREUVE DE TRAVAIL invisible : avant chaque envoi, le téléphone calcule un petit casse-tête
 *      (quelques dixièmes de seconde pour une personne, des heures de calcul pour un robot qui en
 *      veut des milliers), lié au numéro et valable 3 minutes. Aucun service tiers, aucune image.
 *   3. Délais CROISSANTS entre deux envois au même numéro (1 min, 3 min, 10 min) ; 3 envois par heure
 *      et 5 par jour et par numéro.
 *   4. Par adresse IP : 5 envois par heure, 12 par jour (tous numéros confondus).
 *   5. Plafond GLOBAL par jour (`WHATSAPP_DAILY_CAP`) : au-delà, plus aucun envoi — la connexion par
 *      e-mail reste ouverte. Un incident coûte au plus ce plafond.
 *   6. Le code vit 15 minutes (moins de renvois « je ne l'ai pas encore reçu ») ; 5 essais par code,
 *      puis il est brûlé ; un code ne sert qu'une fois ; seul le dernier envoyé est valable.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

export const CODE_TTL_MIN = 15;
export const CODE_MAX_ATTEMPTS = 5;
/** Attente imposée APRÈS le n-ième envoi de l'heure (en secondes). */
export const RESEND_WAIT_S = [60, 180, 600];
export const PHONE_MAX_PER_HOUR = 3;
export const PHONE_MAX_PER_DAY = 5;
export const IP_MAX_PER_HOUR = 5;
export const IP_MAX_PER_DAY = 12;
/** Bits à zéro exigés en tête de l'empreinte (15 ≈ 33 000 essais en moyenne). */
export const POW_BITS = 15;
const POW_TTL_MS = 3 * 60_000;

const key = createHmac('sha256', config.SUPABASE_SECRET_KEY).update('salondz:whatsapp-otp:v2').digest();
const mac = (s: string) => createHmac('sha256', key).update(s).digest('base64url');

/** Empreinte du code stockée en base (jamais le code). */
export const codeHash = (phone: string, role: string, code: string) => mac(`code|${phone}|${role}|${code}`);

/** Mobile algérien : +213 suivi de 5, 6 ou 7 et de 8 chiffres. */
export const isDzMobile = (phone: string) => /^\+213[567]\d{8}$/.test(phone);

/** Nouveau casse-tête : `<échéance>.<aléa>.<signature>`. */
export function newChallenge() {
  const exp = Date.now() + POW_TTL_MS;
  const body = `${exp}.${randomBytes(12).toString('base64url')}`;
  return { challenge: `${body}.${mac(`pow|${body}`)}`, bits: POW_BITS };
}

function leadingZeroBits(buf: Buffer) {
  let n = 0;
  for (const b of buf) {
    if (b === 0) {
      n += 8;
      continue;
    }
    n += Math.clz32(b) - 24;
    break;
  }
  return n;
}

/** Le casse-tête est-il signé par nous, encore valable, et résolu POUR CE numéro ? */
export function checkProof(challenge: string | undefined, nonce: string | undefined, phone: string): boolean {
  if (!challenge || !nonce || nonce.length > 32) return false;
  const parts = challenge.split('.');
  if (parts.length !== 3) return false;
  const [exp, rand, sig] = parts;
  const attendu = Buffer.from(mac(`pow|${exp}.${rand}`));
  const recu = Buffer.from(sig ?? '');
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return false;
  if (!(Number(exp) > Date.now())) return false;
  const h = createHash('sha256').update(`${challenge}:${phone}:${nonce}`).digest();
  return leadingZeroBits(h) >= POW_BITS;
}

/** Secondes à attendre avant le prochain envoi, d'après les envois de la dernière heure. */
export function waitAfter(sentLastHour: number, lastSentAt: Date | null): number {
  if (!lastSentAt || sentLastHour === 0) return 0;
  const wait = RESEND_WAIT_S[Math.min(sentLastHour, RESEND_WAIT_S.length) - 1] ?? 600;
  return Math.max(0, Math.ceil((lastSentAt.getTime() + wait * 1000 - Date.now()) / 1000));
}
