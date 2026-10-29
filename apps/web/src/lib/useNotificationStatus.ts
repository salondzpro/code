/**
 * ÉTAT RÉEL DES NOTIFICATIONS, POUR CE COMPTE SUR CET APPAREIL — une seule source pour le bandeau
 * de relance (`NotificationsNudge`) et la ligne des réglages (`PushBlocked`).
 *
 * Pourquoi (25 oct. 2026) : le bandeau affichait « Ouvrir les réglages » à des personnes dont les
 * notifications étaient bel et bien actives. Trois causes, toutes corrigées ici :
 *   1. après un appui sur « Activer », un ÉCHEC D'INSCRIPTION de l'appareil (réseau lent, jeton qui
 *      tarde, compte de démonstration) était pris pour un REFUS — le bandeau passait à « refusé »
 *      alors que le téléphone avait dit oui. On relit désormais l'état réel du téléphone ;
 *   2. sur le SITE, ouvert dans le navigateur du téléphone, on parlait des réglages de
 *      l'application et de sa mise à jour : ce n'est ni le même réglage ni le même logiciel. Les
 *      consignes dépendent maintenant de l'endroit où l'on est (application Android, application
 *      iPhone, navigateur du téléphone, ordinateur) ;
 *   3. un compte qui a l'APPLICATION reçoit ses notifications sur l'application — le serveur ne
 *      pousse jamais aux deux. Le site ne lui demande donc plus rien dans le navigateur.
 */
import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { api } from './api';
import { useAuth } from './auth';
import { enableWebPushDetailed, pushPermissionNow, usePushPermission, type PushFailure } from './webpush';
import { estAndroid, estIOS, greffonReglages, ouvrirReglagesNotifications } from './pushSettings';
import { PRO_ONLY } from './flavor';
import { isDemo } from '@/demo/session';
import { t } from '@/i18n';

/** Où l'on est : chaque endroit a son propre réglage, et sa propre façon d'y aller. */
export type Contexte = 'app-android' | 'app-ios' | 'web-mobile' | 'web-ordinateur';

export type Situation =
  /** Une notification envoyée maintenant arriverait ici, ou sur l'application du compte. */
  | 'actives'
  /** Le système peut encore poser la question : on la pose dans l'application. */
  | 'a-demander'
  /** Refusées : seul le réglage du téléphone (ou du navigateur) peut les rouvrir. */
  | 'bloquees'
  /** Ce navigateur ne sait pas recevoir de notifications (Safari hors écran d'accueil…). */
  | 'impossibles';

export function contexte(): Contexte {
  if (Capacitor.isNativePlatform()) return Capacitor.getPlatform() === 'ios' ? 'app-ios' : 'app-android';
  return estAndroid() || estIOS() ? 'web-mobile' : 'web-ordinateur';
}

/**
 * Le chemin écrit, quand l'écran ne peut pas s'ouvrir tout seul. Jamais générique : il nomme les
 * menus de l'endroit où l'on est, et l'application par son nom (la variante pro est une autre
 * application pour le téléphone).
 */
export function consigne(ctx: Contexte): string {
  const app = PRO_ONLY ? 'Salon DZ Pro' : 'Salon DZ';
  switch (ctx) {
    case 'app-android':
      return t('Ouvrez Réglages, puis Applications, puis {app}, puis Notifications, et activez-les. Mettez l’application à jour pour y aller en un geste.', { app });
    case 'app-ios':
      return t('Ouvrez Réglages, puis {app}, puis Notifications, et activez « Autoriser les notifications ».', { app });
    case 'web-mobile':
      return estIOS()
        ? t('Dans Safari, les notifications du site ne marchent qu’une fois le site ajouté à l’écran d’accueil. Le plus simple : installez l’application {app}.', { app })
        : t('Touchez l’icône à gauche de l’adresse (cadenas ou réglages), puis Autorisations, puis Notifications : Autoriser. Ou installez l’application {app}.', { app });
    case 'web-ordinateur':
      return t('Sur ordinateur, l’autorisation se change dans les réglages du navigateur, à côté de la barre d’adresse.');
  }
}

