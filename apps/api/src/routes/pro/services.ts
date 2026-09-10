import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { MAX_SERVICES_PER_SALON, categoryLabel } from '@salondz/constants';
import {
  createServiceSchema,
  renameCategorySchema,
  setServicePhotosSchema,
  updateServiceSchema,
  uuid,
} from '@salondz/validation';
import type { Service } from '@salondz/types';
import { db } from '../../lib/supabase';
import { conflict, notFound, unwrap } from '../../lib/errors';
import { camelize, snakeize } from '../../lib/mappers';
import { SERVICE_COLS } from '../../lib/queries';

/**
 * Les catégories Salon DZ du salon (marketplace, filtres) suivent ses prestations : plus d'étape de choix.
 * Recalculées après chaque création / modification ; on ne vide jamais la liste (un salon reste classé).
 */
async function syncSalonCategories(salonId: string): Promise<void> {
  const res = await db
    .from('services')
    .select('category_id')
    .eq('salon_id', salonId)
    .eq('is_active', true);
  if (res.error) throw res.error;
  const ids = [
    ...new Set(
      (res.data as { category_id: string | null }[])
        .map((r) => r.category_id)
        .filter((x): x is string => !!x),
    ),
  ];
  if (ids.length === 0) return;
  const del = await db.from('salon_categories').delete().eq('salon_id', salonId);
  if (del.error) throw del.error;
  const ins = await db
    .from('salon_categories')
    .insert(ids.map((category_id) => ({ salon_id: salonId, category_id })));
  if (ins.error) throw ins.error;
}

const proServiceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireSalon);

  /** Renomme une catégorie (titre seulement) : toutes les prestations du groupe passent sous le nouveau nom. */
  app.post('/services/rename-category', { schema: { body: renameCategorySchema } }, async (req) => {
    const salonId = req.salon!.id;
    const { from, name } = req.body;
    const res = await db
      .from('services')
      .select('id, category_id, group_name')
      .eq('salon_id', salonId);
    if (res.error) throw res.error;
    const rows = res.data as {
      id: string;
      category_id: string | null;
      group_name: string | null;
    }[];
    const current = (r: (typeof rows)[number]) =>
      r.group_name?.trim() || (r.category_id ? categoryLabel(r.category_id) : null);
    const targets = rows.filter((r) => current(r) === from);
    if (targets.length === 0) throw notFound('Catégorie');
    for (const r of targets) {
      // Retour au libellé Salon DZ = plus de surnom.
      const group_name = r.category_id && categoryLabel(r.category_id) === name ? null : name;
      const upd = await db
        .from('services')
        .update({ group_name })
        .eq('id', r.id)
        .eq('salon_id', salonId);
      if (upd.error) throw upd.error;
    }
    return { renamed: targets.length };
  });

  app.post('/services', { schema: { body: createServiceSchema } }, async (req, reply) => {
    const salonId = req.salon!.id;
    const { count } = await db
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', salonId);
    if ((count ?? 0) >= MAX_SERVICES_PER_SALON)
      throw conflict(
        'LIMIT_REACHED',
        `Un catalogue compte au plus ${MAX_SERVICES_PER_SALON} prestations.`,
      );
    const res = await db
      .from('services')
      .insert({ ...snakeize(req.body), salon_id: salonId, sort_order: count ?? 0 })
      .select(SERVICE_COLS)
      .single();
    const created = camelize<Service>(unwrap(res));
    await syncSalonCategories(salonId);
    reply.status(201);
    return created;
  });

  app.patch(
    '/services/:id',
    { schema: { params: z.object({ id: uuid }), body: updateServiceSchema } },
    async (req) => {
      const res = await db
        .from('services')
        .update(snakeize(req.body))
        .eq('id', req.params.id)
        .eq('salon_id', req.salon!.id)
        .select(SERVICE_COLS)
        .maybeSingle();
      if (res.error) throw res.error;
      if (!res.data) throw notFound('Service');
      await syncSalonCategories(req.salon!.id);
      return camelize<Service>(res.data);
    },
  );

  /** Supprime si jamais réservé, sinon désactive (historique préservé). */
  app.delete(
    '/services/:id',
    { schema: { params: z.object({ id: uuid }) } },
    async (req, reply) => {
      const salonId = req.salon!.id;
      const del = await db
        .from('services')
        .delete()
        .eq('id', req.params.id)
        .eq('salon_id', salonId)
        .select('id')
        .maybeSingle();
      if (del.error) {
        if (del.error.code !== '23503') throw del.error;
        const upd = await db
          .from('services')
          .update({ is_active: false })
          .eq('id', req.params.id)
          .eq('salon_id', salonId)
          .select('id')
          .maybeSingle();
        if (upd.error) throw upd.error;
        if (!upd.data) throw notFound('Service');
        return { deleted: false, deactivated: true };
      }
      if (!del.data) throw notFound('Service');
      reply.status(200);
      return { deleted: true, deactivated: false };
    },
  );

  app.put(
    '/services/reorder',
    { schema: { body: z.object({ ids: z.array(uuid).min(1).max(200) }) } },
    async (req, reply) => {
      const salonId = req.salon!.id;
      const results = await Promise.all(
        req.body.ids.map((id, i) =>
          db.from('services').update({ sort_order: i }).eq('id', id).eq('salon_id', salonId),
        ),
      );
      for (const r of results) if (r.error) throw r.error;
      reply.status(204);
      return null;
    },
  );

  /** Photos de la prestation (couverture en premier) — design « Photos · Pose gel », « Vos réalisations ». */
  app.put(
    '/services/:id/photos',
    { schema: { params: z.object({ id: uuid }), body: setServicePhotosSchema } },
    async (req, reply) => {
      const salonId = req.salon!.id;
      const svc = await db
        .from('services')
        .select('id')
        .eq('id', req.params.id)
        .eq('salon_id', salonId)
        .maybeSingle();
      if (svc.error) throw svc.error;
      if (!svc.data) throw notFound('Service');
      const del = await db.from('service_photos').delete().eq('service_id', req.params.id);
      if (del.error) throw del.error;
      if (req.body.photos.length) {
        const ins = await db
          .from('service_photos')
          .insert(
            req.body.photos.map((p, i) => ({
              service_id: req.params.id,
              url: p.url,
              sort_order: i,
            })),
          );
        if (ins.error) throw ins.error;
      }
      reply.status(204);
      return null;
    },
  );
};

export default proServiceRoutes;
