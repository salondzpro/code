/**
 * Espace pro — Avis : les lire, et y répondre publiquement.
 *
 * Un avis engage la réputation d'un salon, et jusqu'ici il ne pouvait rien en dire : aucun écran
 * côté pro, et pour les lire il fallait ouvrir sa propre page publique. Une réponse posée vaut
 * mieux qu'un avis laissé seul — c'est aussi ce que lisent les futurs clients.
 *
 * Le professionnel RÉPOND ; il ne corrige ni la note ni le texte de l'avis, qui ne sont jamais
 * modifiables par lui. Une seule réponse par avis : répondre à nouveau remplace la précédente,
 * répondre vide l'efface.
 */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { replyReviewSchema, uuid } from '@salondz/validation';
import { db } from '../../lib/supabase';
import { notFound, unwrap } from '../../lib/errors';

/** Un avis n'est jamais signé en entier : « Amine B. », comme sur la page publique. */
function firstNameOnly(name: string | null | undefined): string {
  if (!name) return 'Client';
  const [first, ...rest] = name.trim().split(/\s+/);
  const initial = rest[0]?.[0];
  return initial ? `${first} ${initial}.` : (first ?? 'Client');
}

type Row = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reply: string | null;
  replied_at: string | null;
  booking_id: string;
  profiles: { full_name: string | null } | null;
  bookings: { service_name: string; starts_at: string } | null;
};

const proReviewRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireSalon);

  /** Avis du salon, plus récents d'abord ; `unanswered` pour ne voir que ceux qui attendent. */
  app.get(
    '/reviews',
    {
      schema: {
        querystring: z.object({
          cursor: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(50).default(20),
          unanswered: z.coerce.boolean().optional(),
        }),
      },
    },
    async (req, reply) => {
      const { limit, unanswered } = req.query;
      const offset = Number(req.query.cursor ?? 0) || 0;
      let q = db
        .from('reviews')
        .select(
          'id, rating, comment, created_at, reply, replied_at, booking_id, profiles(full_name), bookings(service_name, starts_at)',
        )
        .eq('salon_id', req.salon!.id);
      if (unanswered) q = q.is('reply', null);
      const rows = unwrap(
        await q.order('created_at', { ascending: false }).range(offset, offset + limit - 1),
      ) as unknown as Row[];
      reply.header('Cache-Control', 'private, no-store');
      const items = rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        authorName: firstNameOnly(r.profiles?.full_name),
        reply: r.reply,
        repliedAt: r.replied_at,
        bookingId: r.booking_id,
        serviceName: r.bookings?.service_name ?? '',
        startsAt: r.bookings?.starts_at ?? r.created_at,
      }));
      return { items, nextCursor: items.length === limit ? String(offset + limit) : null };
    },
  );

  /** Compteur pour la pastille « avis sans réponse ». */
  app.get('/reviews/unanswered', async (req, reply) => {
    const res = await db
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', req.salon!.id)
      .is('reply', null);
    if (res.error) throw res.error;
    reply.header('Cache-Control', 'private, no-store');
    return { count: res.count ?? 0 };
  });

  /**
   * Répondre. Le filtre porte AUSSI sur `salon_id` : un professionnel ne répond jamais à l'avis
   * d'un autre salon, même en devinant un identifiant.
   */
  app.put(
    '/reviews/:id/reply',
    { schema: { params: z.object({ id: uuid }), body: replyReviewSchema } },
    async (req, reply) => {
      const texte = req.body.reply.trim();
      const res = await db
        .from('reviews')
        .update({ reply: texte || null, replied_at: texte ? new Date().toISOString() : null })
        .eq('id', req.params.id)
        .eq('salon_id', req.salon!.id)
        .select('id, reply, replied_at')
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) throw notFound('Avis');
      reply.header('Cache-Control', 'private, no-store');
      const d = res.data as { id: string; reply: string | null; replied_at: string | null };
      return { id: d.id, reply: d.reply, repliedAt: d.replied_at };
    },
  );
};

export default proReviewRoutes;
