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

interface PendingNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  type: string;
  booking_id: string | null;
}

/**
 * Envoie les notifications non poussées (pushed_at null) via Expo Push.
 * Idempotent : marque pushed_at même sans token (rien à envoyer).
 * `bookingId` limite aux notifs d'une réservation (appel juste après une mutation).
 */
export async function dispatchPendingPush(log: FastifyBaseLogger, bookingId?: string): Promise<number> {
  let q = db
    .from('notifications')
    .select('id, user_id, title, body, data, type, booking_id')
    .is('pushed_at', null)
    .order('created_at', { ascending: true })
    .limit(200);
  if (bookingId) q = q.eq('booking_id', bookingId);
  const { data: pending, error } = await q;
  if (error) throw error;
  if (!pending || pending.length === 0) return 0;

  const userIds = [...new Set(pending.map((n) => n.user_id as string))];

  // Réglage « Confirmations » (client) : les notifications de réservation restent dans l'application
  // mais ne sont pas poussées quand la personne l'a coupé. Un pro reçoit toujours ses demandes.
  const optOut = new Set<string>();
  if (pending.some((n) => CONFIRMATION_TYPES.has(n.type as string))) {
    const prefs = await db.from('profiles').select('id').in('id', userIds).eq('role', 'client').eq('notify_confirmations', false);
    if (prefs.error) log.warn({ err: prefs.error }, 'push prefs');
    for (const p of prefs.data ?? []) optOut.add(p.id as string);
  }
  const wanted = (n: PendingNotification) => !(optOut.has(n.user_id) && CONFIRMATION_TYPES.has(n.type));
  const { data: tokens, error: tErr } = await db
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds);
  if (tErr) throw tErr;

  // Quatre canaux, quatre protocoles, reconnus à la FORME du jeton : Expo (ancienne application),
  // APNs (iPhone), Firebase (Android), Web Push (navigateur). L'ORDRE des tests compte — un jeton
  // APNs doit être reconnu AVANT Firebase, qui accepte « tout le reste ». Un jeton d'aucune de ces
  // formes est ignoré plutôt que de faire échouer le lot entier.
  const tokensByUser = new Map<string, string[]>();
  const apnsByUser = new Map<string, string[]>();
  const fcmByUser = new Map<string, string[]>();
  const webByUser = new Map<string, string[]>();
  for (const t of tokens ?? []) {
    if (Expo.isExpoPushToken(t.token)) {
      const list = tokensByUser.get(t.user_id) ?? [];
      list.push(t.token);
      tokensByUser.set(t.user_id, list);
    } else if (apnsEnabled && isApnsToken(t.token)) {
      // iPhone : la coque iOS n'a pas Firebase, on parle à Apple directement.
      const list = apnsByUser.get(t.user_id) ?? [];
      list.push(t.token);
      apnsByUser.set(t.user_id, list);
    } else if (fcmEnabled && isFcmToken(t.token)) {
      // Application mobile (coque Capacitor) : Firebase directement.
      const list = fcmByUser.get(t.user_id) ?? [];
      list.push(t.token);
      fcmByUser.set(t.user_id, list);
    } else if (webPushEnabled && isWebPushToken(t.token)) {
      const list = webByUser.get(t.user_id) ?? [];
      list.push(t.token);
      webByUser.set(t.user_id, list);
    }
  }

  /**
   * BADGE DE L'ICÔNE : le nombre de notifications non lues, par personne. Recalculé à chaque
   * envoi et posé sur la notification elle-même — c'est le système qui l'affiche sur l'icône.
   * Il redescend tout seul quand la personne les ouvre, la lecture posant `read_at`.
   */
  const badges = new Map<string, number>();
  {
    const { data: nonLues, error } = await db
      .from('notifications')
      .select('user_id')
      .in('user_id', userIds)
      .is('read_at', null);
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

  const messages: ExpoPushMessage[] = [];
  for (const n of pending as PendingNotification[]) {
    if (!wanted(n)) continue;
    const p = pousse(n);
    for (const to of tokensByUser.get(n.user_id) ?? []) {
      messages.push({
        to,
        title: p.title,
        body: p.body,
        data: p.data,
        badge: p.badge,
        sound: 'default',
        channelId: 'bookings',
        priority: 'high',
      });
    }
  }

  const invalidTokens: string[] = [];
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'error') {
          const to = chunk[i]?.to;
          log.warn({ to, details: ticket.details, message: ticket.message }, 'push ticket error');
          if (ticket.details?.error === 'DeviceNotRegistered' && typeof to === 'string') invalidTokens.push(to);
        }
      });
    } catch (err) {
      log.error({ err }, 'expo push chunk failed');
    }
  }

  // iPhone (Capacitor → APNs). Un iPhone et un Android ne sont JAMAIS le même appareil : quelqu'un
  // qui a les deux doit être prévenu sur les deux, ce canal ne s'exclut donc pas avec Firebase.
  let apnsSent = 0;
  for (const n of pending as PendingNotification[]) {
    if (!wanted(n) || tokensByUser.has(n.user_id)) continue;
    const p = pousse(n);
    for (const token of apnsByUser.get(n.user_id) ?? []) {
      const ok = await sendApns(log, { token, title: p.title, body: p.body, badge: p.badge, data: p.data });
      if (ok) apnsSent++;
      else invalidTokens.push(token);
    }
  }

  // Application mobile (Capacitor → Firebase) : même règle de priorité que le reste, une seule
  // notification par personne. Elle passe avant le navigateur, qui ne sert qu'à qui n'a pas l'application.
  let fcmSent = 0;
  for (const n of pending as PendingNotification[]) {
    if (!wanted(n) || tokensByUser.has(n.user_id)) continue;
    const p = pousse(n);
    for (const token of fcmByUser.get(n.user_id) ?? []) {
      const ok = await sendFcm(log, { token, title: p.title, body: p.body, badge: p.badge, data: p.data });
      if (ok) fcmSent++;
      else invalidTokens.push(token);
    }
  }

  // Navigateurs : un envoi par abonnement, les abonnements morts sont supprimés. Une personne qui a
  // l'application mobile est prévenue par elle, pas en double par le navigateur ; le navigateur ne sert
  // qu'à qui n'a pas l'application (un jeton mobile mort est retiré au tour précédent, le navigateur prend le relais).
  let webSent = 0;
  for (const n of pending as PendingNotification[]) {
    if (!wanted(n) || tokensByUser.has(n.user_id) || apnsByUser.has(n.user_id) || fcmByUser.has(n.user_id)) continue;
    const p = pousse(n);
    for (const token of webByUser.get(n.user_id) ?? []) {
      const r = await sendWebPush(log, token, { title: p.title, body: p.body, data: p.data });
      if (r === 'sent') webSent++;
      if (r === 'gone') invalidTokens.push(token);
    }
  }

  if (invalidTokens.length) {
    await db.from('push_tokens').delete().in('token', invalidTokens);
  }

  const { error: uErr } = await db
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .in('id', pending.map((n) => n.id as string));
  if (uErr) throw uErr;

  return messages.length + apnsSent + fcmSent + webSent;
}

/** Fire-and-forget après une mutation de réservation (ne bloque pas la réponse HTTP). */
export function pushAfterBooking(log: FastifyBaseLogger, bookingId: string): void {
  dispatchPendingPush(log, bookingId).catch((err) => log.error({ err, bookingId }, 'push dispatch failed'));
}
