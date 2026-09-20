/**
 * Espace d'administration de la place de marché — LOT 1 : voir.
 *
 * Conception dans `docs/ADMIN.md`. Ce lot ne modifie rien : il répond à « retrouve-moi ce salon et
 * montre-moi ce qu'il voit », qui est l'essentiel du travail d'un opérateur au quotidien. Les
 * actions (suspendre, masquer, annuler au nom de la plateforme) viennent au lot 2, avec leur motif
 * obligatoire et leurs effets dans toute l'application.
 *
 * Deux règles tenues ici :
 *   • le garde est SERVEUR (`requireAdmin`) : les écrans ne protègent rien ;
 *   • la consultation d'une fiche nominative laisse une trace. Un opérateur consulte les données
 *     d'autrui ; savoir qui a regardé quoi fait partie du contrat.
 */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { BOOKING_STATUSES } from '@salondz/constants';
import { uuid } from '@salondz/validation';
import { db } from '../lib/supabase';
import { notFound, unwrap } from '../lib/errors';
import { camelize } from '../lib/mappers';
import { loadOwnerView } from '../lib/queries';

/** Une consultation nominative se trace ; une liste ou un compteur, non. */
async function trace(
  req: { admin: { id: string } | null; ip: string; log: { warn: (o: unknown, m: string) => void } },
  action: string,
  targetType: string,
  targetId: string,
): Promise<void> {
  const res = await db.from('admin_audit').insert({
    admin_id: req.admin!.id,
    action,
    target_type: targetType,
    target_id: targetId,
    ip: req.ip,
  });
  // Le journal ne doit jamais empêcher de travailler : on le signale, on continue.
  if (res.error) req.log.warn({ err: res.error }, 'admin_audit');
}

