/**
 * ANTI-ROBOTS COMMUN (23 nov. 2026, demande du propriétaire : « un anti-robot pour les inscriptions,
 * les connexions et les requêtes »). Un seul mécanisme pour toutes les portes d'entrée :
 * inscription, connexion par mot de passe, liens et codes envoyés (e-mail, WhatsApp), vérification
 * d'adresse.
 *
 * PREUVE DE TRAVAIL : `GET /v1/auth/challenge` rend un casse-tête signé (3 min). Le navigateur
 * cherche `nonce` tel que SHA-256(`<casse-tête>:<sujet>:<nonce>`) commence par `bits` zéros
 * (`apps/web/src/lib/antibot.ts`) — environ une demi-seconde, sans image ni service tiers. Le
 * SUJET est l'adresse e-mail ou le numéro visé : une preuve ne sert pas pour une autre cible.
 * Pour une personne, c'est invisible ; pour un robot qui vise des milliers de comptes, chaque essai
 * coûte du calcul, et les plafonds ci-dessous font le reste.
 *
 * ANCIENNES VERSIONS : une application encore à l'ancien écran n'envoie pas de preuve. Elle passe,
 * mais sous un plafond très bas par adresse IP (`SANS_PREUVE_MAX` par heure et par porte) : un
 * robot qui ne calcule pas est réduit à quelques essais par heure. Une preuve PRÉSENTE mais fausse
 * est toujours refusée.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { config } from '../config';
import { AppError, badRequest } from './errors';

/** 15 bits ≈ 33 000 essais en moyenne. */
export const POW_BITS = 15;
const POW_TTL_MS = 3 * 60_000;
const SANS_PREUVE_MAX = 5;

const key = createHmac('sha256', config.SUPABASE_SECRET_KEY).update('salondz:antibot:v1').digest();
const mac = (s: string) => createHmac('sha256', key).update(s).digest('base64url');

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
    return n + Math.clz32(b) - 24;
  }
  return n;
}

/** Le casse-tête est-il signé par nous, encore valable, et résolu POUR CE sujet ? */
export function checkProof(challenge: string | undefined, nonce: string | undefined, subject: string): boolean {
  if (!challenge || !nonce || nonce.length > 32) return false;
  const parts = challenge.split('.');
  if (parts.length !== 3) return false;
  const [exp, rand, sig] = parts;
  const attendu = Buffer.from(mac(`pow|${exp}.${rand}`));
  const recu = Buffer.from(sig ?? '');
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return false;
  if (!(Number(exp) > Date.now())) return false;
  const h = createHash('sha256').update(`${challenge}:${subject}:${nonce}`).digest();
  return leadingZeroBits(h) >= POW_BITS;
}

/** Compteurs en mémoire (une seule instance API) : clé → instants des derniers passages. */
const traces = new Map<string, number[]>();
export function hit(cle: string, fenetreMs: number): number {
  const now = Date.now();
  const l = (traces.get(cle) ?? []).filter((t) => t > now - fenetreMs);
  l.push(now);
  traces.set(cle, l);
  if (traces.size > 50_000) {
    for (const [k, v] of traces) if (!v.some((t) => t > now - 3_600_000)) traces.delete(k);
  }
  return l.length;
}
export function seen(cle: string, fenetreMs: number): number {
  const now = Date.now();
  return (traces.get(cle) ?? []).filter((t) => t > now - fenetreMs).length;
}
export function forget(cle: string) {
  traces.delete(cle);
}

export type Antibot = { challenge?: string; nonce?: string };

/**
 * Garde d'une porte d'entrée. `porte` nomme la route (compteurs séparés), `sujet` la cible (adresse
 * ou numéro, normalisé). `exiger` : refuser toute requête sans preuve (nouvelles portes, que seuls
 * les écrans à jour appellent).
 */
export function guard(req: FastifyRequest, porte: string, sujet: string, body: Antibot, exiger = false) {
  const { challenge, nonce } = body;
  if (challenge || nonce || exiger) {
    if (!checkProof(challenge, nonce, sujet)) throw badRequest('PROOF_INVALID', 'Vérification de sécurité expirée. Réessayez.');
    return;
  }
  if (hit(`sans-preuve:${porte}:${req.ip}`, 3_600_000) > SANS_PREUVE_MAX) {
    req.log.warn({ porte }, 'antibot : trop de requêtes sans preuve');
    throw new AppError(429, 'RATE_LIMITED', 'Trop de tentatives. Réessayez dans quelques minutes.');
  }
}
