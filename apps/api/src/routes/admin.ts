/**
 * Espace d'administration de la place de marché — VOIR (lot 1) et AGIR (lot 2).
 *
 * Conception dans `docs/ADMIN.md`. L'essentiel du travail d'un opérateur tient en une phrase :
 * « retrouve-moi ce salon et montre-moi ce qu'il voit ». Le reste — suspendre, masquer, annuler au
 * nom de la plateforme — sert les jours où il faut arrêter quelque chose.
 *
 * Trois règles tenues ici :
 *   • le garde est SERVEUR (`requireAdmin`) : les écrans ne protègent rien ;
 *   • la consultation d'une fiche nominative laisse une trace, et TOUTE action aussi, avec son
 *     motif. Un opérateur agit sur les données d'autrui ; il doit pouvoir s'en expliquer ;
 *   • rien ne se supprime : on suspend, on masque, on rétablit. La seule exception est la
 *     suppression d'un compte à la demande de son titulaire, réservée au niveau `owner`.
 */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { BOOKING_STATUSES } from '@salondz/constants';
import { phoneDZ, uuid } from '@salondz/validation';
import { db } from '../lib/supabase';
import { badRequest, notFound, unwrap } from '../lib/errors';
import { camelize, snakeize } from '../lib/mappers';
import { loadOwnerView } from '../lib/queries';
import { trace } from '../lib/audit';
import { cancelAsPlatform, eraseClientAccount } from '../lib/moderation';

