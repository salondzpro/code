import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import type { FastifyBaseLogger } from 'fastify';
import { db } from './supabase';

const expo = new Expo({ useFcmV1: true });

interface PendingNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  type: string;
}

/**
 * Envoie les notifications non poussées (pushed_at null) via Expo Push.
 * Idempotent : marque pushed_at même sans token (rien à envoyer).
 * `bookingId` limite aux notifs d'une réservation (appel juste après une mutation).
 */
export async function dispatchPendingPush(log: FastifyBaseLogger, bookingId?: string): Promise<number> {
  let q = db
    .from('notifications')
    .select('id, user_id, title, body, data, type')
    .is('pushed_at', null)
    .order('created_at', { ascending: true })
    .limit(200);
  if (bookingId) q = q.eq('booking_id', bookingId);
  const { data: pending, error } = await q;
  if (error) throw error;
  if (!pending || pending.length === 0) return 0;

  const userIds = [...new Set(pending.map((n) => n.user_id as string))];
  const { data: tokens, error: tErr } = await db
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds);
  if (tErr) throw tErr;

  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens ?? []) {
    if (!Expo.isExpoPushToken(t.token)) continue;
    const list = tokensByUser.get(t.user_id) ?? [];
    list.push(t.token);
    tokensByUser.set(t.user_id, list);
  }

  const messages: ExpoPushMessage[] = [];
  for (const n of pending as PendingNotification[]) {
    for (const to of tokensByUser.get(n.user_id) ?? []) {
      messages.push({
        to,
        title: n.title,
        body: n.body,
        data: { ...n.data, type: n.type, notificationId: n.id },
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

  if (invalidTokens.length) {
    await db.from('push_tokens').delete().in('token', invalidTokens);
  }

  const { error: uErr } = await db
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .in('id', pending.map((n) => n.id as string));
  if (uErr) throw uErr;

  return messages.length;
}

/** Fire-and-forget après une mutation de réservation (ne bloque pas la réponse HTTP). */
export function pushAfterBooking(log: FastifyBaseLogger, bookingId: string): void {
  dispatchPendingPush(log, bookingId).catch((err) => log.error({ err, bookingId }, 'push dispatch failed'));
}
