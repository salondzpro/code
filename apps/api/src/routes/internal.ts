import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { config } from '../config';
import { db } from '../lib/supabase';
import { unauthorized, unwrap } from '../lib/errors';
import { dispatchPendingPush } from '../lib/push';
import { CLIENT_REMINDER_MINUTES, NOTIFICATION_MAX_AGE_DAYS, NOTIFICATION_READ_TTL_DAYS, PENDING_REMINDER_HOURS, PENDING_REQUEST_TTL_HOURS, PRO_REMINDER_LEAD_MINUTES } from '@salondz/constants';
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

  /** Les deux rappels du client : délai visé, colonne qui dit « celui-ci est parti », et son titre. */
  const CLIENT_REMINDERS = [
    { minutes: CLIENT_REMINDER_MINUTES[0], colonne: 'reminder_1h_sent_at', titre: 'Rappel : rendez-vous dans 1 h' },
    { minutes: CLIENT_REMINDER_MINUTES[1], colonne: 'reminder_30m_sent_at', titre: 'Rappel : rendez-vous dans 30 min' },
  ] as const;

  async function tick(log: FastifyRequest['log']) {
    const req = { log };
    const now = Date.now();

    /**
     * 1) Rappels du CLIENT : une heure avant, puis trente minutes avant.
     *
     * Ils partaient la veille et deux heures avant. Un rappel la veille arrive trop tôt pour changer
     * la journée, et deux heures avant on est déjà engagé ailleurs ; une heure puis trente minutes,
     * c'est là qu'il sert encore à partir à temps ou à prévenir le salon.
     *
     * Les deux passages sont le MÊME travail à un délai près — ils étaient écrits deux fois, et la
     * moindre correction devait être faite aux deux endroits. La fenêtre va de 5 min avant à 10 min
     * après l'heure visée : le cron bat toutes les 10 minutes, aucun rendez-vous ne peut la
     * traverser sans être vu, et un tick sauté ne fait rien manquer.
     *
     * Le réglage « Rappels de rendez-vous » du client est respecté ici ; les rendez-vous de ceux qui
     * les ont coupés sont tout de même marqués traités, pour ne pas les repasser en revue à chaque
     * tick.
     */
    const envoyes: Record<string, number> = {};
    for (const rappel of CLIENT_REMINDERS) {
      const res = await db
        .from('bookings')
        .select('id, client_id, service_name, starts_at, salons(name)')
        .eq('status', 'confirmed')
        .is(rappel.colonne, null)
        .not('client_id', 'is', null)
        .gte('starts_at', new Date(now + (rappel.minutes - 5) * 60_000).toISOString())
        .lt('starts_at', new Date(now + (rappel.minutes + 10) * 60_000).toISOString())
        .limit(500);
      const dus = unwrap(res) as unknown as { id: string; client_id: string; service_name: string; starts_at: string; salons: { name: string } | null }[];
      if (!dus.length) continue;

      const prefs = await db.from('profiles').select('id, reminders_enabled').in('id', [...new Set(dus.map((b) => b.client_id))]).eq('reminders_enabled', false);
      if (prefs.error) throw prefs.error;
      const coupes = new Set((prefs.data ?? []).map((p) => p.id as string));
      const aPrevenir = dus.filter((b) => !coupes.has(b.client_id));

      if (aPrevenir.length) {
        const ins = await db.from('notifications').insert(
          aPrevenir.map((b) => ({
            user_id: b.client_id,
            type: 'booking_reminder',
            title: rappel.titre,
            body: `${b.salons?.name ?? 'Votre salon'} · ${b.service_name} · ${fmtWhen(b.starts_at)}`,
            data: { bookingId: b.id },
            booking_id: b.id,
          })),
        );
        if (ins.error) throw ins.error;
      }
      envoyes[rappel.colonne] = aPrevenir.length;
      const upd = await db.from('bookings').update({ [rappel.colonne]: new Date().toISOString() }).in('id', dus.map((b) => b.id));
      if (upd.error) throw upd.error;
    }

    // 1c) Rappel au PROFESSIONNEL : une notification PRO_REMINDER_LEAD_MINUTES avant chaque rendez-vous
    //     confirmé, envoyée au propriétaire du salon. Fenêtre de 20 à 70 min avant le début : on ne rate
    //     rien si un tick a sauté, et on n'envoie jamais un rappel pour un rendez-vous déjà imminent.
    //     Un rendez-vous pris peu avant l'heure du rappel (le pro vient d'être prévenu par la réservation
    //     elle-même) est marqué traité sans rien envoyer. Pas d'interrupteur : le réglage « Rappels » est
    //     celui du CLIENT, et un professionnel n'a aucun écran pour le rallumer.
    const remProRes = await db
      .from('bookings')
      .select('id, client_name, service_name, starts_at, created_at, salons(owner_id)')
      .eq('status', 'confirmed')
      .is('reminder_pro_sent_at', null)
      .gte('starts_at', new Date(now + 20 * 60_000).toISOString())
      .lt('starts_at', new Date(now + (PRO_REMINDER_LEAD_MINUTES + 10) * 60_000).toISOString())
      .limit(500);
    const dueForPro = unwrap(remProRes) as unknown as { id: string; client_name: string; service_name: string; starts_at: string; created_at: string; salons: { owner_id: string } | null }[];
    const proCutoff = (PRO_REMINDER_LEAD_MINUTES + 15) * 60_000;
    const toRemindPro = dueForPro.filter((b) => b.salons?.owner_id && new Date(b.starts_at).getTime() - new Date(b.created_at).getTime() > proCutoff);
    if (dueForPro.length) {
      if (toRemindPro.length) {
        const ins = await db.from('notifications').insert(
          toRemindPro.map((b) => ({
            user_id: b.salons!.owner_id,
            type: 'booking_reminder',
            title: 'Rendez-vous dans 1 h',
            body: `${b.client_name} · ${b.service_name} · à ${fmtTime(b.starts_at)}`,
            // `audience: 'pro'` : le type est partagé avec le rappel client, l'application s'en sert pour
            // ouvrir la fiche côté professionnel.
            data: { bookingId: b.id, audience: 'pro', url: `/pro/rendez-vous/${b.id}` },
            booking_id: b.id,
          })),
        );
        if (ins.error) throw ins.error;
      }
      const upd = await db.from('bookings').update({ reminder_pro_sent_at: new Date().toISOString() }).in('id', dueForPro.map((b) => b.id));
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

    // Clés d'idempotence : elles ne servent qu'au temps des reprises d'un réseau capricieux.
    // 24 h couvrent très largement ; au-delà, la table ne ferait que grossir.
    const purgedKeys = await db
      .from('idempotency_keys')
      .delete({ count: 'exact' })
      .lt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    if (purgedKeys.error) throw purgedKeys.error;

    // Battement de cœur : le tableau de bord d'administration lit cette clé pour dire si la
    // machine tourne. Écriture volontairement non bloquante — un tic réussi ne doit pas échouer
    // parce qu'un réglage n'a pas pu s'enregistrer.
    const beat = await db
      .from('app_settings')
      .upsert({ key: 'cron_last_tick', value: new Date(now).toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (beat.error) req.log.warn({ err: beat.error }, 'cron heartbeat');

    return { reminders1h: envoyes.reminder_1h_sent_at ?? 0, reminders30m: envoyes.reminder_30m_sent_at ?? 0, proReminders: toRemindPro.length, autoCompleted: completed.length, expired: expired.length, pushed, purged, purgedKeys: purgedKeys.count ?? 0 };
  }
};

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

export default internalRoutes;
