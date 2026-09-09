import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { MAX_STAFF_PER_SALON } from '@salondz/constants';
import { createStaffSchema, setStaffHoursSchema, updateStaffSchema, uuid } from '@salondz/validation';
import type { Staff, StaffHour } from '@salondz/types';
import { db } from '../../lib/supabase';
import { conflict, notFound, unwrap } from '../../lib/errors';
import { camelize, hm, snakeize } from '../../lib/mappers';
import { STAFF_SELECT, mapStaff } from '../../lib/queries';

const proStaffRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireSalon);

  /** Prestations affectées : `allServices` (défaut) ou la sélection `serviceIds` (limitée aux prestations du salon). */
  async function setStaffServices(salonId: string, staffId: string, allServices: boolean, serviceIds: string[] | undefined): Promise<void> {
    const del = await db.from('staff_services').delete().eq('staff_id', staffId);
    if (del.error) throw del.error;
    if (allServices || !serviceIds?.length) return;
    const own = await db.from('services').select('id').eq('salon_id', salonId).in('id', serviceIds);
    const ids = (unwrap(own) as { id: string }[]).map((x) => x.id);
    if (ids.length === 0) return;
    const ins = await db.from('staff_services').insert(ids.map((service_id) => ({ staff_id: staffId, service_id })));
    if (ins.error) throw ins.error;
  }
  async function loadStaff(salonId: string, staffId: string): Promise<Staff> {
    const res = await db.from('staff').select(STAFF_SELECT).eq('id', staffId).eq('salon_id', salonId).maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) throw notFound('Membre');
    return mapStaff(res.data as Record<string, unknown>);
  }

  app.post('/staff', { schema: { body: createStaffSchema } }, async (req, reply) => {
    const salonId = req.salon!.id;
    const { count } = await db.from('staff').select('id', { count: 'exact', head: true }).eq('salon_id', salonId);
    if ((count ?? 0) >= MAX_STAFF_PER_SALON) throw conflict('LIMIT_REACHED', `Une équipe compte au plus ${MAX_STAFF_PER_SALON} membres.`);
    const { serviceIds, allServices, ...rest } = req.body;
    // Une sélection vide revient à « toutes les prestations » : un membre sans rien à faire n'a pas de sens.
    const all = allServices || !serviceIds?.length;
    const res = await db
      .from('staff')
      .insert({ ...snakeize(rest), all_services: all, salon_id: salonId, sort_order: count ?? 0 })
      .select('id')
      .single();
    const created = unwrap(res) as { id: string };
    await setStaffServices(salonId, created.id, all, serviceIds);
    reply.status(201);
    return loadStaff(salonId, created.id);
  });

  app.patch('/staff/:id', { schema: { params: z.object({ id: uuid }), body: updateStaffSchema } }, async (req) => {
    const salonId = req.salon!.id;
    if (req.body.isActive === false) {
      const { count } = await db.from('staff').select('id', { count: 'exact', head: true }).eq('salon_id', salonId).eq('is_active', true).neq('id', req.params.id);
      if ((count ?? 0) === 0) throw conflict('LAST_STAFF', 'Il faut au moins un membre actif.');
    }
    const { serviceIds, allServices, ...rest } = req.body;
    const patch: Record<string, unknown> = snakeize(rest);
    const touchesServices = allServices !== undefined || serviceIds !== undefined;
    const all = touchesServices ? (allServices ?? false) || !serviceIds?.length : undefined;
    if (all !== undefined) patch.all_services = all;
    const res = await db.from('staff').update(patch).eq('id', req.params.id).eq('salon_id', salonId).select('id').maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) throw notFound('Membre');
    if (all !== undefined) await setStaffServices(salonId, req.params.id, all, serviceIds);
    return loadStaff(salonId, req.params.id);
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
