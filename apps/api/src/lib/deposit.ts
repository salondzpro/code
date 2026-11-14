/**
 * RÉSERVATION AVEC VERSEMENT (14 nov. 2026, migration 0057) — ce que les routes client et pro partagent.
 *
 * Le compte du salon (`salon_deposit_accounts`) n'est lu QUE par l'API. Les justificatifs vivent dans le
 * seau privé `deposits`, sous `<rendez-vous>/<aléa>.<ext>` : la cliente les y dépose par une adresse
 * d'envoi signée, le salon les lit par une adresse signée de 10 minutes. Aucun fichier n'est public.
 */
import { PENDING_REQUEST_TTL_HOURS, STORAGE_BUCKETS, formatDA } from '@salondz/constants';
import type { DepositAccount, DepositSettings } from '@salondz/types';
import type { FastifyBaseLogger } from 'fastify';
import { db } from './supabase';
import { dispatchPendingPush } from './push';

export const PROOF_URL_TTL_SECONDS = 600;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};
export const proofExt = (type: string) => EXT[type] ?? 'bin';

export async function loadDepositAccount(salonId: string): Promise<DepositAccount | null> {
  const r = await db.from('salon_deposit_accounts').select('method, holder, account, note').eq('salon_id', salonId).maybeSingle();
  if (r.error) throw r.error;
  return (r.data as DepositAccount | null) ?? null;
}

export async function loadDepositSettings(salonId: string): Promise<DepositSettings> {
  const [s, acc] = await Promise.all([
    db.from('salons').select('deposit_mode, deposit_value, deposit_scope').eq('id', salonId).single(),
    loadDepositAccount(salonId),
  ]);
  if (s.error) throw s.error;
  const row = s.data as { deposit_mode: DepositSettings['mode']; deposit_value: number; deposit_scope: DepositSettings['scope'] };
  return {
    mode: row.deposit_mode,
    value: row.deposit_value,
    scope: row.deposit_scope,
    method: acc?.method ?? 'ccp',
    holder: acc?.holder ?? null,
    account: acc?.account ?? null,
    note: acc?.note ?? null,
  };
}

/** Heure limite d'envoi : celle à laquelle le cron expire la demande (24 h après la réservation, ou l'heure du rendez-vous). */
export function depositDeadline(createdAt: string, startsAt: string): string {
  const ttl = new Date(createdAt).getTime() + PENDING_REQUEST_TTL_HOURS * 3_600_000;
  return new Date(Math.min(ttl, new Date(startsAt).getTime())).toISOString();
}

export async function signedProofUrl(path: string): Promise<string> {
  const r = await db.storage.from(STORAGE_BUCKETS.deposits).createSignedUrl(path, PROOF_URL_TTL_SECONDS);
  if (r.error) throw r.error;
  return r.data.signedUrl;
}

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

/** Justificatif reçu → le salon est prévenu (in-app + poussé). Jamais bloquant. */
export async function notifyDepositSubmitted(
  log: FastifyBaseLogger,
  b: { id: string; salonId: string; clientName: string; startsAt: string; depositAmount: number | null },
): Promise<void> {
  try {
    const s = await db.from('salons').select('owner_id').eq('id', b.salonId).single();
    if (s.error) throw s.error;
    const ins = await db.from('notifications').insert({
      user_id: (s.data as { owner_id: string }).owner_id,
      type: 'deposit_submitted',
      title: 'Justificatif de versement reçu',
      body: `${b.clientName} · ${b.depositAmount ? formatDA(b.depositAmount) : ''} · ${fmtWhen(b.startsAt)} · à vérifier pour confirmer`,
      data: { bookingId: b.id, url: `/pro/rendez-vous/${b.id}`, audience: 'pro' },
      booking_id: b.id,
    });
    if (ins.error) throw ins.error;
    await dispatchPendingPush(log, b.id);
  } catch (err) {
    log.error({ err, bookingId: b.id }, 'notifyDepositSubmitted');
  }
}

/** Justificatif refusé → la cliente est prévenue, avec le motif, et peut en renvoyer un. Jamais bloquant. */
export async function notifyDepositRejected(
  log: FastifyBaseLogger,
  b: { id: string; clientId: string | null; bookedBy: string | null; startsAt: string },
  salonName: string,
  reason: string | null,
): Promise<void> {
  const to = [...new Set([b.clientId, b.bookedBy].filter((x): x is string => !!x))];
  if (!to.length) return;
  try {
    const ins = await db.from('notifications').insert(
      to.map((user_id) => ({
        user_id,
        type: 'deposit_rejected',
        title: 'Justificatif à renvoyer',
        body: `${salonName} · ${fmtWhen(b.startsAt)}${reason ? ` · ${reason}` : ''}`,
        data: { bookingId: b.id, url: `/rendez-vous/${b.id}` },
        booking_id: b.id,
      })),
    );
    if (ins.error) throw ins.error;
    await dispatchPendingPush(log, b.id);
  } catch (err) {
    log.error({ err, bookingId: b.id }, 'notifyDepositRejected');
  }
}
