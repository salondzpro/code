/**
 * MISE À JOUR AUTOMATIQUE des applications EMBARQUÉES (29 oct. 2026) : iPhone grand public, et
 * l'application PRO sur iPhone et Android. Elles contiennent une copie du site figée à la
 * compilation ; sans ce module elles restaient sur l'état du jour de leur envoi aux boutiques.
 *
 * À chaque déploiement du site, `scripts/build-site.mjs` publie aussi les deux bundles (grand
 * public et pro) en `.zip` sous `salondz.com/ota/<variante>/`, avec `latest.json`. L'application
 * le lit au démarrage et à chaque retour au premier plan ; si la version diffère de celle qu'elle
 * exécute, elle télécharge le paquet en arrière-plan (`@capgo/capacitor-updater`, mode manuel,
 * auto-hébergé : rien ne passe par un service tiers) et l'applique la prochaine fois que
 * l'application passe en arrière-plan — jamais sous les doigts de la personne.
 *
 * Garde-fous :
 * - `notifyAppReady()` au démarrage : un paquet qui plante avant ce signal est ABANDONNÉ au
 *   bout de 10 s et l'application revient d'elle-même à la version précédente ;
 * - `minNativeBuild` dans `latest.json` : un paquet qui exige un greffon natif plus récent n'est
 *   pas proposé aux binaires plus anciens (ils attendent la mise à jour de la boutique) ;
 * - Android grand public charge salondz.com en direct (mode en ligne) : il est RECHARGÉ quand une
 *   nouvelle version est publiée (20 nov. 2026), aux mêmes moments sûrs.
 *
 * Seul ce qui est WEB se met à jour ainsi (écrans, textes, traductions, styles). Un greffon natif,
 * une permission ou une icône exigent toujours une nouvelle version dans les boutiques.
 */
import { connexionExterneEnCours } from './connexionExterne';
import { Capacitor } from '@capacitor/core';
import { PRO_ONLY } from './flavor';
import { env } from './env';

/** Version du bundle en cours d'exécution, posée à la compilation (`VITE_BUNDLE_VERSION`). */
export const BUNDLE_VERSION: string = import.meta.env.VITE_BUNDLE_VERSION || 'dev';

interface Latest {
  version: string;
  url: string;
  checksum?: string;
  minNativeBuild?: number;
}

let pending: string | null = null;
/** Application EN LIGNE (Android grand public) : une version plus récente du site est publiée. */
let reloadPending = false;
let busy = false;
/**
 * La personne a-t-elle déjà touché l'écran depuis l'ouverture ? Tant que non, une version téléchargée
 * s'applique TOUT DE SUITE (on est encore sur l'ouverture ou le premier écran).
 */
let touched = false;
/** Dernier geste (toucher, clavier, défilement) : une mise à jour s'applique après une minute de calme. */
let lastGesture = Date.now();

/** Vérification pendant que l'application reste ouverte (20 nov. 2026). */
const CHECK_EVERY_MS = 10 * 60_000;
/** Calme exigé avant d'appliquer une version sous les yeux de la personne. */
const IDLE_MS = 60_000;

/** Coque native qui sert sa copie embarquée (et non salondz.com en direct). */
function embedded(): boolean {
  return Capacitor.isNativePlatform() && (location.hostname === 'localhost' || location.protocol === 'capacitor:');
}
/** Coque native qui charge salondz.com EN DIRECT (Android grand public). */
function online(): boolean {
  return Capacitor.isNativePlatform() && !embedded();
}

/**
 * Moment SÛR pour recharger l'écran : aucune fenêtre ouverte, aucun champ en cours de saisie, et une
 * minute sans geste. Jamais au milieu d'une réservation qu'on est en train de remplir.
 */
function safeMoment(): boolean {
  if (Date.now() - lastGesture < IDLE_MS) return false;
  if (document.querySelector('.sheet.modal, .dim, [role="dialog"]')) return false;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
  return true;
}