const page = z.object({
  q: z.string().trim().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  // Limite propre à l'administration, plus serrée que la limite générale : trois personnes
  // travaillent ici, et un balayage de `/v1/admin/*` doit buter bien avant la limite d'un client.
  app.addHook('onRoute', (route) => {
    route.config = { ...(route.config ?? {}), rateLimit: { max: 120, timeWindow: '1 minute' } };
  });
  app.addHook('preHandler', app.requireAdmin);
  app.addHook('onSend', async (_req, reply) => {
    // Rien de ce qui sort d'ici ne se met en cache, nulle part.
    reply.header('Cache-Control', 'private, no-store');
  });

  /** Qui suis-je ? L'interface s'en sert pour afficher ou non les actions du niveau `owner`. */
  app.get('/me', async (req) => ({ id: req.admin!.id, level: req.admin!.level }));

  /** Tableau de bord : tout en une requête (voir `admin_overview`). */
  app.get('/overview', async () => {
    const res = await db.rpc('admin_overview');
    return unwrap(res) as Record<string, unknown>;
  });

  // ------------------------------------------------------------------ professionnels
  app.get(
    '/salons',
    {
      schema: {
        querystring: page.extend({
          status: z.enum(['published', 'draft']).optional(),
          wilaya: z.coerce.number().int().min(1).max(58).optional(),
        }),
      },
    },
    async (req) => {
      const { q, limit, status, wilaya } = req.query;
      const offset = Number(req.query.cursor ?? 0) || 0;
      const rows = unwrap(
        await db.rpc('admin_salons_page', {
          p_q: q ?? null,
          p_status: status ?? null,
          p_wilaya: wilaya ?? null,
          p_limit: limit,
          p_offset: offset,
        }),
      ) as Record<string, unknown>[];
      const total = rows.length ? Number(rows[0]!.total_count) : 0;
      const items = rows.map(({ total_count: _t, ...r }) => camelize(r));
      return { items, total, nextCursor: items.length === limit ? String(offset + limit) : null };
    },
  );

  /**
   * Fiche d'un salon : la vue COMPLÈTE du propriétaire (catalogue, équipe, horaires, photos),
   * la même que le professionnel a sous les yeux — c'est tout l'intérêt quand il appelle — plus
   * ses derniers rendez-vous, ses avis, et le journal des actions le concernant.
   */
  app.get('/salons/:id', { schema: { params: z.object({ id: uuid }) } }, async (req) => {
    const { id } = req.params;
    const exists = await db.from('salons').select('id, owner_id').eq('id', id).maybeSingle();
    if (exists.error) throw exists.error;
    if (!exists.data) throw notFound('Salon');
    await trace(req, 'view_salon', 'salon', id);

    const ownerId = (exists.data as { owner_id: string }).owner_id;
    const [salon, owner, bookings, reviews, audit] = await Promise.all([
      loadOwnerView(id),
      db.from('profiles').select('id, full_name, phone, avatar_url, created_at').eq('id', ownerId).maybeSingle(),
      db
        .from('bookings')
        .select('id, starts_at, status, service_name, price_da, client_name, client_phone, source, created_at')
        .eq('salon_id', id)
        .order('starts_at', { ascending: false })
        .limit(20),
      db
        .from('reviews')
        .select('id, rating, comment, created_at, reply, replied_at')
        .eq('salon_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      db
        .from('admin_audit')
        .select('id, action, reason, created_at, admin_id')
        .eq('target_type', 'salon')
        .eq('target_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    // L'e-mail vit dans le schéma `auth`, hors de portée de PostgREST : on passe par
    // l'administration Supabase, que la clé secrète autorise.
    const compte = await db.auth.admin.getUserById(ownerId).catch(() => null);
    return {
      salon,
      owner: owner.data ? camelize(owner.data) : null,
      ownerEmail: compte?.data.user?.email ?? null,
      bookings: camelize(bookings.data ?? []),
      reviews: camelize(reviews.data ?? []),
      audit: camelize(audit.data ?? []),
    };
  });

  // ------------------------------------------------------------------ comptes
  app.get(
    '/profiles',
    { schema: { querystring: page.extend({ role: z.enum(['client', 'pro']).optional() }) } },
    async (req) => {
      const { q, limit, role } = req.query;
      const offset = Number(req.query.cursor ?? 0) || 0;
      const rows = unwrap(
        await db.rpc('admin_profiles_page', {
          p_q: q ?? null,
          p_role: role ?? null,
          p_limit: limit,
          p_offset: offset,
        }),
      ) as Record<string, unknown>[];
      const total = rows.length ? Number(rows[0]!.total_count) : 0;
      const items = rows.map(({ total_count: _t, ...r }) => camelize(r));
      return { items, total, nextCursor: items.length === limit ? String(offset + limit) : null };
    },
  );

  /** Fiche d'un compte : identité, rendez-vous, avis, salons qui l'ont bloqué. */
  app.get('/profiles/:id', { schema: { params: z.object({ id: uuid }) } }, async (req) => {
    const { id } = req.params;
    const profil = await db
      .from('profiles')
      .select('id, role, full_name, phone, avatar_url, gender, locale, market, created_at')
      .eq('id', id)
      .maybeSingle();
    if (profil.error) throw profil.error;
    if (!profil.data) throw notFound('Compte');
    await trace(req, 'view_profile', 'profile', id);

    const [bookings, reviews, blocked, salon] = await Promise.all([
      db
        .from('bookings')
        .select('id, starts_at, status, service_name, price_da, cancelled_by, cancellation_reason, salons(name, slug)')
        .eq('client_id', id)
        .order('starts_at', { ascending: false })
        .limit(30),
      db.from('reviews').select('id, rating, comment, created_at, salons(name, slug)').eq('client_id', id).order('created_at', { ascending: false }).limit(20),
      db.from('blocked_clients').select('salon_id, reason, created_at, salons(name, slug)').eq('client_id', id),
      db.from('salons').select('id, slug, name, is_published').eq('owner_id', id).maybeSingle(),
    ]);
    const compte = await db.auth.admin.getUserById(id).catch(() => null);
    return {
      profile: camelize(profil.data),
      email: compte?.data.user?.email ?? null,
      bookings: camelize(bookings.data ?? []),
      reviews: camelize(reviews.data ?? []),
      blockedBy: camelize(blocked.data ?? []),
      salon: salon.data ? camelize(salon.data) : null,
    };
  });

  // ------------------------------------------------------------------ rendez-vous
  app.get(
    '/bookings',
    {
      schema: {
        querystring: page.extend({
          status: z.enum(BOOKING_STATUSES).optional(),
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        }),
      },
    },
    async (req) => {
      const { q, limit, status, from, to } = req.query;
      const offset = Number(req.query.cursor ?? 0) || 0;
      const rows = unwrap(
        await db.rpc('admin_bookings_page', {
          p_q: q ?? null,
          p_status: status ?? null,
          p_from: from ?? null,
          p_to: to ?? null,
          p_limit: limit,
          p_offset: offset,
        }),
      ) as Record<string, unknown>[];
      const total = rows.length ? Number(rows[0]!.total_count) : 0;
      const items = rows.map(({ total_count: _t, ...r }) => camelize(r));
      return { items, total, nextCursor: items.length === limit ? String(offset + limit) : null };
    },
  );

  // ------------------------------------------------------------------ journal
  app.get('/audit', { schema: { querystring: page } }, async (req) => {
    const { limit } = req.query;
    const offset = Number(req.query.cursor ?? 0) || 0;
    const res = await db
      .from('admin_audit')
      .select('id, admin_id, action, target_type, target_id, reason, ip, created_at, profiles!admin_audit_admin_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    const rows = unwrap(res) as Record<string, unknown>[];
    const items = rows.map((r) => camelize(r));
    return { items, nextCursor: items.length === limit ? String(offset + limit) : null };
  });
};

export default adminRoutes;
