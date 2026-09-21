import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  chooseRoleSchema,
  registerPushTokenSchema,
  updateProfileSchema,
  uuid,
} from '@salondz/validation';
import type { BookingStanding, MeStats, Notification, Profile, SalonSummary } from '@salondz/types';
import { db } from '../lib/supabase';
import { camelize, snakeize } from '../lib/mappers';
import { unwrap, conflict } from '../lib/errors';
import { loadOwnedSalon } from '../plugins/auth';
import { attachNextSlots } from '../lib/availability';
import { eraseClientAccount, eraseProAccount } from '../lib/moderation';
import { clientStanding } from '../lib/standing';
import {
  CANCEL_ABUSE_WINDOW_DAYS,
  NO_SHOW_ABUSE_MAX,
  NO_SHOW_ABUSE_WINDOW_DAYS,
  SHOW_SALON_CONTACT_TO_CLIENTS, SLOT_ALERT_MAX_PER_CLIENT } from '@salondz/constants';

const PROFILE_COLS =
  'id, role, full_name, phone, avatar_url, gender, locale, market, reminders_enabled, notify_confirmations, created_at, suspended_at, suspended_reason';

const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireProfile);

  /**
   * Situation de réservation chez un salon : suspension anti-abus (annulations / absences) ou blocage par ce salon.
   * Sert à griser « Réserver » et à afficher la raison en haut AVANT toute tentative (même règles que POST /bookings).
   */
  app.get(
    '/me/booking-standing/:salonId',
    { schema: { params: z.object({ salonId: uuid }) } },
    async (req, reply) => {
      const uid = req.user!.id;
      const phone = req.profile!.phone;
      const [standing, blocked] = await Promise.all([
        clientStanding({ id: uid, phone }),
        db
          .from('blocked_clients')
          .select('id')
          .eq('salon_id', req.params.salonId)
          .or(`client_id.eq.${uid}${phone ? `,phone.eq.${phone}` : ''}`)
          .limit(1),
      ]);
      if (blocked.error) throw blocked.error;
      const isBlocked = (blocked.data ?? []).length > 0;
      let message: string | null = null;
      if (isBlocked)
        message = "Ce salon n'accepte pas vos réservations en ligne. Contactez-le directement.";
      else if (standing.suspendedUntil) {
        // `hourCycle` explicite : selon l'ICU, fr-DZ affiche « 04:31 PM » — on veut « 16:31 ».
        const when = new Intl.DateTimeFormat('fr-FR', {
          hourCycle: 'h23',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Algiers',
        }).format(new Date(standing.suspendedUntil));
        const why =
          standing.noShows >= NO_SHOW_ABUSE_MAX
            ? `${standing.noShows} absences signalées en ${NO_SHOW_ABUSE_WINDOW_DAYS} jours`
            : `${standing.cancellations} annulations en ${CANCEL_ABUSE_WINDOW_DAYS} jours`;
        message = `Réservation en ligne suspendue jusqu'au ${when} (${why}).${SHOW_SALON_CONTACT_TO_CLIENTS ? ' Vous pouvez appeler le salon.' : ''}`;
      }
      reply.header('Cache-Control', 'private, no-store');
      const out: BookingStanding = {
        ...standing,
        blocked: isBlocked,
        canBook: message === null,
        message,
      };
      return out;
    },
  );

  /** Profil + raccourci vers le salon (pour router après connexion). */
  app.get('/me', async (req, reply) => {
    const [salon, standing] = await Promise.all([
      loadOwnedSalon(req.user!.id),
      req.profile!.role === 'client' ? clientStanding({ id: req.user!.id, phone: req.profile!.phone }) : Promise.resolve(null),
    ]);
    // La suspension d'un salon n'est pas une colonne comme les autres : elle ne voyage pas dans
    // l'objet `Salon` (qui sert aussi la fiche publique), et on la lit donc à part. Le pro doit la
    // voir et en lire le MOTIF — une plateforme qui coupe sans dire pourquoi n'est pas un
    // partenaire.
    const suspension = salon
      ? await db
          .from('salons')
          .select('suspended_at, suspension_level, suspended_reason')
          .eq('id', salon.id)
          .maybeSingle()
      : null;
    const susp = (suspension?.data ?? null) as
      | { suspended_at: string | null; suspension_level: 'frozen' | 'hidden' | null; suspended_reason: string | null }
      | null;
    reply.header('Cache-Control', 'private, no-store');
    return {
      profile: req.profile!,
      salon: salon
        ? {
            id: salon.id,
            slug: salon.slug,
            name: salon.name,
            isPublished: salon.isPublished,
            suspendedAt: susp?.suspended_at ?? null,
            suspensionLevel: susp?.suspension_level ?? null,
            suspendedReason: susp?.suspended_reason ?? null,
          }
        : null,
      standing,
    };
  });

  app.patch('/me', { schema: { body: updateProfileSchema } }, async (req) => {
    // Un numéro vérifié par OTP (présent dans le jeton) reste la référence : il ne se modifie pas ici.
    const { phone, ...rest } = req.body;
    const body = req.user!.phone ? rest : req.body;
    if (Object.keys(body).length === 0) return req.profile!;
    // Le numéro identifie la personne dans les règles anti-abus et les fiches des salons : une fois un
    // rendez-vous pris, il ne se change plus librement (support). Avant, il reste modifiable.
    if (phone && phone !== req.profile!.phone && req.profile!.phone) {
      const taken = await db.from('bookings').select('id', { count: 'exact', head: true }).eq('client_id', req.user!.id);
      if (taken.error) throw taken.error;
      if ((taken.count ?? 0) > 0)
        throw conflict('PHONE_LOCKED', 'Votre numéro est lié à vos rendez-vous : écrivez à support@salondz.com pour le modifier.');
    }
    const res = await db
      .from('profiles')
      .update(snakeize(body))
      .eq('id', req.user!.id)
      .select(PROFILE_COLS)
      .single();
    return camelize<Profile>(unwrap(res));
  });

  app.post('/me/role', { schema: { body: chooseRoleSchema } }, async (req) => {
    const res = await db
      .from('profiles')
      .update({ role: req.body.role })
      .eq('id', req.user!.id)
      .select(PROFILE_COLS)
      .single();
    return camelize<Profile>(unwrap(res));
  });

  // ---- Push tokens ----
  app.post('/me/push-tokens', { schema: { body: registerPushTokenSchema } }, async (req, reply) => {
    const res = await db
      .from('push_tokens')
      .upsert(
        {
          user_id: req.user!.id,
          token: req.body.token,
          platform: req.body.platform,
          device_name: req.body.deviceName ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'token' },
      )
      .select('id')
      .single();
    unwrap(res);
    reply.status(204);
    return null;
  });

  app.delete(
    '/me/push-tokens/:token',
    { schema: { params: z.object({ token: z.string().min(1) }) } },
    async (req, reply) => {
      await db
        .from('push_tokens')
        .delete()
        .eq('user_id', req.user!.id)
        .eq('token', req.params.token);
      reply.status(204);
      return null;
    },
  );

  // ---- Notifications ----
  app.get(
    '/me/notifications',
    {
      schema: {
        querystring: z.object({
          cursor: z.coerce.number().int().min(0).default(0),
          limit: z.coerce.number().int().min(1).max(50).default(30),
        }),
      },
    },
    async (req, reply) => {
      const { cursor, limit } = req.query;
      const [listRes, unreadRes] = await Promise.all([
        db
          .from('notifications')
          .select('id, user_id, type, title, body, data, booking_id, read_at, created_at')
          .eq('user_id', req.user!.id)
          .order('created_at', { ascending: false })
          .range(cursor, cursor + limit - 1),
        db
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', req.user!.id)
          .is('read_at', null),
      ]);
      const items = camelize<Notification[]>(unwrap(listRes));
      reply.header('Cache-Control', 'private, no-store');
      return {
        items,
        nextCursor: items.length === limit ? String(cursor + limit) : null,
        unreadCount: unreadRes.count ?? 0,
      };
    },
  );

  app.post(
    '/me/notifications/read',
    { schema: { body: z.object({ ids: z.array(uuid).max(200).optional() }) } },
    async (req, reply) => {
      let q = db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', req.user!.id)
        .is('read_at', null);
      if (req.body.ids?.length) q = q.in('id', req.body.ids);
      const { error } = await q;
      if (error) throw error;
      reply.status(204);
      return null;
    },
  );

  // ---- Favoris ----
  /** Compteurs du profil (réservations, favoris, avis donnés) : trois COUNT, aucune liste chargée. */
  app.get('/me/stats', async (req, reply) => {
    const uid = req.user!.id;
    const [b, f, r] = await Promise.all([
      db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', uid)
        .neq('status', 'cancelled'),
      db.from('favorites').select('salon_id', { count: 'exact', head: true }).eq('user_id', uid),
      db.from('reviews').select('id', { count: 'exact', head: true }).eq('client_id', uid),
    ]);
    if (b.error) throw b.error;
    if (f.error) throw f.error;
    if (r.error) throw r.error;
    reply.header('Cache-Control', 'private, no-store');
    return {
      bookings: b.count ?? 0,
      favorites: f.count ?? 0,
      reviews: r.count ?? 0,
    } satisfies MeStats;
  });

  app.get('/me/favorites', async (req, reply) => {
    const res = await db
      .from('favorites')
      .select(
        'salon_id, salons!inner(id, slug, name, city, zone, wilaya_code, cover_url, logo_url, gender_target, rating_avg, rating_count, is_published, salon_categories(category_id))',
      )
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });
    const rows = unwrap(res) as unknown as {
      salons: Record<string, unknown> & {
        salon_categories: { category_id: string }[];
        is_published: boolean;
      };
    }[];
    const items: SalonSummary[] = rows
      .filter((r) => r.salons.is_published)
      .map((r) => {
        const { salon_categories, is_published: _p, ...rest } = r.salons;
        const s =
          camelize<
            Omit<
              SalonSummary,
              | 'categoryIds'
              | 'minPriceDa'
              | 'topServices'
              | 'nextSlots'
              | 'nextAvailable'
              | 'isOpenNow'
            >
          >(rest);
        return {
          ...s,
          ratingAvg: Number(s.ratingAvg),
          categoryIds: salon_categories.map((c) => c.category_id),
          minPriceDa: null,
          topServices: [],
          nextSlots: [],
          nextAvailable: null as SalonSummary['nextAvailable'],
          photoUrls: [],
          isOpenNow: false,
        };
      });
    // Prochaines disponibilités (même calcul que la marketplace, un seul appel).
    await attachNextSlots(items, req.log);
    reply.header('Cache-Control', 'private, no-store');
    return { items };
  });

  app.put(
    '/me/favorites/:salonId',
    { schema: { params: z.object({ salonId: uuid }) } },
    async (req, reply) => {
      const { error } = await db
        .from('favorites')
        .upsert({ user_id: req.user!.id, salon_id: req.params.salonId });
      if (error) throw error;
      reply.status(204);
      return null;
    },
  );

  app.delete(
    '/me/favorites/:salonId',
    { schema: { params: z.object({ salonId: uuid }) } },
    async (req, reply) => {
      await db
        .from('favorites')
        .delete()
        .eq('user_id', req.user!.id)
        .eq('salon_id', req.params.salonId);
      reply.status(204);
      return null;
    },
  );

  // ---- Données personnelles : export et effacement ----

  /** Tout ce que Salon DZ conserve sur ce compte, en JSON (droit d'accès et de portabilité). */
  app.get('/me/export', async (req, reply) => {
    const uid = req.user!.id;
    const [bookings, reviews, favorites] = await Promise.all([
      db.from('bookings').select('id, salon_id, service_name, starts_at, ends_at, status, price_da, client_name, client_phone, notes, created_at').or(`client_id.eq.${uid},booked_by.eq.${uid}`).order('starts_at', { ascending: false }),
      db.from('reviews').select('id, salon_id, booking_id, rating, comment, created_at').eq('client_id', uid),
      db.from('favorites').select('salon_id, created_at').eq('client_id', uid),
    ]);
    if (bookings.error) throw bookings.error;
    if (reviews.error) throw reviews.error;
    if (favorites.error) throw favorites.error;
    reply.header('Cache-Control', 'private, no-store');
    reply.header('Content-Disposition', 'attachment; filename="salondz-mes-donnees.json"');
    return {
      exportedAt: new Date().toISOString(),
      account: { id: uid, email: req.user!.email ?? null },
      profile: req.profile!,
      bookings: camelize(bookings.data ?? []),
      reviews: camelize(reviews.data ?? []),
      favorites: camelize(favorites.data ?? []),
    };
  });

  /**
   * Effacement du compte (droit à l'effacement, exigence des boutiques d'applications). Les rendez-vous
   * passés restent dans l'historique des salons mais anonymisés ; tout le reste est supprimé, puis le
   * compte d'authentification lui-même. Un professionnel doit d'abord fermer son salon (support).
   */
  app.delete(
    '/me',
    { schema: { body: z.object({ withSalon: z.boolean().optional() }).optional() } },
    async (req, reply) => {
      // Même effacement que celui déclenché par l'administration à la demande du titulaire :
      // une seule implémentation, dans `lib/moderation.ts`. Un professionnel ferme son salon EN MÊME
      // TEMPS (`withSalon`) : ses clients à venir sont prévenus, et la confirmation le dit à l'écran.
      if (req.body?.withSalon) await eraseProAccount(req.log, req.user!.id);
      else await eraseClientAccount(req.log, req.user!.id);
      reply.status(204);
      return null;
    },
  );

  // ---- Alertes « prévenez-moi si un créneau se libère » ----

  app.get('/me/slot-alerts', { schema: { querystring: z.object({ salonId: uuid.optional() }) } }, async (req, reply) => {
    let q = db.from('slot_alerts').select('id, salon_id, service_id, day, created_at').eq('client_id', req.user!.id).is('notified_at', null).gte('day', new Date().toISOString().slice(0, 10)).order('day');
    if (req.query.salonId) q = q.eq('salon_id', req.query.salonId);
    const res = await q;
    if (res.error) throw res.error;
    reply.header('Cache-Control', 'private, no-store');
    return { items: camelize(res.data ?? []) as { id: string; salonId: string; serviceId: string | null; day: string; createdAt: string }[] };
  });

  app.post(
    '/me/slot-alerts',
    { schema: { body: z.object({ salonId: uuid, day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), serviceId: uuid.optional() }) } },
    async (req, reply) => {
      const uid = req.user!.id;
      const open = await db.from('slot_alerts').select('id', { count: 'exact', head: true }).eq('client_id', uid).is('notified_at', null).gte('day', new Date().toISOString().slice(0, 10));
      if (open.error) throw open.error;
      if ((open.count ?? 0) >= SLOT_ALERT_MAX_PER_CLIENT)
        throw conflict('TOO_MANY_ALERTS', `Vous avez déjà ${SLOT_ALERT_MAX_PER_CLIENT} alertes actives : retirez-en une avant d'en ajouter.`);
      const res = await db
        .from('slot_alerts')
        .upsert({ salon_id: req.body.salonId, client_id: uid, day: req.body.day, service_id: req.body.serviceId ?? null, notified_at: null }, { onConflict: 'salon_id,client_id,day' })
        .select('id, salon_id, service_id, day, created_at')
        .single();
      if (res.error) throw res.error;
      reply.status(201);
      return camelize(res.data);
    },
  );

  app.delete('/me/slot-alerts/:id', { schema: { params: z.object({ id: uuid }) } }, async (req, reply) => {
    const res = await db.from('slot_alerts').delete().eq('id', req.params.id).eq('client_id', req.user!.id);
    if (res.error) throw res.error;
    reply.status(204);
    return null;
  });
};

export default meRoutes;
