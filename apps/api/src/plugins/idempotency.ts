/**
 * IDEMPOTENCE DES ÉCRITURES — le filet qui rend une reprise sans danger.
 *
 * Le cas réel : la requête part, le serveur l'exécute, et la réponse se perd avant d'arriver. Le
 * téléphone conclut à un échec et réessaie. Sans ce garde, on crée deux rendez-vous pour une seule
 * réservation, deux salons pour une seule inscription. Ce défaut ne se voit jamais en test — il se
 * voit chez les gens, sur un réseau qui tombe.
 *
 * Fonctionnement : le client pose une `Idempotency-Key` sur chaque écriture et la RÉUTILISE à
 * chaque reprise du même appel. Ici :
 *   1. on réserve la clé (insertion) ; si elle est libre, la requête suit son cours normal ;
 *   2. la réponse est conservée telle quelle ;
 *   3. toute reprise de la même clé reçoit cette réponse, sans rien réexécuter.
 *
 * Trois refus volontaires :
 *   - même clé, corps DIFFÉRENT → 422. Ce n'est pas une reprise, c'est une faute d'appel ; la
 *     laisser passer rendrait la clé inutile.
 *   - clé déjà prise mais requête encore EN COURS → 409. On ne lance pas le même travail deux fois
 *     en parallèle ; le client réessaie dans un instant et récupère la réponse conservée.
 *   - rien n'est conservé pour les réponses 5xx : une panne serveur doit pouvoir être retentée.
 */
import { createHash } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/supabase';

const ECRITURES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Empreinte du corps : courte, stable, et qui ne conserve aucune donnée personnelle. */
const empreinte = (corps: unknown): string =>
  createHash('sha256').update(corps === undefined ? '' : JSON.stringify(corps)).digest('hex').slice(0, 32);

declare module 'fastify' {
  interface FastifyRequest {
    /** Clé d'idempotence retenue pour cette requête, s'il y en a une. */
    idempotencyKey?: string;
  }
}

export const idempotencyPlugin: FastifyPluginAsync = fp(async (app) => {
  app.addHook('preHandler', async (req, reply) => {
    if (!ECRITURES.has(req.method)) return;
    const brute = req.headers['idempotency-key'];
    const cle = typeof brute === 'string' ? brute.trim() : '';
    // Clé absente ou fantaisiste : on laisse passer. L'idempotence est une protection OFFERTE au
    // client, pas une condition d'accès — un ancien téléphone qui ne l'envoie pas doit continuer
    // de fonctionner exactement comme avant.
    if (!cle || cle.length < 16 || cle.length > 200) return;

    const emp = empreinte(req.body);
    const ligne = {
      key: cle,
      user_id: req.user?.id ?? null,
      method: req.method,
      path: req.routeOptions?.url ?? req.url.split('?')[0]!,
      fingerprint: emp,
    };

    const { error } = await db.from('idempotency_keys').insert(ligne);
    if (!error) {
      // Clé neuve : la requête s'exécute, et `onSend` conservera sa réponse.
      req.idempotencyKey = cle;
      return;
    }

    // Déjà vue. On relit ce qui en a été fait.
    const { data: vue } = await db
      .from('idempotency_keys')
      .select('fingerprint, status, response, user_id')
      .eq('key', cle)
      .maybeSingle();

    if (!vue) {
      // L'insertion a échoué pour une autre raison (base indisponible) : on ne bloque pas une
      // écriture légitime à cause du filet lui-même.
      req.log.warn({ err: error }, 'idempotence : réservation impossible, requête laissée passer');
      return;
    }
    // Une clé appartient à la personne qui l'a posée : on ne rejoue jamais la réponse d'un autre.
    if ((vue.user_id ?? null) !== (req.user?.id ?? null) || vue.fingerprint !== emp) {
      return reply.status(422).send({
        error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'Cette clé a déjà servi pour une autre demande.' },
      });
    }
    if (vue.status === null || vue.status === undefined) {
      return reply.status(409).send({
        error: { code: 'IDEMPOTENCY_IN_PROGRESS', message: 'Demande déjà en cours. Réessayez dans un instant.' },
      });
    }
    // Reprise : la réponse d'origine, à l'identique.
    reply.header('Idempotency-Replayed', 'true');
    return reply.status(vue.status as number).send(vue.response ?? undefined);
  });

  app.addHook('onSend', async (req, reply, payload) => {
    if (!req.idempotencyKey) return payload;
    // Une panne serveur doit rester retentable : on ne fige que ce qui a VRAIMENT abouti.
    if (reply.statusCode >= 500) {
      await db.from('idempotency_keys').delete().eq('key', req.idempotencyKey);
      return payload;
    }
    let corps: unknown = null;
    if (typeof payload === 'string' && payload) {
      try {
        corps = JSON.parse(payload);
      } catch {
        corps = null;
      }
    }
    await db
      .from('idempotency_keys')
      .update({ status: reply.statusCode, response: corps })
      .eq('key', req.idempotencyKey);
    return payload;
  });
});
