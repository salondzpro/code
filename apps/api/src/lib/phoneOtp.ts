/**
 * RÈGLES DES CODES DE CONNEXION PAR WHATSAPP (23 nov. 2026, demande du propriétaire : « limite les
 * renvois, prolonge la durée, sécurité très renforcée contre les robots, comme Uber »).
 *
 * Chaque message WhatsApp est FACTURÉ par Meta : un robot qui demande des codes en boucle (« SMS
 * pumping ») vide le budget. Défenses, de la moins chère à la plus chère pour l'attaquant :
 *   1. Numéro MOBILE algérien seulement (+213 5/6/7, 9 chiffres) — aucun fixe, aucun étranger.
 *   2. PREUVE DE TRAVAIL invisible (module commun `lib/antibot.ts`) : avant chaque envoi, le téléphone calcule un petit casse-tête
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
import { createHmac } from 'node:crypto';
import { config } from '../config';

export { checkProof, newChallenge } from './antibot';

export const CODE_TTL_MIN = 15;
export const CODE_MAX_ATTEMPTS = 5;
/** Attente imposée APRÈS le n-ième envoi de l'heure (en secondes). */
export const RESEND_WAIT_S = [60, 180, 600];
export const PHONE_MAX_PER_HOUR = 3;
export const PHONE_MAX_PER_DAY = 5;
export const IP_MAX_PER_HOUR = 5;
export const IP_MAX_PER_DAY = 12;

const key = createHmac('sha256', config.SUPABASE_SECRET_KEY).update('salondz:whatsapp-otp:v2').digest();

/** Empreinte du code stockée en base (jamais le code). */
export const codeHash = (phone: string, role: string, code: string) =>
  createHmac('sha256', key).update(`code|${phone}|${role}|${code}`).digest('base64url');

/** Mobile algérien : +213 suivi de 5, 6 ou 7 et de 8 chiffres. */
export const isDzMobile = (phone: string) => /^\+213[567]\d{8}$/.test(phone);

/** Secondes à attendre avant le prochain envoi, d'après les envois de la dernière heure. */
export function waitAfter(sentLastHour: number, lastSentAt: Date | null): number {
  if (!lastSentAt || sentLastHour === 0) return 0;
  const wait = RESEND_WAIT_S[Math.min(sentLastHour, RESEND_WAIT_S.length) - 1] ?? 600;
  return Math.max(0, Math.ceil((lastSentAt.getTime() + wait * 1000 - Date.now()) / 1000));
}
