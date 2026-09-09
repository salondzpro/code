/** Espace pro — Clients : fiche agrégée (SQL) et blocage/déblocage propre au salon. */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { blockClientSchema, clientNotesSchema } from '@salondz/validation';
import type { ProClient, ProClientHistoryItem } from '@salondz/types';
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
      return { ...c, bookingsCount: Number(c.bookingsCount), completedCount: Number(c.completedCount), cancelledCount: Number(c.cancelledCount), noShowCount: Number(c.noShowCount), spentDa: Number(c.spentDa) };
    });
    return { items };
  });

  const keyParam = z.object({ key: z.string().min(1).max(200) });

  /** Historique complet du client chez ce salon (plus récent en premier). */
  app.get('/clients/:key/history', { schema: { params: keyParam } }, async (req, reply) => {
    const res = await db.rpc('salon_client_history', { p_salon_id: req.salon!.id, p_client_key: req.params.key });
    const rows = unwrap(res) as Record<string, unknown>[];
    reply.header('Cache-Control', 'private, no-store');
    return { items: rows.map((r) => camelize<ProClientHistoryItem>(r)) };
  });

  /** Notes privées du salon sur ce client. */
  app.put('/clients/:key/notes', { schema: { params: keyParam, body: clientNotesSchema } }, async (req, reply) => {
    const res = await db.from('client_notes').upsert({ salon_id: req.salon!.id, client_key: req.params.key, notes: req.body.notes, updated_at: new Date().toISOString() }, { onConflict: 'salon_id,client_key' });
    if (res.error) throw res.error;
    reply.status(204);
    return null;
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
