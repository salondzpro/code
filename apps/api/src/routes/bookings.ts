import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CLIENT_CANCEL_MIN_HOURS, MAX_UPCOMING_BOOKINGS_PER_CLIENT } from '@salondz/constants';
import {
  cancelBookingSchema,
  createBookingSchema,
  createReviewSchema,
  myBookingsQuerySchema,
  rescheduleBookingSchema,
  uuid,
} from '@salondz/validation';
import type { Review } from '@salondz/types';
import { db } from '../lib/supabase';
import { badRequest, conflict, forbidden, notFound, unwrap } from '../lib/errors';
import { camelize } from '../lib/mappers';
import { BOOKING_WITH_SALON_SELECT, getBookingWithSalon, mapBookingWithSalon } from '../lib/queries';
import { pushAfterBooking } from '../lib/push';

const bookingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireProfile);

  /** Réservation en ligne (atomique côté DB via create_booking). */
  app.post('/bookings', { schema: { body: createBookingSchema } }, async (req, reply) => {
    const profile = req.profile!;
    const body = req.body;
    const clientName = body.clientName ?? profile.fullName;
    const clientPhone = body.clientPhone ?? profile.phone ?? null;
    if (!clientName) throw badRequest('NAME_REQUIRED', 'Indiquez votre nom pour réserver.');

    // Complète le profil au passage (première réservation)
    const patch: Record<string, string> = {};
    if (!profile.fullName && body.clientName) patch.full_name = body.clientName;
    if (!profile.phone && body.clientPhone) patch.phone = body.clientPhone;
    if (Object.keys(patch).length) await db.from('profiles').update(patch).eq('id', profile.id);

    const serviceIds = body.serviceIds?.length ? body.serviceIds : [body.serviceId!];
    await assertClientCanBook(profile.id, body.salonId, serviceIds, body.startsAt);

    const res = await db.rpc('create_booking_multi', {
      p_salon_id: body.salonId,
      p_service_ids: serviceIds,
      p_staff_id: body.staffId ?? null,
      p_starts_at: body.startsAt,
      p_client_id: profile.id,
      p_client_name: clientName,
      p_client_phone: clientPhone,
      p_notes: body.notes ?? null,
      p_source: 'online',
      p_enforce_rules: true,
    });
    const created = unwrap(res) as { id: string };
    pushAfterBooking(req.log, created.id);
    reply.status(201);
    return getBookingWithSalon(created.id);
  });

  app.get('/me/bookings', { schema: { querystring: myBookingsQuerySchema } }, async (req, reply) => {
    const { scope, cursor, limit } = req.query;
    const offset = Number(cursor ?? 0) || 0;
    const nowIso = new Date().toISOString();
    let q = db.from('bookings').select(BOOKING_WITH_SALON_SELECT).eq('client_id', req.user!.id);
    q =
      scope === 'upcoming'
        ? q.gte('ends_at', nowIso).in('status', ['pending', 'confirmed']).order('starts_at', { ascending: true })
        : q.or(`ends_at.lt.${nowIso},status.in.(cancelled,completed,no_show)`).order('starts_at', { ascending: false });
    const rows = unwrap(await q.range(offset, offset + limit - 1)) as Record<string, unknown>[];
    const items = rows.map(mapBookingWithSalon);
    reply.header('Cache-Control', 'private, no-store');
    return { items, nextCursor: items.length === limit ? String(offset + limit) : null };
  });

  app.get('/bookings/:id', { schema: { params: z.object({ id: uuid }) } }, async (req, reply) => {
    const b = await getBookingWithSalon(req.params.id);
    if (b.clientId !== req.user!.id) throw notFound('Réservation');
    reply.header('Cache-Control', 'private, no-store');
    return b;
  });

  app.post('/bookings/:id/cancel', { schema: { params: z.object({ id: uuid }), body: cancelBookingSchema } }, async (req) => {
    const b = await getBookingWithSalon(req.params.id);
    if (b.clientId !== req.user!.id) throw notFound('Réservation');
    if (b.status !== 'pending' && b.status !== 'confirmed') {
      throw conflict('BOOKING_NOT_CANCELLABLE', 'Cette réservation ne peut plus être annulée.');
    }
    const hoursBefore = (new Date(b.startsAt).getTime() - Date.now()) / 3_600_000;
    const minHours = b.salon.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS;
    if (hoursBefore < minHours) {
      throw conflict('CANCEL_TOO_LATE', `Annulation en ligne impossible à moins de ${minHours} h. Contactez le salon.`);
    }
    const res = await db
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'client',
        cancellation_reason: req.body.reason ?? null,
      })
      .eq('id', b.id)
      .in('status', ['pending', 'confirmed'])
      .select('id')
      .maybeSingle();
    if (!unwrap(res)) throw conflict('BOOKING_NOT_CANCELLABLE', 'Cette réservation ne peut plus être annulée.');
    pushAfterBooking(req.log, b.id);
    return getBookingWithSalon(b.id);
  });

  app.post('/bookings/:id/reschedule', { schema: { params: z.object({ id: uuid }), body: rescheduleBookingSchema } }, async (req) => {
    const b = await getBookingWithSalon(req.params.id);
    if (b.clientId !== req.user!.id) throw notFound('Réservation');
    // Les règles (report autorisé, délai, délai minimum, horizon, créneau libre) sont appliquées en SQL.
    const res = await db.rpc('reschedule_booking', {
      p_booking_id: b.id,
      p_starts_at: req.body.startsAt,
      p_staff_id: req.body.staffId ?? null,
      p_enforce_rules: true,
    });
    const moved = unwrap(res) as { starts_at: string };
    // Le trigger prévient le client ; le professionnel doit aussi voir le nouveau créneau.
    const owner = await db.from('salons').select('owner_id').eq('id', b.salonId).single();
    if (!owner.error && owner.data) {
      await db.from('notifications').insert({
        user_id: owner.data.owner_id,
        type: 'booking_rescheduled',
        title: 'Rendez-vous déplacé',
        body: `${b.clientName} · ${b.serviceName} · ${fmtWhen(moved.starts_at)}`,
        data: { bookingId: b.id, salonId: b.salonId, status: b.status },
        booking_id: b.id,
      });
    }
    pushAfterBooking(req.log, b.id);
    return getBookingWithSalon(b.id);
  });

  app.post('/bookings/:id/review', { schema: { params: z.object({ id: uuid }), body: createReviewSchema.omit({ bookingId: true }) } }, async (req, reply) => {
    const b = await getBookingWithSalon(req.params.id);
    if (b.clientId !== req.user!.id) throw forbidden();
    if (b.status !== 'completed') throw conflict('BOOKING_NOT_COMPLETED', 'Vous pourrez laisser un avis après le rendez-vous.');
    const res = await db
      .from('reviews')
      .insert({ salon_id: b.salonId, booking_id: b.id, client_id: req.user!.id, rating: req.body.rating, comment: req.body.comment ?? null })
      .select('id, salon_id, booking_id, client_id, rating, comment, created_at')
      .single();
    reply.status(201);
    return camelize<Review>(unwrap(res));
  });
};

