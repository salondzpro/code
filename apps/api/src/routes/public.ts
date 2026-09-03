import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { WILAYAS } from '@salondz/constants';
import { availabilityQuerySchema, searchSalonsQuerySchema, uuid } from '@salondz/validation';
import type { AvailabilityResponse, Category, SalonSummary } from '@salondz/types';
import { db } from '../lib/supabase';
import { camelize } from '../lib/mappers';
import { badRequest, notFound, unwrap } from '../lib/errors';
import { loadPublicBySlug } from '../lib/queries';

const CACHE_PUBLIC_LONG = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';
const CACHE_PUBLIC_SHORT = 'public, max-age=60, s-maxage=120, stale-while-revalidate=600';
const CACHE_AVAILABILITY = 'public, max-age=10, stale-while-revalidate=20';
// Avis : toujours revalidé (ETag → 304 si inchangé) pour qu'un avis tout juste publié
// apparaisse immédiatement. Pas de stale-while-revalidate : Chrome resservirait la copie
// périmée et ne revaliderait qu'en arrière-plan.
const CACHE_PUBLIC_REVALIDATE = 'public, no-cache';

const publicRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/categories', async (_req, reply) => {
    const rows = unwrap(await db.from('categories').select('*').order('sort_order'));
    reply.header('Cache-Control', CACHE_PUBLIC_LONG);
    return camelize<Category[]>(rows);
  });

  app.get('/wilayas', async (_req, reply) => {
    reply.header('Cache-Control', CACHE_PUBLIC_LONG);
    return WILAYAS;
  });

  app.get('/salons', { schema: { querystring: searchSalonsQuerySchema } }, async (req, reply) => {
    const q = req.query;
    const res = await db.rpc('search_salons', {
      p_q: q.q ?? null,
      p_wilaya: q.wilaya ?? null,
      p_city: q.city ?? null,
      p_category: q.category ?? null,
      p_gender: q.gender ?? null,
      p_lat: q.lat ?? null,
      p_lng: q.lng ?? null,
      p_limit: q.limit,
      p_offset: q.offset,
    });
    const rows = unwrap(res) as Record<string, unknown>[];
    const items = rows.map((r) => {
      const s = camelize<SalonSummary & { distanceKm: number | null }>(r);
      return { ...s, ratingAvg: Number(s.ratingAvg) };
    });
    reply.header('Cache-Control', CACHE_PUBLIC_SHORT);
    return { items, nextCursor: items.length === q.limit ? String(q.offset + q.limit) : null };
  });

  app.get('/salons/:slug', { schema: { params: z.object({ slug: z.string().min(1).max(80) }) } }, async (req, reply) => {
    const salon = await loadPublicBySlug(req.params.slug);
    if (!salon) throw notFound('Salon');
    const isOwner = req.user?.id === salon.ownerId;
    if (!salon.isPublished && !isOwner) throw notFound('Salon');
    reply.header('Cache-Control', isOwner ? 'private, no-cache' : CACHE_PUBLIC_SHORT);
    return salon;
  });

  app.get(
    '/salons/:id/availability',
    { schema: { params: z.object({ id: uuid }), querystring: availabilityQuerySchema } },
    async (req, reply) => {
      const { id } = req.params;
      const { serviceId, date, staffId } = req.query;

      const [salonRes, serviceRes, slotsRes] = await Promise.all([
        db.from('salons').select('id, slot_interval_minutes, is_published, owner_id').eq('id', id).maybeSingle(),
        db.from('services').select('id, duration_minutes, is_active').eq('id', serviceId).eq('salon_id', id).maybeSingle(),
        db.rpc('get_available_slots', {
          p_salon_id: id,
          p_service_id: serviceId,
          p_date: date,
          p_staff_id: staffId ?? null,
          p_enforce_lead_time: true,
        }),
      ]);
      const salon = unwrap(salonRes, 'Salon');
      const service = unwrap(serviceRes, 'Service');
      if (!salon.is_published && req.user?.id !== salon.owner_id) throw notFound('Salon');
      if (!service.is_active) throw badRequest('SERVICE_INACTIVE', "Ce service n'est plus proposé.");
      const rows = unwrap(slotsRes) as { slot_start: string; staff_id: string }[];

      const grouped = new Map<string, string[]>();
      for (const r of rows) {
        const key = new Date(r.slot_start).toISOString();
        const list = grouped.get(key) ?? [];
        list.push(r.staff_id);
        grouped.set(key, list);
      }
      const body: AvailabilityResponse = {
        salonId: id,
        serviceId,
        date,
        slotIntervalMinutes: salon.slot_interval_minutes,
        durationMinutes: service.duration_minutes,
        slots: [...grouped.entries()].map(([startsAt, staffIds]) => ({ startsAt, staffIds })),
      };
      reply.header('Cache-Control', CACHE_AVAILABILITY);
      return body;
    },
  );

  app.get(
    '/salons/:id/reviews',
    {
      schema: {
        params: z.object({ id: uuid }),
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(50).default(20),
          offset: z.coerce.number().int().min(0).default(0),
        }),
      },
    },
    async (req, reply) => {
      const { limit, offset } = req.query;
      const res = await db
        .from('reviews')
        .select('id, rating, comment, created_at, profiles(full_name)')
        .eq('salon_id', req.params.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      const rows = unwrap(res) as unknown as { id: string; rating: number; comment: string | null; created_at: string; profiles: { full_name: string | null } | null }[];
      const items = rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        authorName: firstNameOnly(r.profiles?.full_name),
      }));
      reply.header('Cache-Control', CACHE_PUBLIC_REVALIDATE);
      return { items, nextCursor: items.length === limit ? String(offset + limit) : null };
    },
  );
};

function firstNameOnly(name: string | null | undefined): string {
  if (!name) return 'Client';
  const [first, ...rest] = name.trim().split(/\s+/);
  const initial = rest[0]?.[0];
  return initial ? `${first} ${initial}.` : (first ?? 'Client');
}

export default publicRoutes;
