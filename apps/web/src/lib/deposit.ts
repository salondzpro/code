/**
 * RÉSERVATION AVEC VERSEMENT (14 nov. 2026, migration 0057) — libellés et envoi du justificatif.
 *
 * Le justificatif (capture d'écran du virement ou reçu PDF) part DIRECTEMENT dans le seau privé
 * `deposits`, par une adresse d'envoi signée que l'API délivre pour CE rendez-vous ; l'API vérifie
 * ensuite que le fichier est bien arrivé avant de passer le versement « à vérifier ». Une image est
 * d'abord allégée (WebP, ~600 Ko) : une capture d'iPhone pèse souvent 3 Mo, et la 4G algérienne
 * ne pardonne pas. Un PDF part tel quel.
 */
import { DEPOSIT_PROOF_MAX_BYTES, DEPOSIT_PROOF_TYPES, STORAGE_BUCKETS, formatDA, formatLocale, type DepositMethod } from '@salondz/constants';
import type { ApiClient } from '@salondz/api-client';
import { compressImage } from './upload';
import { supabase } from './supabase';
import { isDemo } from '@/demo/session';
import { t } from '@/i18n';

export const METHOD_LABEL: Record<DepositMethod, string> = {
  ccp: 'CCP · Algérie Poste',
  bank: 'Virement bancaire',
  baridimob: 'BaridiMob',
};

/** Ce qu'on demande au professionnel de saisir, selon le moyen. */
export const ACCOUNT_LABEL: Record<DepositMethod, string> = {
  ccp: 'Numéro de compte CCP et clé',
  bank: 'RIB (20 chiffres)',
  baridimob: 'RIP (20 chiffres)',
};

export const ACCOUNT_PLACEHOLDER: Record<DepositMethod, string> = {
  ccp: '0012345678 clé 90',
  bank: '00400123012345678901',
  baridimob: '00799999001234567890',
};

/** Motifs de refus proposés d'un toucher (le professionnel peut en écrire un autre). */
export const REJECT_REASONS = [
  'Montant incorrect',
  'Reçu illisible',
  'Virement introuvable sur mon compte',
  'Ce n’est pas un reçu de virement',
] as const;

export class ProofError extends Error {}

const ACCEPTED: readonly string[] = DEPOSIT_PROOF_TYPES;

/** Type MIME fiable : certains téléphones donnent un type vide pour une capture HEIC ou un PDF partagé. */
function mimeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'pdf' ? 'application/pdf' : ext === 'heic' ? 'image/heic' : ext === 'png' ? 'image/png' : 'image/jpeg';
}

function toDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Envoie le justificatif d'un rendez-vous et le déclare à l'API. Lève `ProofError` (message en français) si le fichier ne convient pas. */
export async function sendDepositProof(api: ApiClient, bookingId: string, original: File): Promise<void> {
  let type = mimeOf(original);
  if (!ACCEPTED.includes(type)) throw new ProofError(t('Joignez une image (capture d’écran, photo du reçu) ou un PDF.'));
  let file: File = original;
  // Une image est allégée ; un HEIC que le navigateur ne sait pas lire part tel quel.
  if (type.startsWith('image/')) {
    try {
      file = await compressImage(original);
      type = 'image/webp';
    } catch {
      file = original;
    }
  }
  if (file.size > DEPOSIT_PROOF_MAX_BYTES) throw new ProofError(t('Fichier trop lourd (8 Mo au plus). Envoyez une capture d’écran plutôt qu’une photo.'));

  // Démonstration : le justificatif reste dans ce navigateur.
  if (isDemo()) {
    await api.bookings.depositProof(bookingId, await toDataUrl(file));
    return;
  }
  const { path, token } = await api.bookings.depositUploadUrl(bookingId, { contentType: type, size: file.size });
  const up = await supabase.storage.from(STORAGE_BUCKETS.deposits).uploadToSignedUrl(path, token, file, { contentType: type });
  if (up.error) throw new ProofError(t('L’envoi du fichier a échoué. Vérifiez votre connexion et réessayez.'));
  await api.bookings.depositProof(bookingId, path);
}

/** « avant samedi 15 nov. à 14:30 » */
export function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const jour = new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Africa/Algiers' }).format(d);
  const heure = new Intl.DateTimeFormat(formatLocale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Algiers' }).format(d);
  return t('{jour} à {heure}', { jour, heure });
}

/** Ligne de paiement d'un rendez-vous qui porte un versement : ce qui est (ou sera) versé, ce qui reste sur place. */
export function depositPayNote(b: { priceDa: number; depositAmount?: number | null; depositStatus?: string | null }): string | null {
  if (!b.depositAmount || !b.depositStatus) return null;
  const reste = Math.max(0, b.priceDa - b.depositAmount);
  const verse = formatDA(b.depositAmount);
  const base = b.depositStatus === 'accepted' ? t('Versement de {montant} reçu', { montant: verse }) : t('Versement de {montant} à faire', { montant: verse });
  return reste > 0 ? `${base} · ${t('reste {montant} sur place', { montant: formatDA(reste) })}` : base;
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(formatLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}
