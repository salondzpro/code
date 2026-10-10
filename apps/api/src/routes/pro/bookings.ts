import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { addDaysToKey, localDateTimeToISO, toLocalDateKey, LATE_TOLERANCE_MINUTES, isLate } from '@salondz/constants';
import {
  proCancelBookingSchema,
  createWalkInBookingSchema,
  listBookingsQuerySchema,
  rescheduleBookingSchema,
  updateBookingStatusSchema,
  uuid,
} from '@salondz/validation';
import { db } from '../../lib/supabase';
import { conflict, notFound, unwrap } from '../../lib/errors';
import { BOOKING_WITH_STAFF_SELECT, getBookingWithStaff, mapBookingWithStaff } from '../../lib/queries';
import { pushAfterBooking } from '../../lib/push';
import { notifySlotFreed } from '../../lib/waitlist';

/** Délai pendant lequel un rendez-vous clôturé automatiquement peut encore être marqué « Client absent ». */
const NO_SHOW_GRACE_DAYS = 7;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  // Terminé → Client absent reste possible quelques jours : la clôture automatique (cron, 3 h après
  // la fin) ne doit pas empêcher le pro de signaler un lapin le soir ou le lendemain.
  completed: ['no_show'],
  cancelled: [],
  no_show: ['completed'],
};

const proBookingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireSalon);

  /**
   * RENDEZ-VOUS PAS ENCORE VUS, et à quelle date ils tombent.
   *
   * Un rendez-vous pris pour la semaine prochaine n'apparaît nulle part tant que le professionnel
   * ne descend pas jusqu'à ce jour-là dans son agenda : il peut passer à côté d'une réservation
   * pendant des jours. On lui pose donc un compteur sur la date concernée.
   *
   * « Pas encore vu » se lit sur les NOTIFICATIONS non lues rattachées à un rendez-vous : elles
   * existent déjà, elles sont créées au même instant que le rendez-vous, et elles portent déjà la
   * notion de lu. Ajouter une colonne « vu » sur `bookings` aurait dupliqué cette information et
   * l'aurait fait diverger au premier oubli.
   */
  app.get('/bookings/unseen', async (req, reply) => {
    const { data: notifs, error } = await db
      .from('notifications')
      .select('booking_id')
      .eq('user_id', req.user!.id)
      .is('read_at', null)
      .not('booking_id', 'is', null);
    if (error) throw error;

    const ids = [...new Set((notifs ?? []).map((n) => n.booking_id as string))];
    if (!ids.length) return reply.send({ total: 0, byDate: {}, bookingIds: [] });

    // On ne garde que les rendez-vous DE CE SALON : le professionnel est aussi un client ailleurs,
    // et ses propres rendez-vous n'ont rien à faire dans le compteur de son agenda.
    const { data: rdv, error: e2 } = await db
      .from('bookings')
      .select('id, starts_at')
      .eq('salon_id', req.salon!.id)
      .in('id', ids);
    if (e2) throw e2;

    const byDate: Record<string, number> = {};
    for (const b of rdv ?? []) {
      const jour = toLocalDateKey(new Date(b.starts_at as string));
      byDate[jour] = (byDate[jour] ?? 0) + 1;
    }
    return reply.send({ total: (rdv ?? []).length, byDate, bookingIds: (rdv ?? []).map((b) => b.id as string) });
  });

  /**
   * « J'ai vu ce rendez-vous. » Marque lues les notifications du professionnel qui s'y rapportent,
   * ce qui fait baisser le compteur du jour et celui de l'onglet.
   */
  app.post('/bookings/:id/seen', { schema: { params: z.object({ id: uuid }) } }, async (req, reply) => {
    const { error } = await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', req.user!.id)
      .eq('booking_id', req.params.id)
      .is('read_at', null);
    if (error) throw error;
    reply.status(204);
    return null;
  });

  /** Agenda : réservations sur une plage de dates locales (défaut : 7 jours). */
  app.get('/bookings', { schema: { querystring: listBookingsQuerySchema } }, async (req, reply) => {
    const { from = toLocalDateKey(), status, staffId, limit } = req.query;
    const to = req.query.to ?? addDaysToKey(from, 6);
    const offset = Number(req.query.cursor ?? 0) || 0;
    let q = db
      .from('bookings')
      .select(BOOKING_WITH_STAFF_SELECT)
      .eq('salon_id', req.salon!.id)
      .gte('starts_at', localDateTimeToISO(from, '00:00'))
      .lt('starts_at', localDateTimeToISO(addDaysToKey(to, 1), '00:00'))
      .order('starts_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (status) q = q.eq('status', status);
    if (staffId) q = q.eq('staff_id', staffId);
    const rows = unwrap(await q) as Record<string, unknown>[];
    const items = rows.map(mapBookingWithStaff);
    reply.header('Cache-Control', 'private, no-store');
    return { items, nextCursor: items.length === limit ? String(offset + limit) : null };
  });

  /** Demandes en attente (badge). */
  app.get('/bookings/pending', async (req, reply) => {
    const res = await db
      .from('bookings')
      .select(BOOKING_WITH_STAFF_SELECT)
      .eq('salon_id', req.salon!.id)
      .eq('status', 'pending')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(100);
    const rows = unwrap(res) as Record<string, unknown>[];
    reply.header('Cache-Control', 'private, no-store');
    return { items: rows.map(mapBookingWithStaff), nextCursor: null };
  });

  /**
   * Réservation saisie par le pro (client de passage / téléphone). Plusieurs prestations font
   * UN rendez-vous (`create_booking_multi`, la même fonction que côté client) : un seul bloc
   * dans l'agenda, une seule ligne dans l'historique du client, une seule chose à annuler ou
   * à déplacer. L'écran laissait déjà en cocher plusieurs, mais créait autant de rendez-vous
   * à la suite — avec, si l'un échouait, un rendez-vous coupé en deux et rien pour revenir
   * en arrière.
   *
   * `p_enforce_rules: false` : le professionnel saisit ce qu'il veut dans son propre agenda
   * (délai, horizon, horaires) ; seule l'exclusion de créneau reste opposable.
   */
  app.post('/bookings', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } }, schema: { body: createWalkInBookingSchema } }, async (req, reply) => {
    const b = req.body;
    const serviceIds = b.serviceIds?.length ? b.serviceIds : [b.serviceId!];
    const res = await db.rpc('create_booking_multi', {
      p_salon_id: req.salon!.id,
      p_service_ids: serviceIds,
      p_staff_id: b.staffId,
      p_starts_at: b.startsAt,
      p_client_id: null,
      p_client_name: b.clientName,
      p_client_phone: b.clientPhone ?? null,
      p_notes: b.notes ?? null,
      p_source: b.source,
      p_enforce_rules: false,
    });
    const created = unwrap(res) as { id: string };
    reply.status(201);
    return getBookingWithStaff(created.id);
  });

  app.get('/bookings/:id', { schema: { params: z.object({ id: uuid }) } }, async (req, reply) => {
    const b = await getBookingWithStaff(req.params.id);
    if (b.salonId !== req.salon!.id) throw notFound('Réservation');
    reply.header('Cache-Control', 'private, no-store');
    return b;
  });

  app.post('/bookings/:id/status', { schema: { params: z.object({ id: uuid }), body: updateBookingStatusSchema } }, async (req) => {
    const b = await getBookingWithStaff(req.params.id);
    if (b.salonId !== req.salon!.id) throw notFound('Réservation');
    if (!ALLOWED_TRANSITIONS[b.status]?.includes(req.body.status)) {
      throw conflict('INVALID_TRANSITION', `Impossible de passer de "${b.status}" à "${req.body.status}".`);
    }
    const startsAt = new Date(b.startsAt).getTime();
    // Une demande dont l'heure est passée ne se confirme plus (le cron l'expire) ;
    // une absence ne se constate qu'une fois l'heure du rendez-vous atteinte.
    if (req.body.status === 'confirmed' && startsAt < Date.now()) {
      throw conflict('BOOKING_EXPIRED', "L'heure de cette demande est passée : elle ne peut plus être confirmée.");
    }
    if (req.body.status === 'no_show' && startsAt > Date.now()) {
      throw conflict('NOT_STARTED', "Le rendez-vous n'a pas encore commencé.");
    }
    if (b.status === 'completed' && req.body.status === 'no_show' && new Date(b.endsAt).getTime() < Date.now() - NO_SHOW_GRACE_DAYS * 86_400_000) {
      throw conflict('TOO_LATE', `Une absence se signale dans les ${NO_SHOW_GRACE_DAYS} jours qui suivent le rendez-vous.`);
    }
    const res = await db.from('bookings').update({ status: req.body.status }).eq('id', b.id).eq('status', b.status).select('id').maybeSingle();
    if (!unwrap(res)) throw conflict('INVALID_TRANSITION', 'La réservation a changé entre-temps.');
    pushAfterBooking(req.log, b.id);
    return getBookingWithStaff(b.id);
  });

  app.post('/bookings/:id/cancel', { schema: { params: z.object({ id: uuid }), body: proCancelBookingSchema } }, async (req) => {
    const b = await getBookingWithStaff(req.params.id);
    if (b.salonId !== req.salon!.id) throw notFound('Réservation');
    if (!ALLOWED_TRANSITIONS[b.status]?.includes('cancelled')) {
      throw conflict('BOOKING_NOT_CANCELLABLE', 'Cette réservation ne peut plus être annulée.');
    }
    // Règle de retard : au-delà de LATE_TOLERANCE_MINUTES après l'heure, le pro peut annuler « pour retard »
    // (statut distinct) ; sinon, il annule tant que le rendez-vous n'est pas passé, puis le marque Terminé ou Client absent.
    if (req.body.late) {
      if (!isLate(b.startsAt)) throw conflict('NOT_LATE_YET', `Le retard toléré (${LATE_TOLERANCE_MINUTES} min) n'est pas encore dépassé.`);
    } else if (new Date(b.startsAt).getTime() < Date.now()) {
      throw conflict('BOOKING_STARTED', 'Ce rendez-vous est passé : marquez-le « Terminé », « Client absent » ou annulez-le pour retard.');
    }
    const res = await db
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'salon',
        cancellation_reason: req.body.reason ?? (req.body.late ? `Retard de plus de ${LATE_TOLERANCE_MINUTES} min` : null),
        cancellation_kind: req.body.late ? 'late' : null,
      })
      .eq('id', b.id)
      .in('status', ['pending', 'confirmed'])
      .select('id')
      .maybeSingle();
    if (!unwrap(res)) throw conflict('BOOKING_NOT_CANCELLABLE', 'La réservation a changé entre-temps.');
    pushAfterBooking(req.log, b.id);
    void notifySlotFreed(req.log, { salonId: b.salonId, staffId: b.staffId, startsAt: b.startsAt, endsAt: b.endsAt, serviceId: b.serviceId, excludeBookingId: b.id });
    return getBookingWithStaff(b.id);
  });

  app.post('/bookings/:id/reschedule', { schema: { params: z.object({ id: uuid }), body: rescheduleBookingSchema } }, async (req) => {
    const b = await getBookingWithStaff(req.params.id);
    if (b.salonId !== req.salon!.id) throw notFound('Réservation');
    if (req.body.staffId) {
      const m = await db.from('staff').select('id').eq('id', req.body.staffId).eq('salon_id', b.salonId).eq('is_active', true).maybeSingle();
      if (m.error) throw m.error;
      if (!m.data) throw notFound('Membre');
    }
    const res = await db.rpc('reschedule_booking', {
      p_booking_id: b.id,
      p_starts_at: req.body.startsAt,
      p_staff_id: req.body.staffId ?? null,
      p_enforce_rules: false,
    });
    unwrap(res);
    pushAfterBooking(req.log, b.id);
    void notifySlotFreed(req.log, { salonId: b.salonId, staffId: b.staffId, startsAt: b.startsAt, endsAt: b.endsAt, serviceId: b.serviceId, excludeBookingId: b.id });
    return getBookingWithStaff(b.id);
  });
};

export default proBookingRoutes;
