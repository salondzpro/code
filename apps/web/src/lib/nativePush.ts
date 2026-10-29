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
/** Dernière erreur rendue par le système à l'inscription (affichée pour qu'on puisse la signaler). */
let lastRegistrationError: string | null = null;

function firstToken(Push: PushPlugin, timeoutMs = 20_000): { ready: Promise<unknown>; value: Promise<string | null> } {
  const handles: Promise<{ remove: () => Promise<void> }>[] = [];
  const value = new Promise<string | null>((resolve) => {
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      for (const h of handles) void h.then((x) => x.remove()).catch(() => undefined);
      resolve(v);
    };
    handles.push(Push.addListener('registration', (t) => finish(t.value)));
    handles.push(
      Push.addListener('registrationError', (e) => {
        lastRegistrationError = String((e as { error?: unknown })?.error ?? 'inconnue');
        finish(null);
      }),
    );
    setTimeout(() => {
      if (!done) lastRegistrationError = lastRegistrationError ?? 'délai dépassé';
      finish(null);
    }, timeoutMs);
  });
  // Les écouteurs doivent être POSÉS avant `register()` : sinon un jeton rendu très vite (déjà connu
  // du système) part avant qu'on l'écoute, et l'on attendait 15 s pour conclure à un échec.
  return { ready: Promise.all(handles), value };
}

/** Résultat détaillé : l'écran dit QUOI faire selon ce qui a manqué. */
export type NativeEnableResult =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'token' | 'server'; detail?: string; /** Le système ne pouvait plus demander : seuls ses réglages rouvrent. */ systemBlocked?: boolean };

/** Le système peut-il encore afficher sa demande ? (`prompt-with-rationale` : Android après un premier refus.) */
const canAsk = (r: string) => r === 'prompt' || r === 'prompt-with-rationale';

async function obtenirJeton(Push: PushPlugin): Promise<string | null> {
  // Deux essais : le premier jeton Firebase peut tarder sur un réseau lent ou un téléphone qui
  // vient de démarrer ; un second `register()` le relance au lieu de conclure trop tôt à l'échec.
  for (let essai = 0; essai < 2; essai++) {
    lastRegistrationError = null;
    const token = firstToken(Push);
    await token.ready;
    await Push.register();
    const value = await token.value;
    if (value) return value;
  }
  return null;
}

/**
 * Demande la permission si le système peut encore la demander (y compris APRÈS un premier refus
 * sur Android), puis enregistre le jeton côté API.
 */
export async function enableNativePushDetailed(api: ApiClient): Promise<NativeEnableResult> {
  try {
    const { PushNotifications: Push } = await load();
    const current = await Push.checkPermissions();
    const status = canAsk(current.receive) ? (await Push.requestPermissions()).receive : current.receive;
    if (status !== 'granted') return { ok: false, reason: 'denied', systemBlocked: !canAsk(current.receive) };
    const value = await obtenirJeton(Push);
    if (!value) return { ok: false, reason: 'token', detail: lastRegistrationError ?? undefined };
    // L'appareil dit lui-même ce qu'il est : un iPhone enregistré comme « android » se retrouverait
    // dans la mauvaise liste de la page Appareils, et le propriétaire ne saurait plus quoi révoquer.
    const { Capacitor } = await import('@capacitor/core');
    const ios = Capacitor.getPlatform() === 'ios';
    try {
      await api.me.registerPushToken({
        token: value,
        platform: ios ? 'ios' : 'android',
        deviceName: `${ios ? 'Application iPhone' : 'Application Android'}${PRO_ONLY ? ' Pro' : ''}`,
        appId: APP_ID,
      });
    } catch {
      return { ok: false, reason: 'server' };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[push natif] enregistrement impossible', err);
    return { ok: false, reason: 'token', detail: err instanceof Error ? err.message : undefined };
  }
}

/** Version simple : `true` seulement si l'appareil est désormais joignable. */
export async function enableNativePush(api: ApiClient): Promise<boolean> {
  return (await enableNativePushDetailed(api)).ok;
}

/**
 * À chaque ouverture de l'application : si les notifications ne sont pas accordées et que le
 * système peut encore poser sa question (première fois, ou Android après un refus), on la REPOSE —
 * au plus une fois tous les trois jours, pour ne pas harceler. Quand le système ne peut plus
 * demander (iPhone après un refus, Android après deux), c'est le bandeau de l'application qui
 * emmène dans les réglages du téléphone.
 *
 * Pourquoi : sans jeton natif, le serveur n'a que l'abonnement du NAVIGATEUR — et la personne
 * reçoit des notifications qui portent l'icône de Chrome et le nom du site, alors qu'elle a
 * l'application. Les notifications sont la raison d'être de cette application.
 */
const DEJA_DEMANDE = 'salondz:push:demande';
const REDEMANDE_MS = 3 * 24 * 3600_000;

export async function ensureNativePush(api: ApiClient): Promise<void> {
  try {
    const { PushNotifications: Push } = await load();
    const { receive } = await Push.checkPermissions();
    if (receive === 'granted') {
      await enableNativePush(api);
      return;
    }
    if (!canAsk(receive)) return; // le système ne peut plus demander : bandeau → réglages
    const last = Number(localStorage.getItem(DEJA_DEMANDE) || 0);
    if (last > 1 && Date.now() - last < REDEMANDE_MS) return;
    localStorage.setItem(DEJA_DEMANDE, String(Date.now()));
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
    await token.ready;
    await Push.register();
    const value = await token.value;
    await Push.unregister().catch(() => undefined);
    if (value) await api.me.removePushToken(value).catch(() => undefined);
  } catch {
    /* sans conséquence */
  }
}

/**
 * État actuel, dans le vocabulaire du navigateur pour que les écrans n'aient rien à changer :
 *   - `granted` : une notification envoyée maintenant s'afficherait ;
 *   - `default` : le système peut encore poser la question, on la pose dans l'application ;
 *   - `denied`  : seul le téléphone peut rouvrir — on emmène dans ses réglages.
 *
 * La permission seule ne suffit pas : sur Android antérieur à 13 elle est TOUJOURS « accordée », et
 * sur tout Android on peut couper les notifications (ou tous leurs canaux) dans les réglages sans y
 * toucher. L'interrupteur réel, lu par le greffon `ReglagesNotifications`, a le dernier mot.
 */
export async function nativePushPermission(): Promise<NotificationPermission> {
  try {
    const { PushNotifications: Push } = await load();
    const { receive } = await Push.checkPermissions();
    const { notificationsActivesSurLeTelephone } = await import('./pushSettings');
    const actives = await notificationsActivesSurLeTelephone();
    if (actives === true) return 'granted';
    if (actives === false) {
      // Coupées : si le système peut encore demander, on demande ; sinon, direction les réglages.
      return receive === 'prompt' || receive === 'prompt-with-rationale' ? 'default' : 'denied';
    }
    // Application sans le greffon : on ne connaît que la permission.
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
