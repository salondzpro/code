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
import { clientStanding } from '../lib/standing';
import {
  CANCEL_ABUSE_WINDOW_DAYS,
  NO_SHOW_ABUSE_MAX,
  NO_SHOW_ABUSE_WINDOW_DAYS,
  SHOW_SALON_CONTACT_TO_CLIENTS,
} from '@salondz/constants';

const PROFILE_COLS =
  'id, role, full_name, phone, avatar_url, gender, locale, market, whatsapp_reminders, created_at';

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
        const when = new Intl.DateTimeFormat('fr-DZ', {
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
    reply.header('Cache-Control', 'private, no-store');
    return {
      profile: req.profile!,
      salon: salon
        ? { id: salon.id, slug: salon.slug, name: salon.name, isPublished: salon.isPublished }
        : null,
      standing,
    };
  });

  app.patch('/me', { schema: { body: updateProfileSchema } }, async (req) => {
    // Un numéro vérifié par OTP (présent dans le jeton) reste la référence : il ne se modifie pas ici.
    const { phone, ...rest } = req.body;
    const body = req.user!.phone ? rest : req.body;
    if (Object.keys(body).length === 0) return req.profile!;
    void phone;
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
  app.delete('/me', async (req, reply) => {
    const uid = req.user!.id;
    const owned = await db.from('salons').select('id').eq('owner_id', uid).limit(1);
    if (owned.error) throw owned.error;
    if ((owned.data ?? []).length)
      throw conflict('HAS_SALON', 'Votre compte porte un salon : écrivez à support@salondz.com pour le fermer avant de supprimer le compte.');
    const anonymized = { client_id: null, client_name: 'Client supprimé', client_phone: null, notes: null };
    const steps = [
      db.from('bookings').update(anonymized).eq('client_id', uid),
      db.from('bookings').update({ booked_by: null, booked_by_name: null }).eq('booked_by', uid),
      db.from('reviews').delete().eq('client_id', uid),
      db.from('favorites').delete().eq('client_id', uid),
      db.from('push_tokens').delete().eq('user_id', uid),
      db.from('notifications').delete().eq('user_id', uid),
      db.from('client_notes').delete().eq('client_key', uid),
      db.from('blocked_clients').delete().eq('client_id', uid),
    ];
    for (const step of steps) {
      const r = await step;
      if (r.error) throw r.error;
    }
    const files = await db.storage.from('avatars').list(uid);
    if (!files.error && files.data?.length) await db.storage.from('avatars').remove(files.data.map((f) => `${uid}/${f.name}`));
    const gone = await db.auth.admin.deleteUser(uid);
    if (gone.error) throw gone.error;
    req.log.info({ userId: uid }, 'compte supprimé');
    reply.status(204);
    return null;
  });
};

export default meRoutes;
