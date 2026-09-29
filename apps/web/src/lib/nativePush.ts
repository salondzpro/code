/**
 * Notifications de l'application mobile (Capacitor). C'est la raison d'être de l'application :
 * joindre le professionnel et le client quand l'application est fermée, sans passer par WhatsApp.
 *
 * LE MÊME CODE SERT LES DEUX SYSTÈMES, mais le jeton obtenu n'est pas de la même nature :
 *   - Android : la coque embarque Firebase, le greffon rend un jeton FCM ;
 *   - iPhone : la coque n'embarque PAS Firebase, le greffon rend le jeton APNs brut de l'appareil.
 * Côté serveur, les deux se reconnaissent à leur forme et partent chez Google ou chez Apple
 * (`apps/api/src/lib/fcm.ts` et `lib/apns.ts`). Rien à décider ici.
 *
 * Dans une WebView, les notifications du NAVIGATEUR (service worker, VAPID) ne fonctionnent pas : c'est
 * ce module qui prend le relais, et `webpush.ts` lui délègue dès que l'on tourne en natif.
 */
import type { ApiClient } from '@salondz/api-client';

type PushModule = typeof import('@capacitor/push-notifications');

const load = (): Promise<PushModule> => import('@capacitor/push-notifications');

/** Le jeton n'arrive pas en retour d'appel mais par un événement : on attend le premier. */
function firstToken(Push: PushModule['PushNotifications'], timeoutMs = 15_000): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: string | null) => {
      if (!done) {
        done = true;
        resolve(value);
      }
    };
    void Push.addListener('registration', (t) => finish(t.value));
    void Push.addListener('registrationError', () => finish(null));
    setTimeout(() => finish(null), timeoutMs);
  });
}

/**
 * Demande la permission si besoin, puis enregistre le jeton côté API.
 * Retourne `true` seulement si l'appareil est désormais joignable.
 */
export async function enableNativePush(api: ApiClient): Promise<boolean> {
  try {
    const { PushNotifications: Push } = await load();
    const current = await Push.checkPermissions();
    const status = current.receive === 'prompt' ? (await Push.requestPermissions()).receive : current.receive;
    if (status !== 'granted') return false;
    const token = firstToken(Push);
    await Push.register();
    const value = await token;
    if (!value) return false;
    // L'appareil dit lui-même ce qu'il est : un iPhone enregistré comme « android » se retrouverait
    // dans la mauvaise liste de la page Appareils, et le propriétaire ne saurait plus quoi révoquer.
    const { Capacitor } = await import('@capacitor/core');
    const ios = Capacitor.getPlatform() === 'ios';
    await api.me.registerPushToken({
      token: value,
      platform: ios ? 'ios' : 'android',
      deviceName: ios ? 'Application iPhone' : 'Application Android',
    });
    return true;
  } catch (err) {
    console.warn('[push natif] enregistrement impossible', err);
    return false;
  }
}

/** Réenregistre le jeton quand la permission est DÉJÀ accordée, sans jamais afficher de demande. */
export async function refreshNativePushIfGranted(api: ApiClient): Promise<void> {
  try {
    const { PushNotifications: Push } = await load();
    if ((await Push.checkPermissions()).receive !== 'granted') return;
    await enableNativePush(api);
  } catch {
    /* sans conséquence : l'application reste utilisable */
  }
}

/** Coupe les notifications sur CET appareil. */
export async function disableNativePush(api: ApiClient): Promise<void> {
  try {
    const { PushNotifications: Push } = await load();
    const token = firstToken(Push, 3_000);
    await Push.register();
    const value = await token;
    await Push.unregister().catch(() => undefined);
    if (value) await api.me.removePushToken(value).catch(() => undefined);
  } catch {
    /* sans conséquence */
  }
}

/** Permission actuelle, dans le vocabulaire du navigateur pour que les écrans n'aient rien à changer. */
export async function nativePushPermission(): Promise<NotificationPermission> {
  try {
    const { PushNotifications: Push } = await load();
    const { receive } = await Push.checkPermissions();
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'default';
  } catch {
    return 'default';
  }
}

/**
 * Un appui sur une notification doit OUVRIR le rendez-vous concerné, pas seulement l'application.
 * Le serveur place déjà la destination dans `data.url` pour les notifications navigateur : on la réutilise.
 */
export async function wireNativePushTaps(navigate: (path: string) => void): Promise<void> {
  try {
    const { PushNotifications: Push } = await load();
    await Push.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const url = (notification.data as Record<string, unknown> | undefined)?.url;
      if (typeof url === 'string' && url.startsWith('/')) navigate(url);
    });
  } catch {
    /* sans conséquence */
  }
}
