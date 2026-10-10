/**
 * Notifications de l'application mobile (Capacitor). C'est la raison d'être de l'application :
 * joindre le professionnel et le client quand l'application est fermée, sans passer par WhatsApp.
 *
 * LE MÊME CODE SERT LES DEUX SYSTÈMES, mais le jeton obtenu n'est pas de la même nature :
 *   - Android : la coque embarque Firebase, le greffon rend un jeton FCM ;
 *   - iPhone : la coque n'embarque PAS Firebase, le greffon rend le jeton APNs brut de l'appareil.
 * Côté serveur, les deux se reconnaissent à leur forme et partent chez Google ou chez Apple
 * (`apps/api/src/lib/fcm.ts` et `lib/apns.ts`). Rien à décider ici — sauf QUELLE application a
 * enregistré le jeton (`appId`) : sur iPhone, Apple exige le topic de la bonne application.
 *
 * Dans une WebView, les notifications du NAVIGATEUR (service worker, VAPID) ne fonctionnent pas : c'est
 * ce module qui prend le relais, et `webpush.ts` lui délègue dès que l'on tourne en natif.
 */
import type { ApiClient } from '@salondz/api-client';
import { PRO_ONLY } from './flavor';

type PushModule = typeof import('@capacitor/push-notifications');
type PushPlugin = PushModule['PushNotifications'];

const load = (): Promise<PushModule> => import('@capacitor/push-notifications');

/** Application qui enregistre le jeton (voir `capacitor.config.ts`) : la pro est une autre application pour le système. */
export const APP_ID: 'dz.salondz.app' | 'pro.salondz.app' = PRO_ONLY ? 'pro.salondz.app' : 'dz.salondz.app';

/**
 * Le jeton n'arrive pas en retour d'appel mais par un événement : on attend le premier. Les deux
 * écouteurs sont RETIRÉS ensuite — chaque appel en posait deux de plus, pour toujours.
 */
function firstToken(Push: PushPlugin, timeoutMs = 15_000): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const handles: Promise<{ remove: () => Promise<void> }>[] = [];
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      for (const h of handles) void h.then((x) => x.remove()).catch(() => undefined);
      resolve(value);
    };
    handles.push(Push.addListener('registration', (t) => finish(t.value)));
    handles.push(Push.addListener('registrationError', () => finish(null)));
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
      deviceName: `${ios ? 'Application iPhone' : 'Application Android'}${PRO_ONLY ? ' Pro' : ''}`,
      appId: APP_ID,
    });
    return true;
  } catch (err) {
    console.warn('[push natif] enregistrement impossible', err);
    return false;
  }
}

/**
 * Première entrée dans l'application : on DEMANDE la permission, une seule fois.
 *
 * Pourquoi : sans jeton natif, le serveur n'a que l'abonnement du NAVIGATEUR — et la personne
 * reçoit des notifications qui portent l'icône de Chrome et le nom du site, alors qu'elle a
 * l'application. C'est exactement ce qui a été constaté. Les notifications sont la raison d'être
 * de cette application : joindre un professionnel quand elle est fermée.
 *
 * Une seule demande par installation : si elle est refusée, on n'insiste jamais — le réglage reste
 * accessible dans l'écran Notifications.
 */
const DEJA_DEMANDE = 'salondz:push:demande';

export async function ensureNativePush(api: ApiClient): Promise<void> {
  try {
    const { PushNotifications: Push } = await load();
    const { receive } = await Push.checkPermissions();
    if (receive === 'granted') {
      await enableNativePush(api);
      return;
    }
    if (receive !== 'prompt') return; // refusée : on n'insiste pas
    if (localStorage.getItem(DEJA_DEMANDE)) return;
    localStorage.setItem(DEJA_DEMANDE, '1');
    await enableNativePush(api);
  } catch {
    /* sans conséquence : l'application reste utilisable */
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

/** Une notification arrivée pendant que l'application est OUVERTE (événement `salondz:push`). */
export interface ForegroundPush {
  title: string;
  body: string;
  /** Destination dans l'application, posée par le serveur (`data.url`). */
  url: string | null;
}

/** Nom de l'événement DOM par lequel ce module prévient l'interface (voir `components/PushToast.tsx`). */
export const PUSH_EVENT = 'salondz:push';

/**
 * Deux moments, deux gestes :
 *   - un APPUI sur une notification (application en arrière-plan ou fermée) doit OUVRIR le
 *     rendez-vous concerné, pas seulement l'application — le serveur place la destination dans
 *     `data.url`, la même que pour les notifications navigateur ;
 *   - une notification REÇUE pendant que l'application est ouverte : le système ne la montre pas
 *     (Android) ou la montre sans que l'écran bouge (iOS). On prévient l'interface, qui recharge
 *     ses données et affiche un bandeau — toucher le bandeau mène au rendez-vous.
 *
 * Les deux écouteurs sont posés une fois, au démarrage, avant tout rendu : un appui sur une
 * notification qui LANCE l'application est délivré dès que l'écouteur existe.
 */
export async function wireNativePushTaps(navigate: (path: string) => void): Promise<void> {
  try {
    const { PushNotifications: Push } = await load();
    await Push.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const url = (notification.data as Record<string, unknown> | undefined)?.url;
      if (typeof url === 'string' && url.startsWith('/')) navigate(url);
    });
    await Push.addListener('pushNotificationReceived', (notification) => {
      const data = (notification.data ?? {}) as Record<string, unknown>;
      const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : null;
      const detail: ForegroundPush = {
        title: notification.title ?? (typeof data.title === 'string' ? data.title : 'Salon DZ'),
        body: notification.body ?? (typeof data.body === 'string' ? data.body : ''),
        url,
      };
      window.dispatchEvent(new CustomEvent<ForegroundPush>(PUSH_EVENT, { detail }));
    });
  } catch {
    /* sans conséquence */
  }
}
