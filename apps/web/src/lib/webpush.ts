/**
 * Notifications navigateur côté client : enregistrement du service worker, permission,
 * abonnement, et envoi de l'abonnement à l'API.
 *
 * L'abonnement sérialisé sert de « jeton » dans `push_tokens`, avec `platform = 'web'` :
 * la table le prévoyait depuis le début, rien à migrer. Côté serveur, `lib/webpush.ts`
 * reconnaît un abonnement au fait que c'est du JSON, là où un jeton Expo n'en est pas.
 *
 * Tout échoue silencieusement et sans conséquence : un navigateur sans notifications, une
 * permission refusée ou une clé VAPID absente laissent l'application parfaitement utilisable.
 * Le temps réel couvre déjà l'onglet ouvert ; le push ne sert qu'à l'atteindre quand il est
 * fermé.
 */
import type { ApiClient } from '@salondz/api-client';
import { Capacitor } from '@capacitor/core';
import { env } from './env';

const SW_URL = '/sw.js';

/** Vrai dans l'application mobile (coque Capacitor), faux sur le site. */
const nativeShell = (): boolean => Capacitor.isNativePlatform();

export function webPushSupported(): boolean {
  // L'application mobile est toujours joignable : c'est Firebase qui s'en charge.
  if (nativeShell()) return true;
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!env.vapidPublicKey
  );
}

export function webPushPermission(): NotificationPermission | 'unsupported' {
  // `Notification` n'existe pas dans une WebView : l'état réel est lu de façon asynchrone par
  // `nativePushPermission()`. « default » revient à proposer l'activation, ce qui est le bon défaut.
  if (nativeShell()) return 'default';
  return webPushSupported() ? Notification.permission : 'unsupported';
}

/** La clé VAPID voyage en base64url ; `applicationServerKey` veut des octets. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function subscribe(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey!) as BufferSource,
  });
}

/**
 * Demande la permission si besoin, puis enregistre l'abonnement côté API.
 * Retourne `true` seulement si le navigateur est désormais joignable.
 */
export async function enableWebPush(api: ApiClient): Promise<boolean> {
  // Dans l'application mobile, les notifications passent par Firebase : une WebView ne reçoit rien
  // par service worker. Les écrans appellent la même fonction, ils n'ont pas à connaître la différence.
  if (nativeShell()) {
    const { enableNativePush } = await import('./nativePush');
    return enableNativePush(api);
  }
  if (!webPushSupported()) return false;
  try {
    const permission =
      Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') return false;
    const sub = await subscribe();
    if (!sub) return false;
    await api.me.registerPushToken({
      token: JSON.stringify(sub.toJSON()),
      platform: 'web',
      deviceName: navigator.userAgent.slice(0, 80),
    });
    return true;
  } catch (err) {
    console.warn('[push] abonnement navigateur impossible', err);
    return false;
  }
}

/**
 * Réenregistre l'abonnement quand la permission est DÉJÀ accordée, sans jamais afficher de
 * demande. À appeler au chargement : un abonnement peut être renouvelé par le navigateur,
 * et un jeton périmé ne reçoit plus rien sans que personne s'en aperçoive.
 */
export async function refreshWebPushIfGranted(api: ApiClient): Promise<void> {
  if (nativeShell()) {
    const { refreshNativePushIfGranted } = await import('./nativePush');
    await refreshNativePushIfGranted(api);
    return;
  }
  if (!webPushSupported() || Notification.permission !== 'granted') return;
  await enableWebPush(api);
}

/** Coupe les notifications sur CE navigateur : désabonnement local puis retrait côté API. */
export async function disableWebPush(api: ApiClient): Promise<void> {
  if (nativeShell()) {
    const { disableNativePush } = await import('./nativePush');
    await disableNativePush(api);
    return;
  }
  if (!webPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const token = JSON.stringify(sub.toJSON());
    await sub.unsubscribe().catch(() => undefined);
    await api.me.removePushToken(token).catch(() => undefined);
  } catch (err) {
    console.warn('[push] désabonnement impossible', err);
  }
}
