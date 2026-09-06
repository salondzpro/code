import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { DEFAULT_OPENING_HOURS, localDateTimeToISO, toLocalDateKey, weekKeys, addDaysToKey } from '@salondz/constants';
import { createSalonSchema, setOpeningHoursSchema, setSalonPhotosSchema, updateSalonSchema } from '@salondz/validation';
import { z } from 'zod';
import { dateKey } from '@salondz/validation';
import type { ProDashboardStats, ProStatsRange } from '@salondz/types';
import { db } from '../../lib/supabase';
import { badRequest, conflict, unwrap } from '../../lib/errors';
import { snakeize } from '../../lib/mappers';
import { loadOwnerView } from '../../lib/queries';
import { loadOwnedSalon } from '../../plugins/auth';

const proSalonRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Salon du pro connecté (null si pas encore créé → onboarding). */
  app.get('/salon', { preHandler: app.requireProfile }, async (req, reply) => {
    const salon = await loadOwnedSalon(req.user!.id);
    reply.header('Cache-Control', 'private, no-store');
    return { salon: salon ? await loadOwnerView(salon.id) : null };
  });

  /** Création du salon (onboarding). Passe le profil en "pro". */
  app.post('/salon', { preHandler: app.requireProfile, schema: { body: createSalonSchema } }, async (req, reply) => {
    const existing = await loadOwnedSalon(req.user!.id);
    if (existing) throw conflict('SALON_EXISTS', 'Vous avez déjà un salon.');
    const { categoryIds, ...rest } = req.body;

    const created = unwrap(
      await db
        .from('salons')
        .insert({ ...snakeize(rest), owner_id: req.user!.id })
        .select('id')
        .single(),
    ) as { id: string };

    const [catRes, hoursRes, roleRes] = await Promise.all([
      db.from('salon_categories').insert(categoryIds.map((category_id) => ({ salon_id: created.id, category_id }))),
      db.from('opening_hours').insert(
        DEFAULT_OPENING_HOURS.map((h) => ({
          salon_id: created.id,
          day_of_week: h.dayOfWeek,
          opens_at: h.opensAt,
          closes_at: h.closesAt,
          is_closed: h.isClosed,
        })),
      ),
      db.from('profiles').update({ role: 'pro' }).eq('id', req.user!.id),
    ]);
    for (const r of [catRes, hoursRes, roleRes]) if (r.error) throw r.error;

    reply.status(201);
    return loadOwnerView(created.id);
  });

  app.patch('/salon', { preHandler: app.requireSalon, schema: { body: updateSalonSchema } }, async (req) => {
    const salon = req.salon!;
    const { categoryIds, ...rest } = req.body;

    if (rest.isPublished === true && !salon.isPublished) {
      const view = await loadOwnerView(salon.id);
      const problems: string[] = [];
      if (!view.services.some((s) => s.isActive)) problems.push('Ajoutez au moins un service.');
      if (!view.openingHours.some((h) => !h.isClosed)) problems.push("Définissez vos horaires d'ouverture.");
      if (!view.staff.some((s) => s.isActive)) problems.push('Ajoutez au moins un membre à votre équipe.');
      if (problems.length) throw badRequest('CANNOT_PUBLISH', 'Le salon ne peut pas encore être publié.', problems);
    }

    if (Object.keys(rest).length) {
      const { error } = await db.from('salons').update(snakeize(rest)).eq('id', salon.id);
      if (error) throw error;
    }
    if (categoryIds) {
      const del = await db.from('salon_categories').delete().eq('salon_id', salon.id);
      if (del.error) throw del.error;
      const ins = await db.from('salon_categories').insert(categoryIds.map((category_id) => ({ salon_id: salon.id, category_id })));
      if (ins.error) throw ins.error;
    }
    return loadOwnerView(salon.id);
  });

  app.put('/salon/photos', { preHandler: app.requireSalon, schema: { body: setSalonPhotosSchema } }, async (req) => {
    const salon = req.salon!;
    const del = await db.from('salon_photos').delete().eq('salon_id', salon.id);
    if (del.error) throw del.error;
    if (req.body.photos.length) {
      const ins = await db.from('salon_photos').insert(req.body.photos.map((p, i) => ({ salon_id: salon.id, url: p.url, sort_order: i })));
      if (ins.error) throw ins.error;
    }
    const cover = req.body.photos[0]?.url ?? null;
    if (cover !== salon.coverUrl) {
      const upd = await db.from('salons').update({ cover_url: cover }).eq('id', salon.id);
      if (upd.error) throw upd.error;
    }
    return loadOwnerView(salon.id);
  });

  app.put('/salon/hours', { preHandler: app.requireSalon, schema: { body: setOpeningHoursSchema } }, async (req) => {
    const salon = req.salon!;
    const del = await db.from('opening_hours').delete().eq('salon_id', salon.id);
    if (del.error) throw del.error;
    const ins = await db.from('opening_hours').insert(
      req.body.hours.map((h) => ({
        salon_id: salon.id,
        day_of_week: h.dayOfWeek,
        opens_at: h.opensAt,
        closes_at: h.closesAt,
        is_closed: h.isClosed,
      })),
    );
    if (ins.error) throw ins.error;
    return loadOwnerView(salon.id);
  });

  /** Chiffres du tableau de bord (jour / semaine dimanche→samedi). */
  /** Le lien de réservation sera-t-il disponible pour ce nom ? (design « Nom de votre salon »). */
  app.get('/salon/slug-check', { preHandler: app.requireProfile, schema: { querystring: z.object({ name: z.string().trim().min(1).max(80) }) } }, async (req, reply) => {
    const slug = slugify(req.query.name);
    const res = await db.from('salons').select('id').eq('slug', slug).maybeSingle();
    if (res.error) throw res.error;
    reply.header('Cache-Control', 'private, no-store');
    return { slug, available: !res.data };
  });

  /** Statistiques d'une période (jour / semaine / mois). */
  app.get('/stats/range', { preHandler: app.requireSalon, schema: { querystring: z.object({ from: dateKey, to: dateKey }) } }, async (req, reply) => {
    const res = await db.rpc('pro_stats', { p_salon_id: req.salon!.id, p_from: req.query.from, p_to: req.query.to });
    reply.header('Cache-Control', 'private, no-store');
    return unwrap(res) as ProStatsRange;
  });

  app.get('/stats', { preHandler: app.requireSalon }, async (req, reply) => {
    const salonId = req.salon!.id;
    const today = toLocalDateKey();
    const [weekStart] = weekKeys(today);
    const monthStart = today.slice(0, 8) + '01';
    const monthEnd = addDaysToKey(monthStart.slice(0, 5) + String(Number(monthStart.slice(5, 7)) + 1).padStart(2, '0') + '-01', -1);
    const dayStart = localDateTimeToISO(today, '00:00');
    const dayEnd = localDateTimeToISO(addDaysToKey(today, 1), '00:00');
    const wStart = localDateTimeToISO(weekStart!, '00:00');
    const wEnd = localDateTimeToISO(addDaysToKey(weekStart!, 7), '00:00');

    const [todayRes, pendingRes, weekRes, todayStats, monthStats] = await Promise.all([
      db.from('bookings').select('id', { count: 'exact', head: true }).eq('salon_id', salonId).in('status', ['pending', 'confirmed', 'completed']).gte('starts_at', dayStart).lt('starts_at', dayEnd),
      db.from('bookings').select('id', { count: 'exact', head: true }).eq('salon_id', salonId).eq('status', 'pending').gte('starts_at', new Date().toISOString()),
      db.from('bookings').select('price_da, status').eq('salon_id', salonId).in('status', ['confirmed', 'completed']).gte('starts_at', wStart).lt('starts_at', wEnd),
      db.rpc('pro_stats', { p_salon_id: salonId, p_from: today, p_to: today }),
      db.rpc('pro_stats', { p_salon_id: salonId, p_from: monthStart, p_to: monthEnd.length === 10 && monthEnd > monthStart ? monthEnd : addDaysToKey(monthStart, 30) }),
    ]);
    if (todayRes.error) throw todayRes.error;
    if (pendingRes.error) throw pendingRes.error;
    const weekRows = unwrap(weekRes) as { price_da: number; status: string }[];
    const stats: ProDashboardStats = {
      todayCount: todayRes.count ?? 0,
      pendingCount: pendingRes.count ?? 0,
      weekCount: weekRows.length,
      weekRevenueDa: weekRows.reduce((sum, r) => sum + r.price_da, 0),
      todayRevenueDa: Number((unwrap(todayStats) as ProStatsRange).revenueDa ?? 0),
      monthCount: Number((unwrap(monthStats) as ProStatsRange).bookings ?? 0),
      monthRevenueDa: Number((unwrap(monthStats) as ProStatsRange).revenueDa ?? 0),
    };
    reply.header('Cache-Control', 'private, no-store');
    return stats;
  });
};

/** Même règle que la base : minuscules, sans accents, tirets. */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default proSalonRoutes;
