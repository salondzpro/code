/**
 * Emmener la personne AU BON ÉCRAN de réglages de son téléphone, et savoir si elle doit y aller.
 *
 * Une permission de notification refusée ne peut plus être redemandée par l'application : c'est une
 * décision du système, et seule une visite dans les réglages la change. Expliquer « allez dans
 * Réglages, puis Applications, puis Salon DZ, puis Notifications » ne fonctionne pas — chaque
 * constructeur range ces écrans ailleurs. On y va directement.
 *
 * TOUT PASSE PAR LE GREFFON NATIF `ReglagesNotifications` (`ReglagesNotificationsPlugin.java`,
 * `SceneDelegate.swift`). Jusqu'au 21 oct. 2026 on lançait une adresse `intent:` (Android) ou
 * `app-settings:` (iOS) depuis la page : Capacitor transmet une adresse externe par une simple
 * intention « voir », qu'aucune application Android ne sait traiter — le bouton ne faisait RIEN.
 * Le greffon ouvre l'écran « Notifications » de l'application elle-même (Android 8+, iOS 16+),
 * à défaut sa fiche dans les réglages.
 *
 * Il dit aussi l'état RÉEL : sur Android antérieur à 13, le greffon de notifications de Capacitor
 * répond « accordé » même quand la personne a coupé les notifications de l'application.
 *
 * Une application installée AVANT ce greffon ne l'a pas (la page, elle, est déjà à jour) : on retombe
 * alors sur l'ancien chemin iOS, et sur Android l'appelant affiche l'explication écrite.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

const ua = (): string => (typeof navigator === 'undefined' ? '' : navigator.userAgent);

export const estAndroid = (): boolean => /android/i.test(ua());
export const estIOS = (): boolean => /iphone|ipad|ipod/i.test(ua());
export const surMobile = (): boolean => estAndroid() || estIOS();

/** Vrai dans l'application mobile (coque Capacitor). */
export const enCoque = (): boolean => Capacitor.isNativePlatform();

interface ReglagesNotificationsPlugin {
  etat(): Promise<{ actives: boolean }>;
  ouvrir(): Promise<{ ouvert: boolean }>;
  ouvrirApplication(): Promise<{ ouvert: boolean }>;
}

const Reglages = registerPlugin<ReglagesNotificationsPlugin>('ReglagesNotifications');

/** Le greffon est-il dans CETTE installation ? Faux sur le web et dans une application trop ancienne. */
export const greffonReglages = (): boolean => enCoque() && Capacitor.isPluginAvailable('ReglagesNotifications');

/**
 * Le téléphone afficherait-il une notification de cette application, là, maintenant ?
 * `null` quand on ne peut pas le savoir (web, application sans le greffon) : l'appelant se fie alors
 * à la permission seule.
 */
export async function notificationsActivesSurLeTelephone(): Promise<boolean | null> {
  if (!greffonReglages()) return null;
  try {
    return (await Reglages.etat()).actives;
  } catch {
    return null;
  }
}

/**
 * Ouvre l'écran « Notifications » de l'application dans les réglages du téléphone.
 * Rend `false` quand rien n'a pu s'ouvrir (web, application trop ancienne) : l'appelant garde
 * alors une explication écrite à l'écran.
 */
export async function ouvrirReglagesNotifications(): Promise<boolean> {
  if (!enCoque()) return false; // Sur le web, le réglage appartient au navigateur et n'est pas adressable.
  if (greffonReglages()) {
    try {
      return (await Reglages.ouvrir()).ouvert;
    } catch {
      return false;
    }
  }
  return ancienCheminIOS();
}

/**
 * Ouvre la FICHE de l'application dans les réglages du téléphone (permissions comprises, dont la
 * position). Même raison que pour les notifications : une permission de position refusée ne se
 * redemande plus depuis l'application. Rend `false` si rien n'a pu s'ouvrir.
 */
export async function ouvrirReglagesApplication(): Promise<boolean> {
  if (!enCoque()) return false;
  if (greffonReglages()) {
    try {
      return (await Reglages.ouvrirApplication()).ouvert;
    } catch {
      return false;
    }
  }
  return ancienCheminIOS();
}

/** Application iPhone sans le greffon : WebKit confie `app-settings:` au système, qui ouvre la fiche. */
function ancienCheminIOS(): boolean {
  if (Capacitor.getPlatform() !== 'ios') return false;
  window.location.href = 'app-settings:';
  return true;
}
