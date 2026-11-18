/**
 * FAVORISER L'APPLICATION (18 nov. 2026, demande du propriétaire : « toujours favoriser l'application,
 * tout savoir automatiquement, ne jamais faire galérer la cliente »).
 *
 * Une cliente arrive sur le SITE (lien en bio Instagram, WhatsApp, QR) :
 *   - ANDROID : si l'application est installée, on l'ouvre AUTOMATIQUEMENT, directement sur la page du
 *     salon (`intent://reprise?d=/s/<slug>`, déjà compris par l'application, `lib/native.ts`). Sinon,
 *     Android revient sur la page (repli `S.browser_fallback_url`) : aucune erreur, une seule tentative ;
 *   - iPHONE : Safari affiche une erreur si l'on vise une application absente — pas d'ouverture
 *     automatique. Le bouton « Ouvrir » essaie l'application, puis mène à l'App Store si rien ne s'est
 *     ouvert ; les liens universels (`apple-app-site-association`) font le reste hors Instagram.
 * Les boutons « Installer » mènent DIRECTEMENT à la fiche du bon store selon le téléphone.
 * Rien de tout cela dans l'application elle-même, ni sur ordinateur, ni dans la variante pro.
 */
import { PRO_ONLY } from './flavor';

export const APP_STORE_URL = 'https://apps.apple.com/app/id6817317513';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=dz.salondz.app';
const PAQUET = 'dz.salondz.app';

const natif = (): boolean => Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

/** Téléphone détecté, SUR LE SITE seulement (null : application, ordinateur, variante pro). */
export function mobileOS(): 'ios' | 'android' | null {
  if (natif() || PRO_ONLY) return null;
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return null;
}

export const storeUrl = (os: 'ios' | 'android') => (os === 'ios' ? APP_STORE_URL : PLAY_STORE_URL);

const intent = (path: string, repli: string) =>
  `intent://reprise?d=${encodeURIComponent(path)}#Intent;scheme=salondz;package=${PAQUET};S.browser_fallback_url=${encodeURIComponent(repli)};end`;

/** Bouton « Ouvrir » : l'application sur `path` si elle est là, sinon le store du téléphone. */
export function openInApp(path: string): void {
  const os = mobileOS();
  if (!os) return;
  if (os === 'android') {
    window.location.href = intent(path, PLAY_STORE_URL);
    return;
  }
  // iPhone : on tente l'application ; si la page est toujours visible 1,6 s plus tard, rien ne s'est
  // ouvert — l'App Store prend le relais.
  const t0 = Date.now();
  const cache = () => document.visibilityState === 'hidden';
  window.location.href = `salondz://reprise?d=${encodeURIComponent(path)}`;
  window.setTimeout(() => {
    if (!cache() && Date.now() - t0 < 4000) window.location.href = APP_STORE_URL;
  }, 1600);
}

/**
 * Ouverture AUTOMATIQUE (Android) : une seule tentative par salon et par session de navigation. Le
 * repli ramène sur la même page marquée `?web=1`, qui ne relance jamais l'application (pas de boucle).
 */
export function autoOpenApp(path: string): void {
  if (mobileOS() !== 'android') return;
  const url = new URL(window.location.href);
  if (url.searchParams.has('web')) return;
  const cle = `salondz:auto-app:${path}`;
  try {
    if (sessionStorage.getItem(cle)) return;
    sessionStorage.setItem(cle, '1');
  } catch {
    return;
  }
  url.searchParams.set('web', '1');
  window.location.replace(intent(path, url.toString()));
}
