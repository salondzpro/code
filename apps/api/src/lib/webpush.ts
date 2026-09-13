/**
 * Notifications navigateur (Web Push, protocole VAPID).
 *
 * Le mobile passe par Expo, qui parle à FCM et APNs. Le web n'a pas d'équivalent : le
 * navigateur s'abonne lui-même auprès de son propre service de messagerie (Google, Mozilla,
 * Apple), et nous rend un « abonnement » — une URL et deux clés. Pour lui pousser un message,
 * il faut le chiffrer pour ces clés et le signer avec notre paire VAPID.
 *
 * Sans clés VAPID configurées, tout est silencieusement inactif : le mobile continue de
 * fonctionner, et une installation de développement n'a rien à faire pour démarrer.
 */
import webpush, { WebPushError } from 'web-push';
import type { FastifyBaseLogger } from 'fastify';
import { config } from '../config';

const ready = !!config.VAPID_PUBLIC_KEY && !!config.VAPID_PRIVATE_KEY;
if (ready) {
  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY!, config.VAPID_PRIVATE_KEY!);
}

export const webPushEnabled = ready;

/** Un abonnement navigateur, tel que le client nous l'envoie (sérialisé en JSON). */
interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function parse(token: string): Subscription | null {
  try {
    const s = JSON.parse(token) as Subscription;
    if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth) return null;
    return s;
  } catch {
    return null;
  }
}

/** Le jeton stocké est-il un abonnement navigateur ? (les jetons Expo, eux, ne sont pas du JSON) */
export function isWebPushToken(token: string): boolean {
  return parse(token) !== null;
}

export interface WebPushPayload {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/**
 * Envoie une notification à un navigateur.
 * Retourne `'gone'` quand l'abonnement est mort (404 / 410) : l'appelant doit alors le
 * supprimer, sinon on réessaie indéfiniment sur un navigateur qui n'existe plus.
 */
export async function sendWebPush(
  log: FastifyBaseLogger,
  token: string,
  payload: WebPushPayload,
): Promise<'sent' | 'gone' | 'failed'> {
  if (!ready) return 'failed';
  const sub = parse(token);
  if (!sub) return 'gone';
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
    return 'sent';
  } catch (err) {
    const status = err instanceof WebPushError ? err.statusCode : 0;
    if (status === 404 || status === 410) return 'gone';
    log.warn({ status, endpoint: sub.endpoint.slice(0, 60) }, 'web push échoué');
    return 'failed';
  }
}
