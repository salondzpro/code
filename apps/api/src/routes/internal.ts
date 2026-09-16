import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { config } from '../config';
import { db } from '../lib/supabase';
import { unauthorized, unwrap } from '../lib/errors';
import { dispatchPendingPush } from '../lib/push';
import { NOTIFICATION_MAX_AGE_DAYS, NOTIFICATION_READ_TTL_DAYS, PENDING_REMINDER_HOURS, PENDING_REQUEST_TTL_HOURS } from '@salondz/constants';
import { notifySlotFreed } from '../lib/waitlist';

/**
 * Tâches périodiques, appelées par pg_cron → pg_net (toutes les 15 min) ou manuellement :
 *   curl -X POST -H "Authorization: Bearer $INTERNAL_CRON_TOKEN" $API/internal/cron/tick
 */
const internalRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', async (req) => {
    const auth = req.headers.authorization ?? '';
    const given = Buffer.from(auth.startsWith('Bearer ') ? auth.slice(7).trim() : '');
    const expected = Buffer.from(config.INTERNAL_CRON_TOKEN);
    // Comparaison en temps constant : pas d'indice sur la longueur ni sur le préfixe correct.
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw unauthorized('Jeton interne invalide');
  });

  // Un seul tick à la fois par instance : deux ticks qui se chevauchent enverraient deux rappels.
  let ticking = false;
  app.post('/cron/tick', { config: { rateLimit: false } }, async (req) => {
    if (ticking) return { skipped: true };
    ticking = true;
    try {
      return await tick(req.log);
    } finally {
      ticking = false;
    }
  });

  async function tick(log: FastifyRequest['log']) {
    const req = { log };
    const now = Date.now();

    // 1) Rappels J-1 (fenêtre 23h–25h avant le début)
    const remRes = await db
      .from('bookings')
      .select('id, client_id, service_name, starts_at, salons(name)')
      .eq('status', 'confirmed')
      .is('reminder_sent_at', null)
      .not('client_id', 'is', null)
      .gte('starts_at', new Date(now + 23 * 3_600_000).toISOString())
      .lt('starts_at', new Date(now + 25 * 3_600_000).toISOString())
      .limit(500);
    const toRemind = unwrap(remRes) as unknown as { id: string; client_id: string; service_name: string; starts_at: string; salons: { name: string } | null }[];
    if (toRemind.length) {
      const ins = await db.from('notifications').insert(
        toRemind.map((b) => ({
          user_id: b.client_id,
          type: 'booking_reminder',
          title: 'Rappel : rendez-vous demain',
          body: `${b.salons?.name ?? 'Votre salon'} · ${b.service_name} · ${fmtWhen(b.starts_at)}`,
          data: { bookingId: b.id },
          booking_id: b.id,
        })),
      );
      if (ins.error) throw ins.error;
      const upd = await db.from('bookings').update({ reminder_sent_at: new Date().toISOString() }).in('id', toRemind.map((b) => b.id));
      if (upd.error) throw upd.error;
    }

    // 2) Clôture automatique des RDV confirmés terminés depuis > 3 h
    const doneRes = await db
      .from('bookings')
      .update({ status: 'completed' })
      .eq('status', 'confirmed')
      .lt('ends_at', new Date(now - 3 * 3_600_000).toISOString())
      .select('id');
    const completed = unwrap(doneRes) as { id: string }[];

    // 3a) Relance du professionnel : une demande attend sa réponse depuis PENDING_REMINDER_HOURS et le
    //     rendez-vous n'est pas passé. Une seule relance par demande.
    const remindRes = await db
      .from('bookings')
      .select('id, client_name, service_name, starts_at, salons(owner_id, name)')
      .eq('status', 'pending')
      .is('pro_reminded_at', null)
      .lt('created_at', new Date(now - PENDING_REMINDER_HOURS * 3_600_000).toISOString())
      .gt('starts_at', new Date(now).toISOString())
      .limit(200);
    const toNudge = unwrap(remindRes) as unknown as { id: string; client_name: string; service_name: string; starts_at: string; salons: { owner_id: string; name: string } | null }[];
    if (toNudge.length) {
      const ins = await db.from('notifications').insert(
        toNudge
          .filter((b) => b.salons?.owner_id)
          .map((b) => ({
            user_id: b.salons!.owner_id,
            type: 'request_pending',
            title: 'Une demande attend votre réponse',
            body: `${b.client_name} · ${b.service_name} · ${fmtWhen(b.starts_at)} · le créneau reste bloqué jusqu'à votre réponse`,
            data: { bookingId: b.id, url: `/pro/rendez-vous/${b.id}` },
            booking_id: b.id,
          })),
      );
      if (ins.error) throw ins.error;
      const upd = await db.from('bookings').update({ pro_reminded_at: new Date().toISOString() }).in('id', toNudge.map((b) => b.id));
      if (upd.error) throw upd.error;
    }

    // 3b) Demandes (validation manuelle) jamais traitées : expirées une fois l'heure passée OU au bout
    //     de PENDING_REQUEST_TTL_HOURS sans réponse, pour ne pas geler le créneau ; le trigger prévient
    //     le client, et le créneau libéré est proposé à la liste d'attente.
    const expiredRes = await db
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'system',
        cancellation_reason: 'Demande non confirmée à temps',
      })
      .eq('status', 'pending')
      .or(`starts_at.lt.${new Date(now).toISOString()},created_at.lt.${new Date(now - PENDING_REQUEST_TTL_HOURS * 3_600_000).toISOString()}`)
      .select('id, salon_id, staff_id, service_id, starts_at, ends_at');
    const expired = unwrap(expiredRes) as { id: string; salon_id: string; staff_id: string | null; service_id: string | null; starts_at: string; ends_at: string }[];
    for (const b of expired) await notifySlotFreed(log, { salonId: b.salon_id, staffId: b.staff_id, startsAt: b.starts_at, endsAt: b.ends_at, serviceId: b.service_id, excludeBookingId: b.id });

    // 4) Push en attente (rattrape aussi les notifs créées hors API)
    const pushed = await dispatchPendingPush(req.log);

    // 5) Purge des notifications : une notification est une information du moment, pas une
    //    archive. Lue depuis plus de NOTIFICATION_READ_TTL_DAYS jours → supprimée ; non lue
    //    mais vieille de plus de NOTIFICATION_MAX_AGE_DAYS jours → supprimée quand même. La
    //    table ne grossit jamais sans fin, et la liste reste celle des derniers jours.
    const purgedRead = await db
      .from('notifications')
      .delete({ count: 'exact' })
      .lt('read_at', new Date(now - NOTIFICATION_READ_TTL_DAYS * 86_400_000).toISOString());
    if (purgedRead.error) throw purgedRead.error;
    const purgedOld = await db
      .from('notifications')
      .delete({ count: 'exact' })
      .lt('created_at', new Date(now - NOTIFICATION_MAX_AGE_DAYS * 86_400_000).toISOString());
    if (purgedOld.error) throw purgedOld.error;
    const purged = (purgedRead.count ?? 0) + (purgedOld.count ?? 0);

    return { reminders: toRemind.length, autoCompleted: completed.length, expired: expired.length, pushed, purged };
  }
};

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

export default internalRoutes;
