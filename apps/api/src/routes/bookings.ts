import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CANCEL_ABUSE_WINDOW_DAYS, CLIENT_CANCEL_MIN_HOURS, MAX_UPCOMING_BOOKINGS_PER_CLIENT, NO_SHOW_ABUSE_MAX, NO_SHOW_ABUSE_WINDOW_DAYS, SHOW_SALON_CONTACT_TO_CLIENTS, MAX_FOR_OTHER_PER_DAY } from '@salondz/constants';
import {
  cancelBookingSchema,
  createBookingSchema,
  createReviewSchema,
  myBookingsQuerySchema,
  reportReviewSchema,
  rescheduleBookingSchema,
  uuid,
} from '@salondz/validation';
import type { Review } from '@salondz/types';
import { db } from '../lib/supabase';
import { badRequest, conflict, forbidden, notFound, unwrap } from '../lib/errors';
import { camelize } from '../lib/mappers';
import { BOOKING_WITH_SALON_SELECT, getBookingWithSalon, mapBookingWithSalon } from '../lib/queries';
import { pushAfterBooking } from '../lib/push';
import { notifySlotFreed } from '../lib/waitlist';
import { clientFilter, clientStanding, type ClientRef } from '../lib/standing';

const bookingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireProfile);

  /**
   * Signaler un avis (migration 0047). Ouvert à toute personne connectée SAUF son auteur — le professionnel
   * visé compris : c'est le premier à qui un avis mensonger fait du tort. Un signalement est unique par
   * personne et par avis, ne masque rien à lui seul (un opérateur décide, avec un motif, dans
   * `/v1/admin/reports`) et ne dit jamais à l'auteur de l'avis qu'on l'a signalé. Répondre 204 dans tous les
   * cas où l'avis existe : refaire le geste n'est pas une erreur.
   */
  app.post(
    '/reviews/:id/report',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
      schema: { params: z.object({ id: uuid }), body: reportReviewSchema },
    },
    async (req, reply) => {
      const review = await db.from('reviews').select('id, client_id, hidden_at').eq('id', req.params.id).maybeSingle();
      if (review.error) throw review.error;
      const r = review.data as { id: string; client_id: string; hidden_at: string | null } | null;
      if (!r || r.hidden_at) throw notFound('Avis');
      if (r.client_id === req.user!.id) throw badRequest('OWN_REVIEW', "C'est votre propre avis : vous pouvez le modifier, pas le signaler.");
      const ins = await db
        .from('review_reports')
        .upsert(
          { review_id: r.id, reporter_id: req.user!.id, reason: req.body.reason, message: req.body.message ?? null },
          { onConflict: 'review_id,reporter_id', ignoreDuplicates: true },
        );
      if (ins.error) throw ins.error;
      reply.status(204);
      return null;
    },
  );

  /** Réservation en ligne (atomique côté DB via create_booking). */
  app.post('/bookings', { schema: { body: createBookingSchema } }, async (req, reply) => {
    const profile = req.profile!;
    const body = req.body;
    const forOther = !!body.beneficiary && body.beneficiary.phone !== profile.phone;

    /**
     * POUR QUELQU'UN D'AUTRE : le rendez-vous appartient à la personne concernée. Son
     * numéro l'identifie ; s'il correspond à un compte, le rendez-vous s'y rattache et
     * apparaît dans son application comme si elle l'avait pris elle-même. Sinon
     * `client_id` reste nul et le numéro seul l'identifie, comme un client de passage.
     *
     * Un numéro identique à celui du compte connecté n'est PAS une autre personne : on
     * réserve pour soi, sans créer une seconde identité fantôme.
     */
    let clientId: string | null = profile.id;
    let clientName = body.clientName ?? profile.fullName;
    let clientPhone = body.clientPhone ?? profile.phone ?? null;
    if (forOther) {
      const who = body.beneficiary!;
      const found = await db.from('profiles').select('id, full_name').eq('phone', who.phone).limit(1);
      if (found.error) throw found.error;
      const account = found.data?.[0] as { id: string; full_name: string | null } | undefined;
      clientId = account?.id ?? null;
      // Toujours le nom saisi par la personne qui réserve : renvoyer le nom du titulaire du numéro
      // ferait de cette route un annuaire inversé (numéro → identité).
      clientName = who.fullName;
      clientPhone = who.phone;
      const recent = await db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('booked_by', profile.id)
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
      if (recent.error) throw recent.error;
      if ((recent.count ?? 0) >= MAX_FOR_OTHER_PER_DAY)
        throw badRequest('TOO_MANY_FOR_OTHER', 'Vous avez déjà réservé pour plusieurs personnes aujourd’hui. Réessayez demain.');
    }
    if (!clientName) throw badRequest('NAME_REQUIRED', 'Indiquez votre nom pour réserver.');

    // Complète le profil au passage (première réservation) — jamais avec les coordonnées
    // de quelqu'un d'autre.
    if (!forOther) {
      const patch: Record<string, string> = {};
      if (!profile.fullName && body.clientName) patch.full_name = body.clientName;
      if (!profile.phone && body.clientPhone) patch.phone = body.clientPhone;
      if (Object.keys(patch).length) await db.from('profiles').update(patch).eq('id', profile.id);
    }

    const serviceIds = body.serviceIds?.length ? body.serviceIds : [body.serviceId!];
    // Les règles se lisent sur la PERSONNE CONCERNÉE, par compte et par numéro.
    await assertClientCanBook(
      { id: clientId, phone: clientPhone },
      body.salonId,
      serviceIds,
      body.startsAt,
      forOther,
    );

    const res = await db.rpc('create_booking_multi', {
      p_salon_id: body.salonId,
      p_service_ids: serviceIds,
      p_staff_id: body.staffId ?? null,
      p_starts_at: body.startsAt,
      p_client_id: clientId,
      p_client_name: clientName,
      p_client_phone: clientPhone,
      p_notes: body.notes ?? null,
      p_source: 'online',
      p_enforce_rules: true,
    });
    const created = unwrap(res) as { id: string };
    // Qui a réservé : écrit juste après, la fonction SQL étant partagée avec la saisie du
    // pro. Ces deux colonnes ne déclenchent aucune notification (le déclencheur ne regarde
    // que le statut et l'horaire).
    if (forOther)
      await db
        .from('bookings')
        .update({ booked_by: profile.id, booked_by_name: profile.fullName ?? null })
        .eq('id', created.id);
    pushAfterBooking(req.log, created.id);
    reply.status(201);
    return getBookingWithSalon(created.id);
  });

  app.get('/me/bookings', { schema: { querystring: myBookingsQuerySchema } }, async (req, reply) => {
    const { scope, cursor, limit } = req.query;
    const offset = Number(cursor ?? 0) || 0;
    const nowIso = new Date().toISOString();
    // Les miens ET ceux que j'ai pris pour quelqu'un d'autre : sinon un rendez-vous pris
    // pour sa mère disparaît de son application dès l'écran de confirmation.
    // L'onglet « passés » ajoute son propre `.or()` : PostgREST combine deux `or=` par ET,
    // donc l'identité reste appliquée (vérifié en production, aucune fuite entre comptes).
    let q = db
      .from('bookings')
      .select(BOOKING_WITH_SALON_SELECT)
      .or(`client_id.eq.${req.user!.id},booked_by.eq.${req.user!.id}`);
    q =
      scope === 'upcoming'
        ? q.gte('ends_at', nowIso).in('status', ['pending', 'confirmed']).order('starts_at', { ascending: true })
        : scope === 'cancelled'
          ? q.eq('status', 'cancelled').order('cancelled_at', { ascending: false, nullsFirst: false })
          : q.neq('status', 'cancelled').or(`ends_at.lt.${nowIso},status.in.(completed,no_show)`).order('starts_at', { ascending: false });
    const rows = unwrap(await q.range(offset, offset + limit - 1)) as Record<string, unknown>[];
    const items = rows.map(mapBookingWithSalon);
    reply.header('Cache-Control', 'private, no-store');
    return { items, nextCursor: items.length === limit ? String(offset + limit) : null };
  });

  app.get('/bookings/:id', { schema: { params: z.object({ id: uuid }) } }, async (req, reply) => {
    const b = await getBookingWithSalon(req.params.id);
    if (!mine(b, req.user!.id)) throw notFound('Réservation');
    reply.header('Cache-Control', 'private, no-store');
    return b;
  });

  app.post('/bookings/:id/cancel', { schema: { params: z.object({ id: uuid }), body: cancelBookingSchema } }, async (req) => {
    const b = await getBookingWithSalon(req.params.id);
    if (!mine(b, req.user!.id)) throw notFound('Réservation');
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
    // Le créneau se libère : liste d'attente et clients ayant rendez-vous plus tard.
    void notifySlotFreed(req.log, { salonId: b.salonId, staffId: b.staffId, startsAt: b.startsAt, endsAt: b.endsAt, serviceId: b.serviceId, excludeBookingId: b.id });
    return getBookingWithSalon(b.id);
  });

  app.post('/bookings/:id/reschedule', { schema: { params: z.object({ id: uuid }), body: rescheduleBookingSchema } }, async (req) => {
    const b = await getBookingWithSalon(req.params.id);
    if (!mine(b, req.user!.id)) throw notFound('Réservation');
    // Les règles (report autorisé, délai, délai minimum, horizon, créneau libre) sont appliquées en SQL.
    const res = await db.rpc('reschedule_booking', {
      p_booking_id: b.id,
      p_starts_at: req.body.startsAt,
      p_staff_id: req.body.staffId ?? null,
      p_enforce_rules: true,
    });
    const moved = unwrap(res) as { starts_at: string };
    // L'ancien créneau se libère.
    void notifySlotFreed(req.log, { salonId: b.salonId, staffId: b.staffId, startsAt: b.startsAt, endsAt: b.endsAt, serviceId: b.serviceId, excludeBookingId: b.id });
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
    if (b.reviewRating != null) throw conflict('ALREADY_REVIEWED', 'Vous avez déjà noté ce rendez-vous.');
    const res = await db
      .from('reviews')
      .insert({ salon_id: b.salonId, booking_id: b.id, client_id: req.user!.id, rating: req.body.rating, comment: req.body.comment ?? null })
      .select('id, salon_id, booking_id, client_id, rating, comment, created_at')
      .single();
    if (res.error?.code === '23505') throw conflict('ALREADY_REVIEWED', 'Vous avez déjà noté ce rendez-vous.');
    reply.status(201);
    return camelize<Review>(unwrap(res));
  });
};

