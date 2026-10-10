import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import type { FastifyBaseLogger } from 'fastify';
import { db } from './supabase';
import { isWebPushToken, sendWebPush, webPushEnabled } from './webpush';
import { fcmEnabled, isFcmToken, sendFcm } from './fcm';
import { apnsEnabled, isApnsToken, sendApns } from './apns';
import { audienceOf, pushTitle, pushUrl } from './pushContent';

const expo = new Expo({ useFcmV1: true });

/** Notifications couvertes par le réglage « Confirmations » des Réglages client. */
const CONFIRMATION_TYPES = new Set(['booking_created', 'booking_confirmed', 'booking_cancelled', 'booking_rescheduled']);

/** Au-delà, un échec passager n'est plus retenté : la notification reste dans l'application. */
export const PUSH_MAX_ATTEMPTS = 3;

/** Ce qu'il est advenu d'une notification poussée (colonne `notifications.push_outcome`). */
export type PushOutcome = 'sent' | 'no_device' | 'opted_out' | 'failed';

interface PendingNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  type: string;
  booking_id: string | null;
  push_attempts: number;
}

interface DeviceToken {
  user_id: string;
  token: string;
  /** Application qui a enregistré le jeton : sert de `apns-topic` (voir migration 0051). */
  app_id: string | null;
}

/**
 * RÉSERVE un lot de notifications à pousser, et les rend. La réservation et la lecture sont UNE
 * SEULE instruction (`update … where pushed_at is null returning …`) : deux envois qui se
 * chevauchent — l'appel qui suit une réservation, le cron, la liste d'attente — ne peuvent plus
 * lire les mêmes lignes. C'est ce qui faisait partir la même notification deux fois.
 *
 * Exportée pour le test : deux réservations en parallèle doivent se partager les lignes sans
 * jamais en rendre une aux deux.
 */
