/**
 * « Ouvrir Gmail » plutôt que « Ouvrir ma messagerie » (13 nov. 2026, demande du propriétaire).
 *
 * Après une inscription, un lien de connexion ou un mot de passe oublié, la personne doit aller lire
 * un e-mail. Le bouton reconnaît la messagerie d'après le DOMAINE de l'adresse, en porte le logo, et
 * ouvre directement son application — sans repasser par l'écran d'accueil du téléphone.
 *
 * OUVRIR, selon l'endroit :
 *   - application Android : greffon natif `ReglagesNotifications.ouvrirMessagerie` (lance
 *     l'application par son paquet ; à défaut l'application de messagerie par défaut). Une adresse
 *     `intent:` lancée depuis la page ne marche PAS dans la coque (voir `pushSettings.ts`) ;
 *   - navigateur Android : adresse `intent:` avec repli sur la version web ;
 *   - iPhone (application ou Safari) : schéma de l'application (`googlegmail://`…), puis la version
 *     web si rien ne s'est ouvert ;
 *   - ordinateur : la version web dans un nouvel onglet.
 * Une adresse d'un domaine inconnu (messagerie d'entreprise) n'a pas de version web connue : sur
 * ordinateur le bouton n'est pas proposé (`proposable`).
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { estAndroid, estIOS } from './pushSettings';
import { openExternal } from './openExternal';

export type MailAppId = 'gmail' | 'outlook' | 'yahoo' | 'icloud' | 'autre';

export interface MailApp {
  id: MailAppId;
  /** Nom affiché dans « Ouvrir … ». */
  nom: string;
  web?: string;
  ios?: string;
  android?: string;
}

const APPS: Record<Exclude<MailAppId, 'autre'>, MailApp & { domaines: RegExp }> = {
  gmail: {
    id: 'gmail',
    nom: 'Gmail',
    domaines: /^(gmail|googlemail)\.com$/,
    web: 'https://mail.google.com/mail/u/0/#inbox',
    ios: 'googlegmail://',
    android: 'com.google.android.gm',
  },
  outlook: {
    id: 'outlook',
    nom: 'Outlook',
    domaines: /^(outlook|hotmail|live)\.[a-z.]+$|^msn\.com$/,
    web: 'https://outlook.live.com/mail/',
    ios: 'ms-outlook://',
    android: 'com.microsoft.office.outlook',
  },
  yahoo: {
    id: 'yahoo',
    nom: 'Yahoo Mail',
    domaines: /^yahoo\.[a-z.]+$|^(ymail|rocketmail)\.com$/,
    web: 'https://mail.yahoo.com/',
    ios: 'ymail://',
    android: 'com.yahoo.mobile.client.android.mail',
  },
  icloud: {
    id: 'icloud',
    nom: 'Mail',
    domaines: /^(icloud|me|mac)\.com$/,
    web: 'https://www.icloud.com/mail',
    ios: 'message://',
  },
};

/** La messagerie d'une adresse e-mail, d'après son domaine. */
export function mailAppFor(email: string): MailApp {
  const domaine = email.trim().toLowerCase().split('@')[1] ?? '';
  for (const app of Object.values(APPS)) if (app.domaines.test(domaine)) return app;
  return { id: 'autre', nom: '', ios: 'message://' };
}

/** Le bouton a-t-il un sens ici ? Une messagerie inconnue, sur ordinateur, n'a rien à ouvrir. */
export function proposable(app: MailApp): boolean {
  if (estAndroid() || estIOS()) return true;
  return !!app.web;
}

interface MessageriePlugin {
  ouvrirMessagerie(o: { paquet?: string }): Promise<{ ouvert: boolean }>;
}
const Natif = registerPlugin<MessageriePlugin>('ReglagesNotifications');

/** Ouvre la messagerie ; à défaut sa version web. */
export async function ouvrirMessagerie(app: MailApp): Promise<void> {
  const natif = Capacitor.isNativePlatform();

  if (estAndroid()) {
    if (natif) {
      try {
        const { ouvert } = await Natif.ouvrirMessagerie({ paquet: app.android });
        if (ouvert) return;
      } catch {
        // Application compilée avant la méthode : on passe à la version web.
      }
      if (app.web) await openExternal(app.web);
      return;
    }
    if (app.android) {
      const repli = app.web ? `;S.browser_fallback_url=${encodeURIComponent(app.web)}` : '';
      window.location.href = `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${app.android}${repli};end`;
      return;
    }
    if (app.web) window.location.href = app.web;
    return;
  }

  if (estIOS() && app.ios) {
    // Si l'application s'ouvre, la page passe en arrière-plan : on n'ouvre alors rien d'autre.
    let parti = false;
    const quitte = () => {
      if (document.visibilityState === 'hidden') parti = true;
    };
    document.addEventListener('visibilitychange', quitte);
    window.location.href = app.ios;
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', quitte);
      if (!parti && app.web) void openExternal(app.web);
    }, 1500);
    return;
  }

  if (app.web) await openExternal(app.web);
}