/**
 * Garde-fous anti-abus avant la création (la fonction SQL reste la seule source de vérité du créneau) :
 * plafond de rendez-vous à venir par client, et pas de doublon du même client sur un horaire
 * qui chevauche un rendez-vous déjà pris dans ce salon (double clic, réessai réseau).
 */
async function assertClientCanBook(who: ClientRef, salonId: string, serviceIds: string[], startsAt: string, forOther = false): Promise<void> {
  const nowIso = new Date().toISOString();
  const mine = clientFilter(who);
  if (!mine) throw badRequest('NAME_REQUIRED', 'Indiquez le numéro de la personne concernée.');
  const [upcoming, total, standing] = await Promise.all([
    db.from('bookings').select('id', { count: 'exact', head: true }).or(mine).in('status', ACTIVE_STATUSES).gte('ends_at', nowIso),
    db.rpc('services_total', { p_salon_id: salonId, p_service_ids: serviceIds }).single(),
    clientStanding(who),
  ]);
  if (upcoming.error) throw upcoming.error;
  // Anti-abus : trop d'annulations ou d'absences récentes → réservation en ligne suspendue quelques jours.
  if (standing.suspendedUntil) {
    const why = standing.noShows >= NO_SHOW_ABUSE_MAX ? `${standing.noShows} absences signalées en ${NO_SHOW_ABUSE_WINDOW_DAYS} jours` : `${standing.cancellations} annulations en ${CANCEL_ABUSE_WINDOW_DAYS} jours`;
    throw conflict('BOOKING_SUSPENDED', `${forOther ? 'Réservation en ligne suspendue pour cette personne' : 'Réservation en ligne suspendue'} jusqu'au ${fmtWhen(standing.suspendedUntil)} (${why}).${!forOther && SHOW_SALON_CONTACT_TO_CLIENTS ? ' Vous pouvez appeler le salon.' : ''}`);
  }
  if ((upcoming.count ?? 0) >= MAX_UPCOMING_BOOKINGS_PER_CLIENT) {
    throw conflict(
      'TOO_MANY_BOOKINGS',
      forOther
        ? `Cette personne a déjà ${MAX_UPCOMING_BOOKINGS_PER_CLIENT} rendez-vous à venir.`
        : `Vous avez déjà ${MAX_UPCOMING_BOOKINGS_PER_CLIENT} rendez-vous à venir. Annulez-en un pour réserver.`,
    );
  }
  const t = unwrap(total) as { duration_minutes: number; n: number };
  if (t.n !== serviceIds.length) return; // la fonction SQL renverra SERVICE_INACTIVE
  const startIso = new Date(startsAt).toISOString();
  const endIso = new Date(new Date(startsAt).getTime() + t.duration_minutes * 60_000).toISOString();
  const dup = await db
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .or(mine)
    .eq('salon_id', salonId)
    .in('status', ACTIVE_STATUSES)
    .lt('starts_at', endIso)
    .gt('ends_at', startIso);
  if (dup.error) throw dup.error;
  if (dup.count)
    throw conflict(
      'ALREADY_BOOKED',
      forOther
        ? 'Cette personne a déjà un rendez-vous dans ce salon à cet horaire.'
        : 'Vous avez déjà un rendez-vous dans ce salon à cet horaire.',
    );
}

const ACTIVE_STATUSES = ['pending', 'confirmed'];

/**
 * Un rendez-vous m'appartient si j'en suis la personne concernée, OU si c'est moi qui l'ai
 * pris pour quelqu'un d'autre : consulter, annuler et reporter restent alors possibles.
 * L'AVIS, lui, reste réservé à la personne concernée : on ne note pas une visite qu'on n'a
 * pas faite.
 */
function mine(b: { clientId: string | null; bookedBy: string | null }, uid: string): boolean {
  return b.clientId === uid || b.bookedBy === uid;
}

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

export default bookingRoutes;
