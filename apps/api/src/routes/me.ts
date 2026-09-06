import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { chooseRoleSchema, registerPushTokenSchema, updateProfileSchema, uuid } from '@salondz/validation';
import type { Notification, Profile, SalonSummary } from '@salondz/types';
import { db } from '../lib/supabase';
import { camelize, snakeize } from '../lib/mappers';
import { unwrap } from '../lib/errors';
import { loadOwnedSalon } from '../plugins/auth';

const PROFILE_COLS = 'id, role, full_name, phone, avatar_url, gender, locale, market, whatsapp_reminders, created_at';

const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireProfile);

  /** Profil + raccourci vers le salon (pour router après connexion). */
  app.get('/me', async (req, reply) => {
    const salon = await loadOwnedSalon(req.user!.id);
    reply.header('Cache-Control', 'private, no-store');
    return {
      profile: req.profile!,
      salon: salon ? { id: salon.id, slug: salon.slug, name: salon.name, isPublished: salon.isPublished } : null,
    };
  });

  app.patch('/me', { schema: { body: updateProfileSchema } }, async (req) => {
    // Un numéro vérifié par OTP (présent dans le jeton) reste la référence : il ne se modifie pas ici.
    const { phone, ...rest } = req.body;
    const body = req.user!.phone ? rest : req.body;
    if (Object.keys(body).length === 0) return req.profile!;
    void phone;
    const res = await db.from('profiles').update(snakeize(body)).eq('id', req.user!.id).select(PROFILE_COLS).single();
    return camelize<Profile>(unwrap(res));
  });

  app.post('/me/role', { schema: { body: chooseRoleSchema } }, async (req) => {
    const res = await db.from('profiles').update({ role: req.body.role }).eq('id', req.user!.id).select(PROFILE_COLS).single();
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

  app.delete('/me/push-tokens/:token', { schema: { params: z.object({ token: z.string().min(1) }) } }, async (req, reply) => {
    await db.from('push_tokens').delete().eq('user_id', req.user!.id).eq('token', req.params.token);
    reply.status(204);
    return null;
  });

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
        db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', req.user!.id).is('read_at', null),
      ]);
      const items = camelize<Notification[]>(unwrap(listRes));
      reply.header('Cache-Control', 'private, no-store');
      return { items, nextCursor: items.length === limit ? String(cursor + limit) : null, unreadCount: unreadRes.count ?? 0 };
    },
  );

  app.post('/me/notifications/read', { schema: { body: z.object({ ids: z.array(uuid).max(200).optional() }) } }, async (req, reply) => {
    let q = db.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', req.user!.id).is('read_at', null);
    if (req.body.ids?.length) q = q.in('id', req.body.ids);
    const { error } = await q;
    if (error) throw error;
    reply.status(204);
    return null;
  });

  // ---- Favoris ----
  app.get('/me/favorites', async (req, reply) => {
    const res = await db
      .from('favorites')
      .select('salon_id, salons!inner(id, slug, name, city, zone, wilaya_code, cover_url, logo_url, gender_target, rating_avg, rating_count, is_published, salon_categories(category_id))')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });
    const rows = unwrap(res) as unknown as { salons: Record<string, unknown> & { salon_categories: { category_id: string }[]; is_published: boolean } }[];
    const items: SalonSummary[] = rows
      .filter((r) => r.salons.is_published)
      .map((r) => {
        const { salon_categories, is_published: _p, ...rest } = r.salons;
        const s = camelize<Omit<SalonSummary, 'categoryIds' | 'minPriceDa' | 'topServices' | 'nextSlots' | 'isOpenNow'>>(rest);
        return { ...s, ratingAvg: Number(s.ratingAvg), categoryIds: salon_categories.map((c) => c.category_id), minPriceDa: null, topServices: [], nextSlots: [], isOpenNow: false };
      });
    reply.header('Cache-Control', 'private, no-store');
    return { items };
  });

  app.put('/me/favorites/:salonId', { schema: { params: z.object({ salonId: uuid }) } }, async (req, reply) => {
    const { error } = await db.from('favorites').upsert({ user_id: req.user!.id, salon_id: req.params.salonId });
    if (error) throw error;
    reply.status(204);
    return null;
  });

  app.delete('/me/favorites/:salonId', { schema: { params: z.object({ salonId: uuid }) } }, async (req, reply) => {
    await db.from('favorites').delete().eq('user_id', req.user!.id).eq('salon_id', req.params.salonId);
    reply.status(204);
    return null;
  });
};

export default meRoutes;
