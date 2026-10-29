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
import { useEffect, useState } from 'react';
import type { ApiClient } from '@salondz/api-client';
import { Capacitor } from '@capacitor/core';
import { env } from './env';

const SW_URL = '/sw.js';

/**
 * « Désactivé ici » : un CHOIX, retenu sur l'appareil. Sans lui, la permission restant accordée par le
 * navigateur, le réabonnement silencieux du chargement (`refreshWebPushIfGranted`) rallumait les
 * notifications à la page suivante — l'interrupteur ne pouvait pas rester éteint.
 */
const OFF_KEY = 'salondz:push:off';
const choixOff = (v?: boolean): boolean => {
  try {
    if (v === true) localStorage.setItem(OFF_KEY, '1');
    else if (v === false) localStorage.removeItem(OFF_KEY);
    return localStorage.getItem(OFF_KEY) === '1';
  } catch {
    return false;
  }
};

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

/**
 * État RÉEL, lu maintenant : dans l'application, celui du téléphone (`webPushPermission()` y répond
 * toujours « default »). À relire après une demande refusée — sinon l'écran remontre un
 * interrupteur au lieu du chemin vers les réglages.
 */
export async function pushPermissionNow(): Promise<NotificationPermission | 'unsupported'> {
  if (!nativeShell()) {
    const p = webPushPermission();
    return p === 'granted' && !(await webSubscriptionActive()) ? 'default' : p;
  }
  const { nativePushPermission } = await import('./nativePush');
  return nativePushPermission();
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

/** Même clé ? Un abonnement pris avec une ANCIENNE clé VAPID ne reçoit plus rien, en silence. */
function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const k = sub.options?.applicationServerKey;
  if (!k) return true; // navigateur qui ne l'expose pas : on ne peut pas juger, on garde
  const a = new Uint8Array(k);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

/** Enregistrement du service worker, ACTIF (un worker en cours d'installation ne peut pas s'abonner). */
async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  return navigator.serviceWorker.ready;
}

async function subscribe(): Promise<PushSubscription> {
  const reg = await registration();
  const key = urlBase64ToUint8Array(env.vapidPublicKey!);
  const existing = await reg.pushManager.getSubscription();
  if (existing && sameKey(existing, key)) return existing;
  if (existing) await existing.unsubscribe().catch(() => undefined);
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource });
}

