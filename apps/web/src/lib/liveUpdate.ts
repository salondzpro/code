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
 * - Android grand public charge déjà salondz.com en direct (mode en ligne) : rien à faire.
 *
 * Seul ce qui est WEB se met à jour ainsi (écrans, textes, traductions, styles). Un greffon natif,
 * une permission ou une icône exigent toujours une nouvelle version dans les boutiques.
 */
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
let busy = false;
/**
 * La personne a-t-elle déjà touché l'écran depuis l'ouverture ? Tant que non, une version téléchargée
 * s'applique TOUT DE SUITE (on est encore sur l'ouverture ou le premier écran) : sans cela, il fallait
 * ouvrir l'application, la quitter puis la rouvrir pour voir la nouvelle version — et la plupart des
 * gens ne voyaient jamais rien changer (14 nov. 2026, retour du propriétaire sur iPhone).
 */
let touched = false;

/** Coque native qui sert sa copie embarquée (et non salondz.com en direct). */
function embedded(): boolean {
  return Capacitor.isNativePlatform() && (location.hostname === 'localhost' || location.protocol === 'capacitor:');
}

async function check(): Promise<void> {
  if (busy || pending) return;
  busy = true;
  try {
    const flavor = PRO_ONLY ? 'pro' : 'client';
    const res = await fetch(`${env.siteUrl}/ota/${flavor}/latest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = (await res.json()) as Latest;
    if (!latest.version || !latest.url || latest.version === BUNDLE_VERSION) return;
    if (latest.minNativeBuild) {
      const { App } = await import('@capacitor/app');
      const build = Number((await App.getInfo()).build) || 0;
      if (build < latest.minNativeBuild) return;
    }
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const url = new URL(latest.url, `${env.siteUrl}/`).toString();
    const bundle = await CapacitorUpdater.download({ url, version: latest.version, ...(latest.checksum ? { checksum: latest.checksum } : {}) });
    // Appliquée au prochain passage en arrière-plan (ou au prochain lancement).
    await CapacitorUpdater.next({ id: bundle.id });
    pending = bundle.id;
    if (!touched) await CapacitorUpdater.set({ id: bundle.id });
  } catch (err) {
    console.warn('[mise à jour] vérification impossible', err);
  } finally {
    busy = false;
  }
}

const actif = () => embedded() && Capacitor.isPluginAvailable('CapacitorUpdater');

/**
 * Le paquet en cours a DÉMARRÉ : il est gardé. Sans ce signal dans les 10 s, le greffon revient de
 * lui-même à la version d'avant. Appelé dès que l'interface est rendue, et SEULEMENT de là : il était
 * envoyé au bout de toute l'initialisation native (barre d'état, liens, notifications) — qu'une seule
 * de ces étapes traîne sur iPhone, et la nouvelle version était abandonnée à chaque lancement.
 */
export async function confirmBundleReady(): Promise<void> {
  if (!actif()) return;
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  await CapacitorUpdater.notifyAppReady().catch(() => undefined);
}

/** Dès le démarrage, sans attendre le rendu : la vérification et le téléchargement partent tout de suite. */
export async function initLiveUpdate(): Promise<void> {
  if (!actif()) return;
  window.addEventListener('pointerdown', () => (touched = true), { once: true, capture: true });
  window.addEventListener('keydown', () => (touched = true), { once: true, capture: true });
  const { App } = await import('@capacitor/app');
  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void check();
    else if (pending) void CapacitorUpdater.set({ id: pending }).catch(() => undefined);
  });
  void check();
}
