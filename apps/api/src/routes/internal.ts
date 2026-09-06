import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { config } from '../config';
import { db } from '../lib/supabase';
import { unauthorized, unwrap } from '../lib/errors';
import { dispatchPendingPush } from '../lib/push';

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

  app.post('/cron/tick', { config: { rateLimit: false } }, async (req) => {
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

    // 3) Demandes (validation manuelle) jamais traitées : expirées une fois l'heure passée,
    //    pour ne pas rester « en attente » à vie ; le trigger prévient le client.
    const expiredRes = await db
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'system',
        cancellation_reason: 'Demande non confirmée à temps',
      })
      .eq('status', 'pending')
      .lt('starts_at', new Date(now).toISOString())
      .select('id');
    const expired = unwrap(expiredRes) as { id: string }[];

    // 4) Push en attente (rattrape aussi les notifs créées hors API)
    const pushed = await dispatchPendingPush(req.log);

    return { reminders: toRemind.length, autoCompleted: completed.length, expired: expired.length, pushed };
  });
};

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

export default internalRoutes;