/** Ce navigateur a-t-il un abonnement EN COURS ? (une permission accordée ne suffit pas.) */
export async function webSubscriptionActive(): Promise<boolean> {
  if (nativeShell() || !webPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    return !!(await reg?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/**
 * Pourquoi l'activation n'a pas abouti — chaque cas a sa phrase à l'écran (`pushFailureText`) :
 *   - `denied` / `dismissed` : refusée, ou fenêtre fermée sans répondre ;
 *   - `unsupported` : ce navigateur ne sait pas (Safari d'iPhone hors écran d'accueil, navigation privée…) ;
 *   - `subscribe` : la permission est là, mais le service de messagerie du navigateur a refusé
 *     l'abonnement (Brave avec ses réglages par défaut, réseau d'entreprise, extension) ;
 *   - `server` : l'abonnement existe, mais notre serveur n'a pas pu l'enregistrer (réseau) ;
 *   - `native` : l'application n'a pas obtenu de jeton du téléphone.
 */
export type PushFailure = 'denied' | 'dismissed' | 'unsupported' | 'subscribe' | 'server' | 'native';
export type EnableResult = { ok: true } | { ok: false; reason: PushFailure };

/** Signale aux écrans qu'il faut relire l'état (abonnement pris ou retiré ailleurs dans la page). */
const notifyChange = () => window.dispatchEvent(new Event('salondz:push-state'));

/**
 * Demande la permission si besoin, s'abonne, puis enregistre l'abonnement côté API — en disant
 * POURQUOI quand ça échoue. Avant, un échec d'abonnement après une permission accordée laissait
 * l'écran afficher « activées » : rien n'arrivait, et rien ne le disait.
 */
export async function enableWebPushDetailed(api: ApiClient): Promise<EnableResult> {
  if (nativeShell()) {
    const { enableNativePush, nativePushPermission } = await import('./nativePush');
    if (await enableNativePush(api)) return { ok: true };
    return { ok: false, reason: (await nativePushPermission()) === 'denied' ? 'denied' : 'native' };
  }
  if (!webPushSupported()) return { ok: false, reason: 'unsupported' };
  choixOff(false);
  const permission =
    Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission === 'denied') return { ok: false, reason: 'denied' };
  if (permission !== 'granted') return { ok: false, reason: 'dismissed' };
  let sub: PushSubscription;
  try {
    sub = await subscribe();
  } catch (err) {
    console.warn('[push] abonnement navigateur refusé', err);
    return { ok: false, reason: 'subscribe' };
  }
  try {
    await api.me.registerPushToken({
      token: JSON.stringify(sub.toJSON()),
      platform: 'web',
      deviceName: navigator.userAgent.slice(0, 80),
    });
  } catch (err) {
    console.warn('[push] enregistrement de l’abonnement impossible', err);
    return { ok: false, reason: 'server' };
  } finally {
    notifyChange();
  }
  return { ok: true };
}

/** Variante booléenne, pour les appels qui n'affichent rien. */
export async function enableWebPush(api: ApiClient): Promise<boolean> {
  return (await enableWebPushDetailed(api)).ok;
}

/**
 * Réenregistre l'abonnement quand la permission est DÉJÀ accordée, sans jamais afficher de
 * demande. À appeler au chargement : un abonnement peut être renouvelé par le navigateur,
 * et un jeton périmé ne reçoit plus rien sans que personne s'en aperçoive.
 */
export async function refreshWebPushIfGranted(api: ApiClient): Promise<void> {
  if (nativeShell()) {
    // Dans l'application, on va plus loin qu'un rafraîchissement : si la permission n'a jamais été
    // demandée, on la demande UNE fois. Sans jeton natif, c'est le navigateur qui notifierait —
    // avec son icône et son nom, ce qui n'a aucun sens quand on a l'application.
    const { ensureNativePush } = await import('./nativePush');
    await ensureNativePush(api);
    return;
  }
  if (!webPushSupported() || Notification.permission !== 'granted' || choixOff()) return;
  // Silencieux : la permission est déjà là, on renouvelle l'abonnement (ou on le reprend s'il a
  // été perdu, ou pris avec une ancienne clé) sans rien demander.
  await enableWebPushDetailed(api).catch(() => undefined);
}

/** Coupe les notifications sur CE navigateur : désabonnement local puis retrait côté API. */
export async function disableWebPush(api: ApiClient): Promise<void> {
  if (nativeShell()) {
    const { disableNativePush } = await import('./nativePush');
    await disableNativePush(api);
    return;
  }
  if (!webPushSupported()) return;
  choixOff(true);
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const token = JSON.stringify(sub.toJSON());
    await sub.unsubscribe().catch(() => undefined);
    await api.me.removePushToken(token).catch(() => undefined);
  } catch (err) {
    console.warn('[push] désabonnement impossible', err);
  } finally {
    notifyChange();
  }
}

/**
 * Permission de notification, RÉACTIVE, dans le vocabulaire du navigateur — et juste dans
 * l'application mobile. `webPushPermission()` y répond toujours « default » (l'objet `Notification`
 * n'existe pas dans une WebView) : l'interrupteur « Notifications sur cet appareil » restait donc
 * ÉTEINT sur un téléphone où elles étaient accordées et actives. On lit l'état réel du téléphone,
 * de façon asynchrone, et l'écran suit.
 *
 * L'état est RELU À CHAQUE RETOUR dans l'application : la personne envoyée dans les réglages du
 * téléphone revient par le bouton retour, et l'écran doit refléter ce qu'elle vient d'y faire sans
 * qu'elle ait à recharger. Si elle vient de les rallumer, l'appareil est réinscrit dans la foulée —
 * sans jeton enregistré, la permission retrouvée ne servirait à rien.
 */
export function usePushPermission(): [
  NotificationPermission | 'unsupported',
  (p: NotificationPermission | 'unsupported') => void,
  /** Faux tant que le téléphone n'a pas répondu : l'état affiché n'est alors qu'une supposition. */
  boolean,
] {
  const [etat, setEtat] = useState<NotificationPermission | 'unsupported'>(() => webPushPermission());
  const [pret, setPret] = useState(false);
  useEffect(() => {
    if (!nativeShell()) {
      // NAVIGATEUR : « accordée » ne veut rien dire sans abonnement. Une permission accordée SANS
      // abonnement (désactivé ici, abonnement perdu, refusé par le navigateur) se présente comme
      // « à activer » : le bouton l'activera sans redemander la permission.
      let vivant = true;
      const lire = async () => {
        const p = webPushPermission();
        const v = p === 'granted' && !(await webSubscriptionActive()) ? 'default' : p;
        if (vivant) {
          setEtat(v);
          setPret(true);
        }
      };
      void lire();
      const auRetour = () => document.visibilityState === 'visible' && void lire();
      document.addEventListener('visibilitychange', auRetour);
      window.addEventListener('salondz:push-state', lire);
      return () => {
        vivant = false;
        document.removeEventListener('visibilitychange', auRetour);
        window.removeEventListener('salondz:push-state', lire);
      };
    }
    let vivant = true;
    let precedent: NotificationPermission | null = null;
    const lire = async () => {
      try {
        const m = await import('./nativePush');
        const p = await m.nativePushPermission();
        if (!vivant) return;
        if (p === 'granted' && precedent !== null && precedent !== 'granted') {
          const { api } = await import('./api');
          void m.refreshNativePushIfGranted(api);
        }
        precedent = p;
        setEtat(p);
      } catch {
        /* l'écran garde son dernier état */
      } finally {
        if (vivant) setPret(true);
      }
    };
    void lire();
    const auRetour = () => {
      if (document.visibilityState === 'visible') void lire();
    };
    document.addEventListener('visibilitychange', auRetour);
    let retrait: (() => void) | null = null;
    void import('@capacitor/app')
      .then(({ App }) => App.addListener('resume', () => void lire()))
      .then((h) => {
        if (vivant) retrait = () => void h.remove();
        else void h.remove();
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
      document.removeEventListener('visibilitychange', auRetour);
      retrait?.();
    };
  }, []);
  return [etat, setEtat, pret];
}