export function useNotificationStatus(): {
  pret: boolean;
  situation: Situation;
  contexte: Contexte;
  /** L'écran de réglage peut-il s'ouvrir d'un geste ici ? Sinon : `consigne`. */
  ouvrable: boolean;
  consigne: string;
  activer: () => Promise<boolean>;
  /** Pourquoi la dernière activation a échoué, en une phrase (affichée sous le bouton). */
  erreur: string | null;
  /** Ouvre l'écran de réglage ; rend `false` s'il n'a pas pu s'ouvrir (il faut alors la consigne). */
  ouvrir: () => Promise<boolean>;
  occupe: boolean;
} {
  const { session } = useAuth();
  const [permission, setPermission, permissionLue] = usePushPermission();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const ctx = contexte();
  const surSite = ctx === 'web-mobile' || ctx === 'web-ordinateur';

  // Sur le site seulement : ce compte a-t-il l'application ? (Dans l'application, l'appareil lui-même
  // est la seule chose qui compte.) Un échec de lecture ne cache rien : on se fie au navigateur.
  const appareils = useQuery({
    queryKey: ['me', 'push-devices'],
    queryFn: () => api.me.pushDevices(),
    enabled: surSite && !!session && !isDemo(),
    staleTime: 5 * 60_000,
    retry: false,
  });
  // Seul le navigateur du TÉLÉPHONE se tait quand le compte a l'application (c'est le même appareil).
  // Un ORDINATEUR reçoit toujours : avant le 29 oct. 2026, il se disait « actif » et ne recevait rien.
  const aLApplication = ctx === 'web-mobile' && (appareils.data?.app ?? 0) > 0;
  const appareilsLus = !surSite || !session || isDemo() || !appareils.isPending;

  const [ouvrableNatif, setOuvrableNatif] = useState(() => greffonReglages());
  useEffect(() => setOuvrableNatif(greffonReglages()), []);

  const situation: Situation = aLApplication
    ? 'actives'
    : permission === 'granted'
      ? 'actives'
      : permission === 'unsupported'
        ? 'impossibles'
        : permission === 'denied'
          ? 'bloquees'
          : 'a-demander';

  const activer = useCallback(async () => {
    setOccupe(true);
    setErreur(null);
    let ok = false;
    try {
      const r = await enableWebPushDetailed(api);
      ok = r.ok;
      if (!r.ok) setErreur(pushFailureText(r.reason, ctx));
    } catch {
      setErreur(pushFailureText('server', ctx));
    } finally {
      // L'ÉTAT RÉEL, jamais la réussite de l'inscription : un téléphone qui a dit oui mais dont le
      // jeton n'a pas pu être enregistré (réseau) n'est PAS « refusé ».
      setPermission(await pushPermissionNow());
      setOccupe(false);
    }
    return ok;
  }, [setPermission, ctx]);

  const ouvrir = useCallback(async () => (ctx === 'app-android' || ctx === 'app-ios' ? ouvrirReglagesNotifications() : false), [ctx]);

  return {
    pret: permissionLue && appareilsLus,
    situation,
    contexte: ctx,
    ouvrable: (ctx === 'app-android' && ouvrableNatif) || ctx === 'app-ios',
    consigne: consigne(ctx),
    activer,
    erreur,
    ouvrir,
    occupe,
  };
}

/** Une phrase par échec, qui dit quoi faire — jamais « une erreur est survenue ». */
export function pushFailureText(reason: PushFailure, ctx: Contexte): string {
  switch (reason) {
    case 'denied':
      return t('Les notifications sont bloquées pour Salon DZ. {chemin}', { chemin: consigne(ctx) });
    case 'dismissed':
      return t('La demande a été fermée sans réponse. Touchez à nouveau « Activer » et choisissez « Autoriser ».');
    case 'unsupported':
      return consigne(ctx);
    case 'subscribe':
      return t('Ce navigateur a refusé l’abonnement aux notifications. En navigation privée, ouvrez une fenêtre normale. Sur Brave, activez « Utiliser les services Google pour la messagerie push » dans ses réglages ; sinon, essayez Chrome, Edge ou Firefox.');
    case 'blocked':
      return t('Le service de notifications du navigateur ne répond pas : ce réseau le bloque sans doute (réseau d’entreprise, pare-feu, VPN). Essayez depuis un autre réseau, ou installez l’application.');
    case 'server':
      return t('L’autorisation est donnée, mais l’enregistrement n’a pas abouti (réseau). Réessayez dans un instant.');
    case 'native':
      return t('Le téléphone n’a pas encore donné son identifiant de notification. Vérifiez la connexion, puis réessayez.');
  }
}
