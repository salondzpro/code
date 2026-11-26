/**
 * WEBHOOK WHATSAPP (24 nov. 2026) : Meta y pousse le sort de chaque message (`sent`, `delivered`,
 * `read`, `failed`). On ne garde que ce qui concerne les codes de connexion (`auth_phone_codes.wamid`) :
 * l'écran attend ce statut avant d'afficher « Entrez le code » (`GET /v1/auth/phone/status`).
 *
 *   GET  /v1/webhooks/whatsapp   vérification de l'abonnement (`hub.verify_token` = WHATSAPP_VERIFY_TOKEN)
 *   POST /v1/webhooks/whatsapp   événements, SIGNÉS par Meta (`X-Hub-Signature-256`, HMAC-SHA256 du
 *                                corps brut avec la clé secrète de l'app) — sans signature valable : 401.
 *
 * Plugin encapsulé : son analyseur JSON garde le corps BRUT (la signature porte sur les octets reçus),
 * sans toucher aux autres routes.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config';
import { db } from '../lib/supabase';
import { reconcilePayment, signatureValide } from '../lib/chargily';

type Statut = { id?: string; status?: string; errors?: { code?: number; title?: string }[] };
type Evenement = { entry?: { changes?: { value?: { statuses?: Statut[] } }[] }[] };


const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

  /**
   * CHARGILY PAY (26 nov. 2026) : paiement d'un abonnement pro. Cru seulement SIGNÉ (`signature` =
   * HMAC-SHA256 hex du corps brut avec la clé secrète) ; la décision vient ensuite d'une RELECTURE du
   * paiement chez Chargily (`reconcilePayment`), jamais du contenu de l'événement seul. Toujours 200
   * une fois la signature valide : un événement qu'on ignore ne doit pas être renvoyé en boucle.
   */
  app.post('/webhooks/chargily', { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }, async (req, reply) => {
    const brut = req.body as Buffer;
    if (!Buffer.isBuffer(brut) || !signatureValide(brut, req.headers.signature as string | undefined)) {
      req.log.warn('webhook chargily : signature invalide');
      return reply.status(401).send();
    }
    let ev: { id?: string; type?: string; data?: { id?: string } };
    try {
      ev = JSON.parse(brut.toString('utf8')) as typeof ev;
    } catch {
      return reply.status(400).send();
    }
    const checkoutId = ev.data?.id;
    if (checkoutId && typeof ev.type === 'string' && ev.type.startsWith('checkout.')) {
      await reconcilePayment(req.log, checkoutId, ev.id ?? null).catch((err) => req.log.error({ err }, 'webhook chargily'));
    }
    return reply.status(200).send({ ok: true });
  });

  app.get('/webhooks/whatsapp', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    if (q['hub.mode'] === 'subscribe' && config.WHATSAPP_VERIFY_TOKEN && q['hub.verify_token'] === config.WHATSAPP_VERIFY_TOKEN) {
      return reply.type('text/plain').send(q['hub.challenge'] ?? '');
    }
    return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Accès refusé' } });
  });

  app.post('/webhooks/whatsapp', { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }, async (req, reply) => {
    const brut = req.body as Buffer;
    const sig = String(req.headers['x-hub-signature-256'] ?? '');
    if (!config.WHATSAPP_APP_SECRET || !Buffer.isBuffer(brut)) return reply.status(401).send();
    const attendu = Buffer.from(`sha256=${createHmac('sha256', config.WHATSAPP_APP_SECRET).update(brut).digest('hex')}`);
    const recu = Buffer.from(sig);
    if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) {
      req.log.warn('webhook whatsapp : signature invalide');
      return reply.status(401).send();
    }
    let ev: Evenement;
    try {
      ev = JSON.parse(brut.toString('utf8')) as Evenement;
    } catch {
      return reply.status(400).send();
    }
    const statuts = (ev.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.statuses ?? []));
    for (const s of statuts) {
      if (!s.id || !s.status) continue;
      const echec = s.status === 'failed';
      const upd = await db
        .from('auth_phone_codes')
        .update({ wa_status: s.status, ...(echec ? { delivered: false } : {}) })
        .eq('wamid', s.id)
        // Un statut ne recule jamais (un « sent » en retard n'efface pas un « delivered »).
        .or(echec ? 'wa_status.is.null,wa_status.neq.failed' : 'wa_status.is.null,wa_status.not.in.(delivered,read,failed)');
      if (upd.error) req.log.error({ err: upd.error }, 'webhook whatsapp');
      if (echec) req.log.warn({ errors: s.errors }, 'code whatsapp non livré');
    }
    // Meta exige une réponse 200 rapide, quoi qu'il arrive : sinon il réessaie pendant des jours.
    return reply.status(200).send();
  });
};

export default webhookRoutes;
