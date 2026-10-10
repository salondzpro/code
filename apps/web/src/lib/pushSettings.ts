/**
 * Emmener la personne AU BON ÉCRAN de réglages de son téléphone.
 *
 * Une permission de notification refusée ne peut plus être redemandée par l'application : c'est une
 * décision du système, et seule une visite dans les réglages la change. Expliquer « allez dans
 * Réglages, puis Applications, puis Salon DZ, puis Notifications » ne fonctionne pas — chaque
 * constructeur range ces écrans ailleurs. On y va directement.
 *
 * Chaque système a son chemin, et aucun n'est une URL web :
 *   - Android : une adresse `intent:` qui vise l'écran de notifications de CETTE application ;
 *     l'identifiant du paquet est passé en extra, sinon on atterrit sur les réglages généraux.
 *   - iOS : le schéma `app-settings:`, qui ouvre la fiche de l'application dans Réglages.
 *   - navigateur : il n'existe aucun moyen d'ouvrir les réglages de site depuis la page. On le dit
 *     plutôt que de faire semblant.
 */
const ua = (): string => (typeof navigator === 'undefined' ? '' : navigator.userAgent);

export const estAndroid = (): boolean => /android/i.test(ua());
export const estIOS = (): boolean => /iphone|ipad|ipod/i.test(ua());
export const surMobile = (): boolean => estAndroid() || estIOS();

const enCoque = (): boolean =>
  Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

/** Identifiant publié : la variante professionnelle est une AUTRE application pour le système. */
const paquet = (): string => (import.meta.env.VITE_APP_FLAVOR === 'pro' ? 'pro.salondz.app' : 'dz.salondz.app');

/**
 * Ouvre les réglages de notification de l'application. Ne rend rien : si le système ne sait pas
 * ouvrir l'écran demandé, la page reste en place — c'est pourquoi l'appelant garde une explication
 * de secours à l'écran.
 */
export function ouvrirReglagesNotifications(): void {
  if (!enCoque()) {
    // Sur le web, le réglage appartient au navigateur et n'est pas adressable.
    return;
  }
  if (estAndroid()) {
    window.location.href =
      `intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;` +
      `S.android.provider.extra.APP_PACKAGE=${paquet()};end`;
    return;
  }
  if (estIOS()) {
    // `app-settings:` ouvre la fiche de l'application dans Réglages, notifications comprises.
    window.location.href = 'app-settings:';
  }
}

/**
 * Ouvre la FICHE de l'application dans les réglages du téléphone (permissions comprises, dont la
 * position). Même raison que pour les notifications : une permission de position refusée ne se
 * redemande plus depuis l'application. Android : `APPLICATION_DETAILS_SETTINGS` avec le paquet en
 * donnée d'intention ; iOS : `app-settings:`. Sur le web, rien n'est adressable : rend `false`,
 * l'appelant retente ou explique.
 */
export function ouvrirReglagesApplication(): boolean {
  if (!enCoque()) return false;
  if (estAndroid()) {
    window.location.href = `intent:package:${paquet()}#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;end`;
    return true;
  }
  if (estIOS()) {
    window.location.href = 'app-settings:';
    return true;
  }
  return false;
}
