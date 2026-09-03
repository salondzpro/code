import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { addDaysToKey, localDateTimeToISO, toLocalDateKey } from '@salondz/constants';
import {
  cancelBookingSchema,
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

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: ['completed'],
};

const proBookingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireSalon);

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

  /** Réservation saisie par le pro (client de passage / téléphone). */
  app.post('/bookings', { schema: { body: createWalkInBookingSchema } }, async (req, reply) => {
    const b = req.body;
    const res = await db.rpc('create_booking', {
      p_salon_id: req.salon!.id,
      p_service_id: b.serviceId,
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
    const res = await db.from('bookings').update({ status: req.body.status }).eq('id', b.id).eq('status', b.status).select('id').maybeSingle();
    if (!unwrap(res)) throw conflict('INVALID_TRANSITION', 'La réservation a changé entre-temps.');
    pushAfterBooking(req.log, b.id);
    return getBookingWithStaff(b.id);
  });

  app.post('/bookings/:id/cancel', { schema: { params: z.object({ id: uuid }), body: cancelBookingSchema } }, async (req) => {
    const b = await getBookingWithStaff(req.params.id);
    if (b.salonId !== req.salon!.id) throw notFound('Réservation');
    if (!ALLOWED_TRANSITIONS[b.status]?.includes('cancelled')) {
      throw conflict('BOOKING_NOT_CANCELLABLE', 'Cette réservation ne peut plus être annulée.');
    }
    const res = await db
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'salon',
        cancellation_reason: req.body.reason ?? null,
      })
      .eq('id', b.id)
      .in('status', ['pending', 'confirmed'])
      .select('id')
      .maybeSingle();
    if (!unwrap(res)) throw conflict('BOOKING_NOT_CANCELLABLE', 'La réservation a changé entre-temps.');
    pushAfterBooking(req.log, b.id);
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
    return getBookingWithStaff(b.id);
  });
};

export default proBookingRoutes;
