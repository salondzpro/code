/** Espace pro — Clients : fiche agrégée (SQL) et blocage/déblocage propre au salon. */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { blockClientSchema } from '@salondz/validation';
import type { ProClient } from '@salondz/types';
import { db } from '../../lib/supabase';
import { badRequest, unwrap } from '../../lib/errors';
import { camelize } from '../../lib/mappers';

const proClientRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireSalon);

  app.get('/clients', async (req, reply) => {
    const res = await db.rpc('salon_clients', { p_salon_id: req.salon!.id });
    const rows = unwrap(res) as Record<string, unknown>[];
    reply.header('Cache-Control', 'private, no-store');
    const items = rows.map((r) => {
      const c = camelize<ProClient>(r);
      return { ...c, bookingsCount: Number(c.bookingsCount), completedCount: Number(c.completedCount), cancelledCount: Number(c.cancelledCount), noShowCount: Number(c.noShowCount) };
    });
    return { items };
  });

  /** Bloque un client (compte et/ou numéro) : il ne pourra plus réserver en ligne chez ce salon. */
  app.post('/clients/block', { schema: { body: blockClientSchema } }, async (req, reply) => {
    const salonId = req.salon!.id;
    const { clientId, phone, reason } = req.body;
    if (clientId && clientId === req.user!.id) throw badRequest('SELF_BLOCK', 'Vous ne pouvez pas vous bloquer vous-même.');
    const del = await db.from('blocked_clients').delete().eq('salon_id', salonId).or([clientId ? `client_id.eq.${clientId}` : null, phone ? `phone.eq.${phone}` : null].filter(Boolean).join(','));
    if (del.error) throw del.error;
    const ins = await db.from('blocked_clients').insert({ salon_id: salonId, client_id: clientId ?? null, phone: phone ?? null, reason: reason ?? null });
    if (ins.error) throw ins.error;
    reply.status(204);
    return null;
  });

  app.post('/clients/unblock', { schema: { body: blockClientSchema } }, async (req, reply) => {
    const salonId = req.salon!.id;
    const { clientId, phone } = req.body;
    const del = await db.from('blocked_clients').delete().eq('salon_id', salonId).or([clientId ? `client_id.eq.${clientId}` : null, phone ? `phone.eq.${phone}` : null].filter(Boolean).join(','));
    if (del.error) throw del.error;
    reply.status(204);
    return null;
  });
};

export default proClientRoutes;