async function latest(): Promise<Latest | null> {
  const flavor = PRO_ONLY ? 'pro' : 'client';
  const res = await fetch(`${env.siteUrl}/ota/${flavor}/latest.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const l = (await res.json()) as Latest;
  return l.version && l.url ? l : null;
}

async function check(): Promise<void> {
  if (busy || pending || reloadPending) return;
  busy = true;
  try {
    const l = await latest();
    if (!l || l.version === BUNDLE_VERSION || BUNDLE_VERSION === 'dev') return;
    if (online()) {
      // Le site a changé : un rechargement suffit (au retour dans l'application, ou après une minute de calme).
      reloadPending = true;
      return;
    }
    if (l.minNativeBuild) {
      const { App } = await import('@capacitor/app');
      const build = Number((await App.getInfo()).build) || 0;
      if (build < l.minNativeBuild) return;
    }
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const url = new URL(l.url, `${env.siteUrl}/`).toString();
    const bundle = await CapacitorUpdater.download({ url, version: l.version, ...(l.checksum ? { checksum: l.checksum } : {}) });
    // Appliquée au prochain passage en arrière-plan, au prochain lancement, ou après une minute de calme.
    await CapacitorUpdater.next({ id: bundle.id });
    pending = bundle.id;
    if (!touched && !connexionExterneEnCours()) await CapacitorUpdater.set({ id: bundle.id });
  } catch (err) {
    console.warn('[mise à jour] vérification impossible', err);
  } finally {
    busy = false;
  }
}

/** Applique la version en attente (embarquée : changement de paquet ; en ligne : rechargement). */
async function apply(): Promise<void> {
  // Connexion Google / Apple en cours : recharger perdrait la session en transit.
  if (connexionExterneEnCours()) return;
  if (reloadPending) {
    reloadPending = false;
    location.reload();
    return;
  }
  if (!pending) return;
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  await CapacitorUpdater.set({ id: pending }).catch(() => undefined);
}

const actif = () => (embedded() && Capacitor.isPluginAvailable('CapacitorUpdater')) || online();

/**
 * Le paquet en cours a DÉMARRÉ : il est gardé. Sans ce signal dans les 10 s, le greffon revient de
 * lui-même à la version d'avant. Appelé dès que l'interface est rendue.
 */
export async function confirmBundleReady(): Promise<void> {
  if (!embedded() || !Capacitor.isPluginAvailable('CapacitorUpdater')) return;
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  await CapacitorUpdater.notifyAppReady().catch(() => undefined);
}

/**
 * MISE À JOUR SANS PASSER PAR LES BOUTIQUES (20 nov. 2026, demande du propriétaire) : chaque
 * déploiement du site arrive dans les applications toutes seules —
 *   - vérification au démarrage, à chaque retour au premier plan, et toutes les 10 min ;
 *   - appliquée tout de suite si rien n'a encore été touché, sinon au retour dans l'application,
 *     au passage en arrière-plan, ou après une minute sans geste (jamais pendant une saisie) ;
 *   - application EN LIGNE (Android grand public) : rechargement du site dans les mêmes conditions.
 */
export async function initLiveUpdate(): Promise<void> {
  if (!actif()) return;
  window.addEventListener('pointerdown', () => (touched = true), { once: true, capture: true });
  window.addEventListener('keydown', () => (touched = true), { once: true, capture: true });
  for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchmove'] as const)
    window.addEventListener(ev, () => (lastGesture = Date.now()), { capture: true, passive: true });
  const { App } = await import('@capacitor/app');
  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      // Retour dans l'application : la version déjà prête s'applique avant que l'on touche à quoi que ce soit.
      if (reloadPending || pending) void apply();
      else void check();
    } else if (pending) void apply();
  });
  window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if ((pending || reloadPending) && safeMoment()) void apply();
    else void check();
  }, CHECK_EVERY_MS);
  // Une version prête n'attend pas 10 min : on regarde le calme toutes les 15 s.
  window.setInterval(() => {
    if ((pending || reloadPending) && document.visibilityState === 'visible' && safeMoment()) void apply();
  }, 15_000);
  void check();
}
