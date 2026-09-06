import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { WILAYAS } from '@salondz/constants';
import { availabilityQuerySchema, citiesQuerySchema, searchSalonsQuerySchema, uuid } from '@salondz/validation';
import type { AvailabilityResponse, Category, CityCount, SalonSummary } from '@salondz/types';
import { db } from '../lib/supabase';
import { camelize } from '../lib/mappers';
import { badRequest, notFound, unwrap } from '../lib/errors';
import { loadPublicBySlug } from '../lib/queries';

const CACHE_PUBLIC_LONG = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';
const CACHE_PUBLIC_SHORT = 'public, max-age=60, s-maxage=120, stale-while-revalidate=600';
// Disponibilités : jamais servies depuis le cache sans revalidation (ETag → 304 si inchangé) :
// un créneau qui vient d'être pris ne doit plus apparaître, même 5 s plus tard.
const CACHE_AVAILABILITY = 'public, no-cache';
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

  /** Quartiers / villes avec nombre de professionnels (design « Localisation »). */
  app.get('/salons/cities', { schema: { querystring: citiesQuerySchema } }, async (req, reply) => {
    const q = req.query;
    const res = await db.rpc('salon_cities', { p_wilaya: q.wilaya ?? null, p_gender: q.gender ?? null, p_lat: q.lat ?? null, p_lng: q.lng ?? null, p_q: q.q ?? null });
    const rows = unwrap(res) as Record<string, unknown>[];
    reply.header('Cache-Control', CACHE_PUBLIC_SHORT);
    return { items: rows.map((r) => camelize<CityCount>(r)) };
  });

  /** Marketplace (design C-H 01 / C-F 01) : rayon, tri, dispo du jour, prestations phares, prochains créneaux. */
  app.get('/salons', { schema: { querystring: searchSalonsQuerySchema } }, async (req, reply) => {
    const q = req.query;
    const res = await db.rpc('search_salons_v2', {
      p_q: q.q ?? null,
      p_wilaya: q.wilaya ?? null,
      p_city: q.city ?? null,
      p_category: q.category ?? null,
      p_gender: q.gender ?? null,
      p_lat: q.lat ?? null,
      p_lng: q.lng ?? null,
      p_radius_km: q.radiusKm ?? null,
      p_sort: q.sort ?? 'relevance',
      p_available_today: q.availableToday ?? false,
      p_limit: q.limit,
      p_offset: q.offset,
    });
    const rows = unwrap(res) as Record<string, unknown>[];
    let total = 0;
    const items: SalonSummary[] = rows.map((r) => {
      const { top_services, next_slots, is_open_now, total_count, ...rest } = r as Record<string, unknown> & {
        top_services: { name: string; priceDa: number }[] | null;
        next_slots: string[] | null;
        is_open_now: boolean;
        total_count: number | string;
      };
      total = Number(total_count);
      const s = camelize<Omit<SalonSummary, 'topServices' | 'nextSlots' | 'isOpenNow'>>(rest);
      return { ...s, ratingAvg: Number(s.ratingAvg), topServices: top_services ?? [], nextSlots: next_slots ?? [], isOpenNow: !!is_open_now };
    });
    reply.header('Cache-Control', CACHE_PUBLIC_SHORT);
    return { items, total, nextCursor: items.length === q.limit ? String(q.offset + q.limit) : null };
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
      const { date, staffId } = req.query;
      const serviceIds = [...(req.query.serviceIds ? req.query.serviceIds.split(',') : []), ...(req.query.serviceId ? [req.query.serviceId] : [])].filter((v, i, a) => a.indexOf(v) === i);

      const [salonRes, totalRes] = await Promise.all([
        db.from('salons').select('id, slot_interval_minutes, is_published, owner_id').eq('id', id).maybeSingle(),
        db.rpc('services_total', { p_salon_id: id, p_service_ids: serviceIds }).single(),
      ]);
      const salon = unwrap(salonRes, 'Salon');
      if (!salon.is_published && req.user?.id !== salon.owner_id) throw notFound('Salon');
      const total = unwrap(totalRes) as { duration_minutes: number; price_da: number; label: string | null; n: number };
      if (total.n !== serviceIds.length) throw badRequest('SERVICE_INACTIVE', "Ce service n'est plus proposé.");
      // Durée totale des prestations enchaînées → une seule source de vérité (SQL)
      const slotsRes = await db.rpc('get_available_slots_for', {
        p_salon_id: id,
        p_duration_minutes: total.duration_minutes,
        p_date: date,
        p_staff_id: staffId ?? null,
        p_enforce_lead_time: true,
      });
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
        serviceId: serviceIds[0]!,
        serviceIds,
        date,
        slotIntervalMinutes: salon.slot_interval_minutes,
        durationMinutes: total.duration_minutes,
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
