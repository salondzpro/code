import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createServiceSchema, updateServiceSchema, uuid } from '@salondz/validation';
import type { Service } from '@salondz/types';
import { db } from '../../lib/supabase';
import { notFound, unwrap } from '../../lib/errors';
import { camelize, snakeize } from '../../lib/mappers';
import { SERVICE_COLS } from '../../lib/queries';

const proServiceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireSalon);

  app.post('/services', { schema: { body: createServiceSchema } }, async (req, reply) => {
    const salonId = req.salon!.id;
    const { count } = await db.from('services').select('id', { count: 'exact', head: true }).eq('salon_id', salonId);
    const res = await db
      .from('services')
      .insert({ ...snakeize(req.body), salon_id: salonId, sort_order: count ?? 0 })
      .select(SERVICE_COLS)
      .single();
    reply.status(201);
    return camelize<Service>(unwrap(res));
  });

  app.patch('/services/:id', { schema: { params: z.object({ id: uuid }), body: updateServiceSchema } }, async (req) => {
    const res = await db
      .from('services')
      .update(snakeize(req.body))
      .eq('id', req.params.id)
      .eq('salon_id', req.salon!.id)
      .select(SERVICE_COLS)
      .maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) throw notFound('Service');
    return camelize<Service>(res.data);
  });

  /** Supprime si jamais réservé, sinon désactive (historique préservé). */
  app.delete('/services/:id', { schema: { params: z.object({ id: uuid }) } }, async (req, reply) => {
    const salonId = req.salon!.id;
    const del = await db.from('services').delete().eq('id', req.params.id).eq('salon_id', salonId).select('id').maybeSingle();
    if (del.error) {
      if (del.error.code !== '23503') throw del.error;
      const upd = await db.from('services').update({ is_active: false }).eq('id', req.params.id).eq('salon_id', salonId).select('id').maybeSingle();
      if (upd.error) throw upd.error;
      if (!upd.data) throw notFound('Service');
      return { deleted: false, deactivated: true };
    }
    if (!del.data) throw notFound('Service');
    reply.status(200);
    return { deleted: true, deactivated: false };
  });

  app.put('/services/reorder', { schema: { body: z.object({ ids: z.array(uuid).min(1).max(200) }) } }, async (req, reply) => {
    const salonId = req.salon!.id;
    await Promise.all(req.body.ids.map((id, i) => db.from('services').update({ sort_order: i }).eq('id', id).eq('salon_id', salonId)));
    reply.status(204);
    return null;
  });
};

export default proServiceRoutes;