/**
 * Garde-fous anti-abus avant la création (la fonction SQL reste la seule source de vérité du créneau) :
 * plafond de rendez-vous à venir par client, et pas de doublon du même client sur un horaire
 * qui chevauche un rendez-vous déjà pris dans ce salon (double clic, réessai réseau).
 */
async function assertClientCanBook(clientId: string, salonId: string, serviceIds: string[], startsAt: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const [upcoming, total] = await Promise.all([
    db.from('bookings').select('id', { count: 'exact', head: true }).eq('client_id', clientId).in('status', ACTIVE_STATUSES).gte('ends_at', nowIso),
    db.rpc('services_total', { p_salon_id: salonId, p_service_ids: serviceIds }).single(),
  ]);
  if (upcoming.error) throw upcoming.error;
  if ((upcoming.count ?? 0) >= MAX_UPCOMING_BOOKINGS_PER_CLIENT) {
    throw conflict('TOO_MANY_BOOKINGS', `Vous avez déjà ${MAX_UPCOMING_BOOKINGS_PER_CLIENT} rendez-vous à venir. Annulez-en un pour réserver.`);
  }
  const t = unwrap(total) as { duration_minutes: number; n: number };
  if (t.n !== serviceIds.length) return; // la fonction SQL renverra SERVICE_INACTIVE
  const startIso = new Date(startsAt).toISOString();
  const endIso = new Date(new Date(startsAt).getTime() + t.duration_minutes * 60_000).toISOString();
  const dup = await db
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('salon_id', salonId)
    .in('status', ACTIVE_STATUSES)
    .lt('starts_at', endIso)
    .gt('ends_at', startIso);
  if (dup.error) throw dup.error;
  if (dup.count) throw conflict('ALREADY_BOOKED', 'Vous avez déjà un rendez-vous dans ce salon à cet horaire.');
}

const ACTIVE_STATUSES = ['pending', 'confirmed'];

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

export default bookingRoutes;
