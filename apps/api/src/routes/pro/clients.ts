/** Espace pro — Clients : fiche agrégée (SQL) et blocage/déblocage propre au salon. */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { blockClientSchema, clientHistoryQuerySchema, clientNotesSchema, proClientsQuerySchema } from '@salondz/validation';
import type { ProClient, ProClientHistoryItem } from '@salondz/types';
import { db } from '../../lib/supabase';
import { badRequest, unwrap, notFound } from '../../lib/errors';
import { camelize } from '../../lib/mappers';

function mapProClient(r: Record<string, unknown>): ProClient {
  const { total_count: _t, blocked_count: _b, ...row } = r;
  const c = camelize<ProClient>(row);
  return { ...c, bookingsCount: Number(c.bookingsCount), completedCount: Number(c.completedCount), cancelledCount: Number(c.cancelledCount), noShowCount: Number(c.noShowCount), spentDa: Number(c.spentDa) };
}

/** La fiche telle que la voit le professionnel : elle fait foi pour le compte et le numéro. */
async function loadClient(salonId: string, key: string): Promise<ProClient> {
  const res = await db.rpc('salon_clients_page', { p_salon_id: salonId, p_q: null, p_key: key, p_limit: 1, p_offset: 0 });
  const rows = unwrap(res) as Record<string, unknown>[];
  if (!rows[0]) throw notFound('Client');
  return mapProClient(rows[0]);
}

/**
 * Retire tout blocage de cette personne : par identité, par compte et par numéro (un blocage posé
 * avant la fusion des fiches doit partir aussi). Trois filtres `.eq` plutôt qu'un `.or` : une
 * identité peut être un nom, avec virgules et parenthèses, que PostgREST découperait.
 */
async function clearBlocks(salonId: string, key: string, c: ProClient): Promise<void> {
  const targets: [string, string][] = [['client_key', key]];
  if (c.clientId) targets.push(['client_id', c.clientId]);
  if (c.phone) targets.push(['phone', c.phone]);
  for (const [col, value] of targets) {
    const del = await db.from('blocked_clients').delete().eq('salon_id', salonId).eq(col, value);
    if (del.error) throw del.error;
  }
}

const proClientRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireSalon);

  /** Liste paginée et filtrée côté serveur (30 par page, recherche nom / téléphone). */
  app.get('/clients', { schema: { querystring: proClientsQuerySchema } }, async (req, reply) => {
    const { q, cursor, limit } = req.query;
    const offset = Number(cursor ?? 0) || 0;
    const res = await db.rpc('salon_clients_page', { p_salon_id: req.salon!.id, p_q: q ?? null, p_key: null, p_limit: limit, p_offset: offset });
    const rows = unwrap(res) as Record<string, unknown>[];
    reply.header('Cache-Control', 'private, no-store');
    const items = rows.map(mapProClient);
    const total = rows.length ? Number(rows[0]!.total_count) : 0;
    const blockedCount = rows.length ? Number(rows[0]!.blocked_count) : 0;
    return { items, total, blockedCount, nextCursor: items.length === limit ? String(offset + limit) : null };
  });

  const keyParam = z.object({ key: z.string().min(1).max(200) });

  /** Une seule fiche client (sans charger toute la liste). */
  app.get('/clients/:key', { schema: { params: keyParam } }, async (req, reply) => {
    const client = await loadClient(req.salon!.id, req.params.key);
    reply.header('Cache-Control', 'private, no-store');
    return client;
  });

  /** Historique du client chez ce salon (plus récent en premier), paginé par décalage, filtrable par statut. */
  app.get('/clients/:key/history', { schema: { params: keyParam, querystring: clientHistoryQuerySchema } }, async (req, reply) => {
    const { cursor, limit, status } = req.query;
    const offset = Number(cursor ?? 0) || 0;
    const res = await db.rpc('salon_client_history', { p_salon_id: req.salon!.id, p_client_key: req.params.key, p_limit: limit, p_offset: offset, p_status: status ?? null });
    const rows = unwrap(res) as (Record<string, unknown> & { total?: number | string })[];
    reply.header('Cache-Control', 'private, no-store');
    // `total` = nombre de lignes pour ce filtre (fenêtre SQL), porté par chaque ligne : on le
    // sort des items. Page vide (décalage au-delà) → 0, la fiche retombe sur la première page.
    const total = Number(rows[0]?.total ?? 0);
    const items = rows.map(({ total: _t, ...r }) => camelize<ProClientHistoryItem>(r));
    return { items, total, nextCursor: offset + items.length < total ? String(offset + limit) : null };
  });

  /** Notes privées du salon sur ce client. */
  app.put('/clients/:key/notes', { schema: { params: keyParam, body: clientNotesSchema } }, async (req, reply) => {
    const res = await db.from('client_notes').upsert({ salon_id: req.salon!.id, client_key: req.params.key, notes: req.body.notes, updated_at: new Date().toISOString() }, { onConflict: 'salon_id,client_key' });
    if (res.error) throw res.error;
    reply.status(204);
    return null;
  });

  /**
   * Bloque un client. L'identité bloquée est celle de la fiche ; le compte et le numéro connus sont
   * enregistrés avec elle, car c'est sur eux que `create_booking_multi` refuse la réservation en
   * ligne. Un client de passage sans compte ni numéro peut être bloqué : rien à empêcher en ligne
   * (il ne peut pas réserver), mais la clientèle du salon le signale.
   */
  app.post('/clients/block', { schema: { body: blockClientSchema } }, async (req, reply) => {
    const salonId = req.salon!.id;
    const { clientKey, reason } = req.body;
    const client = await loadClient(salonId, clientKey);
    if (client.clientId && client.clientId === req.user!.id) throw badRequest('SELF_BLOCK', 'Vous ne pouvez pas vous bloquer vous-même.');
    await clearBlocks(salonId, clientKey, client);
    const ins = await db.from('blocked_clients').insert({ salon_id: salonId, client_key: clientKey, client_id: client.clientId, phone: client.phone, reason: reason ?? null });
    if (ins.error) throw ins.error;
    reply.status(204);
    return null;
  });

  app.post('/clients/unblock', { schema: { body: blockClientSchema } }, async (req, reply) => {
    const salonId = req.salon!.id;
    const { clientKey } = req.body;
    await clearBlocks(salonId, clientKey, await loadClient(salonId, clientKey));
    reply.status(204);
    return null;
  });
};

export default proClientRoutes;
