import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createStaffSchema, setStaffHoursSchema, updateStaffSchema, uuid } from '@salondz/validation';
import type { Staff, StaffHour } from '@salondz/types';
import { db } from '../../lib/supabase';
import { conflict, notFound, unwrap } from '../../lib/errors';
import { camelize, hm, snakeize } from '../../lib/mappers';
import { STAFF_COLS } from '../../lib/queries';

const proStaffRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireSalon);

  app.post('/staff', { schema: { body: createStaffSchema } }, async (req, reply) => {
    const salonId = req.salon!.id;
    const { count } = await db.from('staff').select('id', { count: 'exact', head: true }).eq('salon_id', salonId);
    const res = await db
      .from('staff')
      .insert({ ...snakeize(req.body), salon_id: salonId, sort_order: count ?? 0 })
      .select(STAFF_COLS)
      .single();
    reply.status(201);
    return camelize<Staff>(unwrap(res));
  });

  app.patch('/staff/:id', { schema: { params: z.object({ id: uuid }), body: updateStaffSchema } }, async (req) => {
    const salonId = req.salon!.id;
    if (req.body.isActive === false) {
      const { count } = await db.from('staff').select('id', { count: 'exact', head: true }).eq('salon_id', salonId).eq('is_active', true).neq('id', req.params.id);
      if ((count ?? 0) === 0) throw conflict('LAST_STAFF', 'Il faut au moins un membre actif.');
    }
    const res = await db.from('staff').update(snakeize(req.body)).eq('id', req.params.id).eq('salon_id', salonId).select(STAFF_COLS).maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) throw notFound('Membre');
    return camelize<Staff>(res.data);
  });

  /** Supprime si aucune réservation, sinon désactive. */
  app.delete('/staff/:id', { schema: { params: z.object({ id: uuid }) } }, async (req) => {
    const salonId = req.salon!.id;
    const { count } = await db.from('staff').select('id', { count: 'exact', head: true }).eq('salon_id', salonId).eq('is_active', true).neq('id', req.params.id);
    if ((count ?? 0) === 0) throw conflict('LAST_STAFF', 'Il faut au moins un membre actif.');
    const del = await db.from('staff').delete().eq('id', req.params.id).eq('salon_id', salonId).select('id').maybeSingle();
    if (del.error) {
      if (del.error.code !== '23503') throw del.error;
      const upd = await db.from('staff').update({ is_active: false }).eq('id', req.params.id).eq('salon_id', salonId).select('id').maybeSingle();
      if (upd.error) throw upd.error;
      if (!upd.data) throw notFound('Membre');
      return { deleted: false, deactivated: true };
    }
    if (!del.data) throw notFound('Membre');
    return { deleted: true, deactivated: false };
  });

  app.get('/staff/:id/hours', { schema: { params: z.object({ id: uuid }) } }, async (req) => {
    const res = await db
      .from('staff_hours')
      .select('id, staff_id, day_of_week, starts_at, ends_at, staff!inner(salon_id)')
      .eq('staff_id', req.params.id)
      .eq('staff.salon_id', req.salon!.id)
      .order('day_of_week');
    const rows = unwrap(res) as Record<string, unknown>[];
    return rows.map((r) => {
      const { staff: _s, ...rest } = r;
      const h = camelize<StaffHour>(rest);
      return { ...h, startsAt: hm(h.startsAt), endsAt: hm(h.endsAt) };
    });
  });

  /** Remplace les horaires propres du membre (liste vide = horaires du salon). */
  app.put('/staff/:id/hours', { schema: { params: z.object({ id: uuid }), body: setStaffHoursSchema } }, async (req, reply) => {
    const member = await db.from('staff').select('id').eq('id', req.params.id).eq('salon_id', req.salon!.id).maybeSingle();
    if (member.error) throw member.error;
    if (!member.data) throw notFound('Membre');
    const del = await db.from('staff_hours').delete().eq('staff_id', req.params.id);
    if (del.error) throw del.error;
    if (req.body.hours.length) {
      const ins = await db.from('staff_hours').insert(
        req.body.hours.map((h) => ({ staff_id: req.params.id, day_of_week: h.dayOfWeek, starts_at: h.startsAt, ends_at: h.endsAt })),
      );
      if (ins.error) throw ins.error;
    }
    reply.status(204);
    return null;
  });
};

export default proStaffRoutes;