export async function claimPendingPush(bookingId?: string, limit = 200): Promise<PendingNotification[]> {
  let ids = db
    .from('notifications')
    .select('id')
    .is('pushed_at', null)
    .lt('push_attempts', PUSH_MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (bookingId) ids = ids.eq('booking_id', bookingId);
  const candidates = await ids;
  if (candidates.error) throw candidates.error;
  if (!candidates.data?.length) return [];

  const claimed = await db
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .in(
      'id',
      candidates.data.map((n) => n.id as string),
    )
    .is('pushed_at', null)
    .select('id, user_id, title, body, data, type, booking_id, push_attempts');
  if (claimed.error) throw claimed.error;
  return (claimed.data ?? []) as unknown as PendingNotification[];
}

/**
 * Envoie les notifications non poussées (pushed_at null).
 *
 * Création, acceptation, réception sont trois choses : la ligne existe (création) ; `push_outcome`
 * dit si un fournisseur l'a ACCEPTÉE (`sent`) ; sa lecture (`read_at`) est la seule preuve qu'elle
 * a été vue. Un échec passager (panne réseau, fournisseur indisponible) remet la notification en
 * attente, jusqu'à PUSH_MAX_ATTEMPTS fois ; un jeton définitivement mort est retiré de la base.
 *
 * `bookingId` limite aux notifications d'une réservation (appel juste après une mutation).
 * Retourne le nombre d'envois acceptés par un fournisseur.
 */
export async function dispatchPendingPush(log: FastifyBaseLogger, bookingId?: string): Promise<number> {
  const pending = await claimPendingPush(bookingId);
  if (pending.length === 0) return 0;

  const userIds = [...new Set(pending.map((n) => n.user_id))];

  // Réglage « Confirmations » (client) : les notifications de réservation restent dans l'application
  // mais ne sont pas poussées quand la personne l'a coupé. Un pro reçoit toujours ses demandes.
  const optOut = new Set<string>();
  if (pending.some((n) => CONFIRMATION_TYPES.has(n.type))) {
    const prefs = await db.from('profiles').select('id').in('id', userIds).eq('role', 'client').eq('notify_confirmations', false);
    if (prefs.error) log.warn({ err: prefs.error }, 'push prefs');
    for (const p of prefs.data ?? []) optOut.add(p.id as string);
  }
  const wanted = (n: PendingNotification) => !(optOut.has(n.user_id) && CONFIRMATION_TYPES.has(n.type));

  const { data: tokens, error: tErr } = await db.from('push_tokens').select('user_id, token, app_id').in('user_id', userIds);
  if (tErr) throw tErr;

  // Quatre canaux, quatre protocoles, reconnus à la FORME du jeton : Expo (ancienne application),
  // APNs (iPhone), Firebase (Android), Web Push (navigateur). L'ORDRE des tests compte — un jeton
  // APNs doit être reconnu AVANT Firebase, qui accepte « tout le reste ». Un jeton d'aucune de ces
  // formes est ignoré plutôt que de faire échouer le lot entier.
  const expoByUser = new Map<string, string[]>();
  const apnsByUser = new Map<string, DeviceToken[]>();
  const fcmByUser = new Map<string, string[]>();
  const webByUser = new Map<string, string[]>();
  const add = <T>(map: Map<string, T[]>, key: string, value: T) => {
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  };
  for (const t of (tokens ?? []) as DeviceToken[]) {
    if (Expo.isExpoPushToken(t.token)) add(expoByUser, t.user_id, t.token);
    else if (apnsEnabled && isApnsToken(t.token)) add(apnsByUser, t.user_id, t);
    else if (fcmEnabled && isFcmToken(t.token)) add(fcmByUser, t.user_id, t.token);
    else if (webPushEnabled && isWebPushToken(t.token)) add(webByUser, t.user_id, t.token);
  }

  /**
   * BADGE DE L'ICÔNE : le nombre de notifications non lues, par personne. Recalculé à chaque
   * envoi et posé sur la notification elle-même — c'est le système qui l'affiche sur l'icône.
   * Il redescend tout seul quand la personne les ouvre, la lecture posant `read_at`.
   */
  const badges = new Map<string, number>();
  {
    const { data: nonLues, error } = await db.from('notifications').select('user_id').in('user_id', userIds).is('read_at', null);
    if (error) log.warn({ err: error }, 'badge: comptage impossible');
    for (const r of nonLues ?? []) badges.set(r.user_id as string, (badges.get(r.user_id as string) ?? 0) + 1);
  }

  /** Le contenu POUSSÉ d'une notification : titre avec emoji, destination, badge. */
  const pousse = (n: PendingNotification) => {
    const audience = audienceOf(n.data);
    const url = pushUrl(n, audience);
    return {
      title: pushTitle(n.type, audience, n.title),
      body: n.body,
      badge: badges.get(n.user_id) ?? 0,
      data: { ...n.data, type: n.type, notificationId: n.id, ...(url ? { url } : {}) },
    };
  };

  /** Par notification : combien d'envois acceptés, et combien ont échoué de façon PASSAGÈRE. */
  const accepted = new Map<string, number>();
  const transient = new Map<string, number>();
  const lastError = new Map<string, string>();
  const count = (map: Map<string, number>, id: string) => map.set(id, (map.get(id) ?? 0) + 1);
  const invalidTokens: string[] = [];

  // Ancienne application Expo : un lot par fournisseur.
  const messages: (ExpoPushMessage & { notificationId: string })[] = [];
  for (const n of pending) {
    if (!wanted(n)) continue;
    const p = pousse(n);
    for (const to of expoByUser.get(n.user_id) ?? []) {
      messages.push({ to, title: p.title, body: p.body, data: p.data, badge: p.badge, sound: 'default', channelId: 'bookings', priority: 'high', notificationId: n.id });
    }
  }
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        const m = chunk[i] as (typeof messages)[number] | undefined;
        if (!m) return;
        if (ticket.status === 'ok') return count(accepted, m.notificationId);
        log.warn({ to: m.to, details: ticket.details, message: ticket.message }, 'push ticket error');
        if (ticket.details?.error === 'DeviceNotRegistered' && typeof m.to === 'string') invalidTokens.push(m.to);
        else {
          count(transient, m.notificationId);
          lastError.set(m.notificationId, `expo:${ticket.details?.error ?? 'error'}`);
        }
      });
    } catch (err) {
      log.error({ err }, 'expo push chunk failed');
      for (const m of chunk as typeof messages) {
        count(transient, m.notificationId);
        lastError.set(m.notificationId, 'expo:network');
      }
    }
  }

  /**
   * Un envoi direct (Apple, Firebase, navigateur). `true` = accepté ; `false` = jeton mort, à retirer ;
   * une exception = panne passagère, la notification sera retentée. Jamais une exception ne fait
   * tomber le lot : les autres personnes doivent recevoir la leur.
   */
  const envoyer = async (n: PendingNotification, token: string, send: () => Promise<boolean>, canal: string) => {
    try {
      if (await send()) count(accepted, n.id);
      else invalidTokens.push(token);
    } catch (err) {
      log.error({ err, canal }, 'push : envoi impossible');
      count(transient, n.id);
      lastError.set(n.id, `${canal}:${err instanceof Error ? err.message.slice(0, 80) : 'error'}`);
    }
  };

  // iPhone (Capacitor → APNs). Un iPhone et un Android ne sont JAMAIS le même appareil : quelqu'un
  // qui a les deux doit être prévenu sur les deux, ce canal ne s'exclut donc pas avec Firebase.
  // Le `apns-topic` est celui de l'application qui a enregistré le jeton (grand public ou pro).
  for (const n of pending) {
    if (!wanted(n) || expoByUser.has(n.user_id)) continue;
    const p = pousse(n);
    for (const t of apnsByUser.get(n.user_id) ?? []) {
      await envoyer(n, t.token, () => sendApns(log, { token: t.token, topic: t.app_id ?? undefined, title: p.title, body: p.body, badge: p.badge, data: p.data }), 'apns');
    }
  }

  // Application mobile (Capacitor → Firebase) : même règle de priorité que le reste, une seule
  // notification par personne. Elle passe avant le navigateur, qui ne sert qu'à qui n'a pas l'application.
  for (const n of pending) {
    if (!wanted(n) || expoByUser.has(n.user_id)) continue;
    const p = pousse(n);
    for (const token of fcmByUser.get(n.user_id) ?? []) {
      await envoyer(n, token, () => sendFcm(log, { token, title: p.title, body: p.body, badge: p.badge, data: p.data }), 'fcm');
    }
  }

  // Navigateurs : un envoi par abonnement, les abonnements morts sont supprimés. Une personne qui a
  // l'application mobile est prévenue par elle, pas en double par le navigateur ; le navigateur ne sert
  // qu'à qui n'a pas l'application (un jeton mobile mort est retiré au tour précédent, le navigateur prend le relais).
  for (const n of pending) {
    if (!wanted(n) || expoByUser.has(n.user_id) || apnsByUser.has(n.user_id) || fcmByUser.has(n.user_id)) continue;
    const p = pousse(n);
    for (const token of webByUser.get(n.user_id) ?? []) {
      const r = await sendWebPush(log, token, { title: p.title, body: p.body, data: p.data });
      if (r === 'sent') count(accepted, n.id);
      else if (r === 'gone') invalidTokens.push(token);
      else {
        count(transient, n.id);
        lastError.set(n.id, 'webpush:failed');
      }
    }
  }

  if (invalidTokens.length) {
    const del = await db.from('push_tokens').delete().in('token', invalidTokens);
    if (del.error) log.warn({ err: del.error }, 'push : retrait des jetons morts impossible');
    else log.info({ n: invalidTokens.length }, 'push : jetons morts retirés');
  }

  // Issue de chaque notification. Un échec PASSAGER sans aucun envoi accepté remet la ligne en
  // attente (pushed_at à null) : le cron la reprendra, jusqu'à PUSH_MAX_ATTEMPTS fois.
  let sent = 0;
  const now = new Date().toISOString();
  for (const n of pending) {
    const ok = accepted.get(n.id) ?? 0;
    const ko = transient.get(n.id) ?? 0;
    sent += ok;
    const attempts = n.push_attempts + 1;
    let outcome: PushOutcome;
    if (ok > 0) outcome = 'sent';
    else if (!wanted(n)) outcome = 'opted_out';
    else if (ko > 0) outcome = 'failed';
    else outcome = 'no_device';
    const retry = outcome === 'failed' && attempts < PUSH_MAX_ATTEMPTS;
    const upd = await db
      .from('notifications')
      .update({
        pushed_at: retry ? null : now,
        push_attempts: attempts,
        push_outcome: outcome,
        push_error: outcome === 'failed' ? (lastError.get(n.id) ?? null) : null,
      })
      .eq('id', n.id);
    if (upd.error) log.warn({ err: upd.error, id: n.id }, 'push : issue non enregistrée');
  }

  return sent;
}

/** Fire-and-forget après une mutation de réservation (ne bloque pas la réponse HTTP). */
export function pushAfterBooking(log: FastifyBaseLogger, bookingId: string): void {
  dispatchPendingPush(log, bookingId).catch((err) => log.error({ err, bookingId }, 'push dispatch failed'));
}