const page = z.object({
  q: z.string().trim().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/**
 * Le motif. Obligatoire sur toute action, et pas pour la forme : c'est ce qu'on relira dans six
 * mois, et ce qu'on devra pouvoir dire à la personne concernée. « ok » ou « test » ne sont pas des
 * motifs — d'où le minimum.
 */
const motif = z.string().trim().min(8).max(300);

const SUSPENSION_COLS = 'id, name, slug, is_published, suspended_at, suspension_level, suspended_reason';

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
    const [salon, suspension, owner, bookings, reviews, audit] = await Promise.all([
      loadOwnerView(id),
      db.from('salons').select('suspended_at, suspension_level, suspended_reason').eq('id', id).maybeSingle(),
      db.from('profiles').select('id, full_name, phone, avatar_url, created_at').eq('id', ownerId).maybeSingle(),
      db
        .from('bookings')
        .select('id, starts_at, status, service_name, price_da, client_name, client_phone, source, created_at')
        .eq('salon_id', id)
        .order('starts_at', { ascending: false })
        .limit(20),
      db
        .from('reviews')
        .select('id, rating, comment, created_at, reply, replied_at, hidden_at, hidden_reason')
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
      // La suspension ne voyage pas dans l'objet `Salon` (qui sert aussi la fiche publique) : on la
      // rend à part, avec son motif — c'est ce qu'on relit avant de décider de lever ou non.
      suspension: camelize(suspension.data ?? { suspended_at: null, suspension_level: null, suspended_reason: null }),
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
      .select('id, role, full_name, phone, avatar_url, gender, locale, market, created_at, suspended_at, suspended_reason')
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
      db.from('reviews').select('id, rating, comment, created_at, hidden_at, hidden_reason, salons(name, slug)').eq('client_id', id).order('created_at', { ascending: false }).limit(20),
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


  // ================================================================== LOT 2 : agir
  //
  // Toute action porte un MOTIF obligatoire et laisse une ligne au journal. Ce n'est pas une
  // formalité : une suspension se justifie devant la personne suspendue, et six mois plus tard
  // il ne reste que ce qu'on a écrit.
  //
  // Rien ne se supprime jamais : on suspend, on masque, on rétablit. Un avis masqué reste en base,
  // un salon suspendu garde ses rendez-vous, un compte suspendu garde son historique.

  /** Suspendre un salon. `frozen` gèle les réservations, `hidden` le retire de la place de marché. */
  app.post(
    '/salons/:id/suspend',
    {
      schema: {
        params: z.object({ id: uuid }),
        body: z.object({ level: z.enum(['frozen', 'hidden']), reason: motif }),
      },
    },
    async (req) => {
      const { id } = req.params;
      const { level, reason } = req.body;
      const res = await db
        .from('salons')
        .update({
          suspended_at: new Date().toISOString(),
          suspension_level: level,
          suspended_reason: reason,
          suspended_by: req.admin!.id,
        })
        .eq('id', id)
        .select(SUSPENSION_COLS)
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) throw notFound('Salon');
      await trace(req, level === 'hidden' ? 'salon_hidden' : 'salon_frozen', 'salon', id, reason);
      return camelize(res.data);
    },
  );

  /** Lever la suspension d'un salon. Le motif reste au journal, pas sur la fiche. */
  app.post(
    '/salons/:id/unsuspend',
    { schema: { params: z.object({ id: uuid }), body: z.object({ reason: motif.optional() }) } },
    async (req) => {
      const { id } = req.params;
      const res = await db
        .from('salons')
        .update({ suspended_at: null, suspension_level: null, suspended_reason: null, suspended_by: null })
        .eq('id', id)
        .select(SUSPENSION_COLS)
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) throw notFound('Salon');
      await trace(req, 'salon_unsuspended', 'salon', id, req.body.reason ?? null);
      return camelize(res.data);
    },
  );

  /** Suspendre un client : plus de réservation EN LIGNE, sur toute la place de marché. */
  app.post(
    '/profiles/:id/suspend',
    { schema: { params: z.object({ id: uuid }), body: z.object({ reason: motif }) } },
    async (req) => {
      const { id } = req.params;
      const { reason } = req.body;
      const res = await db
        .from('profiles')
        .update({ suspended_at: new Date().toISOString(), suspended_reason: reason, suspended_by: req.admin!.id })
        .eq('id', id)
        .select('id, suspended_at, suspended_reason')
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) throw notFound('Compte');
      await trace(req, 'profile_suspended', 'profile', id, reason);
      return camelize(res.data);
    },
  );

  app.post(
    '/profiles/:id/unsuspend',
    { schema: { params: z.object({ id: uuid }), body: z.object({ reason: motif.optional() }) } },
    async (req) => {
      const { id } = req.params;
      const res = await db
        .from('profiles')
        .update({ suspended_at: null, suspended_reason: null, suspended_by: null })
        .eq('id', id)
        .select('id, suspended_at, suspended_reason')
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) throw notFound('Compte');
      await trace(req, 'profile_unsuspended', 'profile', id, req.body.reason ?? null);
      return camelize(res.data);
    },
  );

  /**
   * Corriger l'identité d'un compte. Le cas réel : un numéro mal saisi, et le client ne reçoit plus
   * ni rappel ni confirmation. `PATCH /me` le verrouille dès le premier rendez-vous et renvoie vers
   * le support — le support, c'est ici.
   */
  app.patch(
    '/profiles/:id',
    {
      schema: {
        params: z.object({ id: uuid }),
        body: z.object({ fullName: z.string().trim().min(1).max(80).optional(), phone: phoneDZ.optional(), reason: motif }),
      },
    },
    async (req) => {
      const { id } = req.params;
      const { reason, ...champs } = req.body;
      if (Object.keys(champs).length === 0) throw badRequest('NOTHING_TO_UPDATE', 'Rien à modifier.');
      const res = await db
        .from('profiles')
        .update(snakeize(champs))
        .eq('id', id)
        .select('id, full_name, phone')
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) throw notFound('Compte');
      await trace(req, 'profile_edited', 'profile', id, `${reason} · ${Object.keys(champs).join(', ')}`);
      return camelize(res.data);
    },
  );

  /** Masquer un avis : il quitte la page publique ET le calcul de la note, sans être supprimé. */
  app.post(
    '/reviews/:id/hide',
    { schema: { params: z.object({ id: uuid }), body: z.object({ reason: motif }) } },
    async (req) => {
      const { id } = req.params;
      const { reason } = req.body;
      const res = await db
        .from('reviews')
        .update({ hidden_at: new Date().toISOString(), hidden_reason: reason, hidden_by: req.admin!.id })
        .eq('id', id)
        .select('id, salon_id, hidden_at, hidden_reason')
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) throw notFound('Avis');
      await trace(req, 'review_hidden', 'review', id, reason);
      return camelize(res.data);
    },
  );

  app.post(
    '/reviews/:id/unhide',
    { schema: { params: z.object({ id: uuid }), body: z.object({ reason: motif.optional() }) } },
    async (req) => {
      const { id } = req.params;
      const res = await db
        .from('reviews')
        .update({ hidden_at: null, hidden_reason: null, hidden_by: null })
        .eq('id', id)
        .select('id, salon_id, hidden_at, hidden_reason')
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) throw notFound('Avis');
      await trace(req, 'review_unhidden', 'review', id, req.body.reason ?? null);
      return camelize(res.data);
    },
  );

  /**
   * Annuler un rendez-vous au nom de la plateforme. Les deux parties sont prévenues, et le créneau
   * repart en liste d'attente comme pour n'importe quelle annulation.
   */
  app.post(
    '/bookings/:id/cancel',
    { schema: { params: z.object({ id: uuid }), body: z.object({ reason: motif }) } },
    async (req) => {
      const { id } = req.params;
      const { reason } = req.body;
      const annule = await cancelAsPlatform(req.log, id, reason);
      await trace(req, 'booking_cancelled', 'booking', id, reason);
      return annule;
    },
  );


  /**
   * Supprimer un compte client — niveau `owner` uniquement, et geste irréversible.
   *
   * C'est le même effacement que celui qu'une personne déclenche depuis l'application, mais demandé
   * par courrier ou par téléphone (loi 18-07). Les rendez-vous PASSÉS sont anonymisés et non
   * supprimés : ils appartiennent aussi à la comptabilité du salon.
   */
  app.delete(
    '/profiles/:id',
    {
      preHandler: app.requireOwner,
      schema: { params: z.object({ id: uuid }), body: z.object({ reason: motif }) },
    },
    async (req, reply) => {
      const { id } = req.params;
      // La trace s'écrit AVANT : après, le compte n'existe plus et la ligne perdrait son sujet.
      await trace(req, 'profile_deleted', 'profile', id, req.body.reason);
      await eraseClientAccount(req.log, id);
      reply.status(204);
      return null;
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
