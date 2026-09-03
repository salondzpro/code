import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { addDaysToKey, localDateTimeToISO, toLocalDateKey } from '@salondz/constants';
import { createTimeBlockSchema, dateKey, uuid } from '@salondz/validation';
import type { TimeBlock } from '@salondz/types';
import { db } from '../../lib/supabase';
import { notFound, unwrap } from '../../lib/errors';
import { camelize } from '../../lib/mappers';

const BLOCK_COLS = 'id, salon_id, staff_id, starts_at, ends_at, reason';

const proBlockRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireSalon);

  app.get('/blocks', { schema: { querystring: z.object({ from: dateKey.optional(), to: dateKey.optional() }) } }, async (req, reply) => {
    const from = req.query.from ?? toLocalDateKey();
    const to = req.query.to ?? addDaysToKey(from, 30);
    const res = await db
      .from('time_blocks')
      .select(BLOCK_COLS)
      .eq('salon_id', req.salon!.id)
      .lt('starts_at', localDateTimeToISO(addDaysToKey(to, 1), '00:00'))
      .gt('ends_at', localDateTimeToISO(from, '00:00'))
      .order('starts_at');
    reply.header('Cache-Control', 'private, no-store');
    return { items: camelize<TimeBlock[]>(unwrap(res)) };
  });

  app.post('/blocks', { schema: { body: createTimeBlockSchema } }, async (req, reply) => {
    const salonId = req.salon!.id;
    if (req.body.staffId) {
      const m = await db.from('staff').select('id').eq('id', req.body.staffId).eq('salon_id', salonId).maybeSingle();
      if (m.error) throw m.error;
      if (!m.data) throw notFound('Membre');
    }
    const res = await db
      .from('time_blocks')
      .insert({
        salon_id: salonId,
        staff_id: req.body.staffId ?? null,
        starts_at: req.body.startsAt,
        ends_at: req.body.endsAt,
        reason: req.body.reason ?? null,
      })
      .select(BLOCK_COLS)
      .single();
    reply.status(201);
    return camelize<TimeBlock>(unwrap(res));
  });

  app.delete('/blocks/:id', { schema: { params: z.object({ id: uuid }) } }, async (req, reply) => {
    const res = await db.from('time_blocks').delete().eq('id', req.params.id).eq('salon_id', req.salon!.id).select('id').maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) throw notFound('Blocage');
    reply.status(204);
    return null;
  });
};

export default proBlockRoutes;
