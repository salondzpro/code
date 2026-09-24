/**
 * Adaptation du SITE à la coque native (Capacitor). L'application mobile n'est pas une seconde base de
 * code : c'est ce site, embarqué. Ce fichier est le SEUL endroit qui connaît le natif.
 *
 * Principe : on ne modifie pas les écrans. Au démarrage, on REMPLACE les fonctions du navigateur qui ne
 * marchent pas dans une WebView (position, partage) par leurs équivalents natifs, et le reste du code
 * continue d'appeler `navigator.geolocation` ou `navigator.share` sans rien savoir.
 *
 * Les greffons sont importés À LA DEMANDE : un visiteur du site ne télécharge rien de tout cela.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Position : la WebView ne demande pas la permission Android toute seule, le greffon si. */
async function patchGeolocation(): Promise<void> {
  const { Geolocation } = await import('@capacitor/geolocation');
  // Le greffon rend des coordonnées simples ; les écrans n'en lisent que les champs usuels.
  const toPosition = (p: { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number }): GeolocationPosition =>
    ({ coords: p.coords, timestamp: p.timestamp }) as unknown as GeolocationPosition;
  const toError = (e: unknown): GeolocationPositionError =>
    ({ code: 1, message: String(e), PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError;

  const watches = new Map<number, string>();
  let nextId = 1;

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition(ok: PositionCallback, fail?: PositionErrorCallback, opts?: PositionOptions) {
        Geolocation.getCurrentPosition({
          enableHighAccuracy: opts?.enableHighAccuracy ?? false,
          timeout: opts?.timeout ?? 10_000,
        })
          .then((p) => ok(toPosition(p)))
          .catch((e) => fail?.(toError(e)));
      },
      watchPosition(ok: PositionCallback, fail?: PositionErrorCallback, opts?: PositionOptions): number {
        const id = nextId++;
        void Geolocation.watchPosition(
          { enableHighAccuracy: opts?.enableHighAccuracy ?? false },
          (p, err) => (err || !p ? fail?.(toError(err)) : ok(toPosition(p))),
        ).then((watchId) => watches.set(id, watchId));
        return id;
      },
      clearWatch(id: number) {
        const watchId = watches.get(id);
        if (watchId) {
          void Geolocation.clearWatch({ id: watchId });
          watches.delete(id);
        }
      },
    },
  });
}

/** Partage : `navigator.share` n'existe pas dans la WebView Android, le greffon ouvre la feuille système. */
async function patchShare(): Promise<void> {
  const { Share } = await import('@capacitor/share');
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: async (data: ShareData) => {
      await Share.share({ title: data.title, text: data.text, url: data.url });
    },
  });
}

/**
 * Bouton RETOUR d'Android : sans cela il ferme l'application, même au milieu d'une réservation.
 * On rejoue l'historique du routeur ; seule la racine ferme réellement l'application.
 */
async function wireBackButton(): Promise<void> {
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) window.history.back();
    else void App.exitApp();
  });
}

/**
 * Liens salondz.com ouverts depuis l'extérieur (partage WhatsApp, e-mail) : ils doivent s'ouvrir DANS
 * l'application, sur la bonne page, et non dans le navigateur.
 */
async function wireDeepLinks(navigate: (path: string) => void): Promise<void> {
  const { App } = await import('@capacitor/app');
  await App.addListener('appUrlOpen', ({ url }) => {
    try {
      const target = new URL(url);
      navigate(`${target.pathname}${target.search}${target.hash}`);
    } catch {
      /* lien illisible : on reste où l'on est */
    }
  });
}

/** Barre d'état : texte sombre sur fond clair, et l'application dessine sous elle (encoches). */
async function setupChrome(): Promise<void> {
  const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ]);
  await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
  // L'application ne dessine PAS sous les barres du téléphone : c'est le système qui leur réserve
  // la place (`android:fitsSystemWindows`), donc l'affichage s'adapte tout seul à chaque appareil —
  // encoche, barre gestuelle ou trois boutons. Le contraire cachait des boutons en haut et en bas.
  await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
  await SplashScreen.hide().catch(() => undefined);
}

/** À appeler une fois au démarrage. Sans effet sur le site ouvert dans un navigateur. */
export async function initNative(navigate: (path: string) => void): Promise<void> {
  if (!isNative()) return;
  document.documentElement.dataset.native = 'true';
  await Promise.all([
    patchGeolocation(),
    patchShare(),
    wireBackButton(),
    wireDeepLinks(navigate),
    setupChrome(),
  ]).catch((err) => console.warn('[natif] initialisation partielle', err));
}
