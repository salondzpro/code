/**
 * CONNEXION AVEC GOOGLE ET APPLE (21 nov. 2026, demande du propriétaire).
 *
 * Le bouton n'apparaît que si le fournisseur Google est ACTIVÉ sur Supabase (lu sur
 * `/auth/v1/settings`, public) : rien à recompiler le jour où il l'est.
 *
 * Le retour se fait sur `/connexion/retour?next=…&portail=client|pro&oauth=1` (jetons dans le
 * fragment, flux implicite) :
 *   - sur le SITE, la page entière part chez Google puis revient ;
 *   - dans l'APPLICATION, Google refuse les vues web intégrées : la page de Google s'ouvre dans le
 *     navigateur du système (`openExternal`), et au retour la passation (`lib/appHandoff.ts`) rouvre
 *     la BONNE application (pro si `portail=pro`) avec la session.
 * Au retour, `WelcomeBack` demande le compte DU PORTAIL emprunté (`POST /v1/auth/oauth-portail`,
 * 25 nov. 2026) : jamais celui de l'autre côté qui porterait la même adresse.
 */
import { APPLI } from './flavor';
import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from './supabase';
import { env } from './env';
import { isNative } from './native';
import { openExternal } from './openExternal';
import { debutConnexionExterne, finConnexionExterne } from './connexionExterne';
import { demarrerTrace, trace } from './traceConnexion';

/** Fournisseurs de connexion proposés (21 nov. 2026 : Google, puis Apple). */
export type Fournisseur = 'google' | 'apple';

let reglages: Promise<Record<string, boolean>> | null = null;

/**
 * BOUTONS QUI NE SURGISSENT PLUS (25 nov. 2026, signalé par le propriétaire : « le bouton Google
 * s'affiche après la page »). La liste des fournisseurs actifs est lue sur le serveur
 * d'authentification ; la DERNIÈRE réponse est gardée sur l'appareil et sert dès l'affichage
 * suivant (relue en arrière-plan). Sans mémoire (toute première visite), l'écran montre un
 * squelette à la place du bouton tant que la réponse n'est pas là (`OAuthButtons`).
 */
const MEMOIRE = 'salondz:oauth-actifs';
function memoire(): Record<string, boolean> | null {
  try {
    const v = localStorage.getItem(MEMOIRE);
    return v ? (JSON.parse(v) as Record<string, boolean>) : null;
  } catch {
    return null;
  }
}

/** Fournisseurs ACTIVÉS sur le projet Supabase (une seule lecture par lancement). */
export function fournisseursActifs(): Promise<Record<string, boolean>> {
  reglages ??= fetch(`${env.supabaseUrl}/auth/v1/settings`, { headers: { apikey: env.supabasePublishableKey } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { external?: Record<string, boolean> } | null) => {
      const ext = j?.external ?? null;
      if (ext) {
        try {
          localStorage.setItem(MEMOIRE, JSON.stringify({ google: !!ext.google, apple: !!ext.apple }));
        } catch {
          /* stockage indisponible */
        }
      }
      return ext ?? memoire() ?? {};
    })
    .catch(() => memoire() ?? {});
  return reglages;
}

/**
 * Ceux des fournisseurs demandés qui sont activés, dans l'ordre demandé, et si la réponse est
 * connue (`pret`). Mémoire de l'appareil = prêt tout de suite.
 */
export function useFournisseursEtat(liste: Fournisseur[]): { actifs: Fournisseur[]; pret: boolean } {
  const [etat, setEtat] = useState(() => {
    const m = memoire();
    return { actifs: m ? liste.filter((f) => m[f]) : [], pret: m !== null };
  });
  useEffect(() => {
    let vivant = true;
    void fournisseursActifs().then((ext) => vivant && setEtat({ actifs: liste.filter((f) => ext[f]), pret: true }));
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return etat;
}

/** Ceux des fournisseurs demandés qui sont activés (sans l'état de chargement). */
export function useFournisseurs(liste: Fournisseur[]): Fournisseur[] {
  return useFournisseursEtat(liste).actifs;
}

/**
 * ADRESSE DE RETOUR D'UNE CONNEXION LANCÉE SUR LE SITE (26 nov. 2026, signalé par le propriétaire :
 * Google depuis le portail pro du site ouvrait l'application CLIENTE sur iPhone). Un iPhone garde en
 * cache, parfois des jours, l'ancienne liste des adresses réclamées par l'application cliente (`/*`,
 * donc aussi `/connexion/retour`). `/professionnels/*` est la seule famille d'adresses qu'AUCUNE
 * application ne réclame, dans l'ancienne liste comme dans la nouvelle : le retour y reste sur le
 * site, quel que soit le cache du téléphone. Une connexion lancée PAR UNE APPLICATION garde
 * `/connexion/retour` : sa passation rend la main à l'application qui l'a lancée.
 */
export const RETOUR_WEB = '/professionnels/connexion';

export async function connexionOAuth(fournisseur: Fournisseur, role: 'client' | 'pro', next: string): Promise<void> {
  const retour = new URL(isNative() ? '/connexion/retour' : RETOUR_WEB, env.siteUrl);
  retour.searchParams.set('next', next);
  retour.searchParams.set('portail', role);
  retour.searchParams.set('oauth', '1');
  const natif = isNative();
  // Demandé PAR L'APPLICATION : la page de retour sait qu'elle doit rendre la session à l'application
  // et ne pas l'ouvrir pour son propre compte (`lib/appHandoff.ts`).
  if (natif) retour.searchParams.set('app', APPLI ?? 'client');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: fournisseur,
    options: {
      redirectTo: retour.toString(),
      skipBrowserRedirect: natif,
      ...(fournisseur === 'google' ? { queryParams: { prompt: 'select_account' } } : { scopes: 'name email' }),
    },
  });
  if (error) throw error;
  if (!natif || !data?.url) return;
  debutConnexionExterne();
  demarrerTrace();
  trace('depart', { f: fournisseur, role, plat: Capacitor.getPlatform(), greffon: Capacitor.isPluginAvailable('ConnexionWeb') });
  if (Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('ConnexionWeb')) {
    await connexionIOS(data.url);
    return;
  }
  // Android (onglet Chrome, qui partage les comptes du téléphone) et anciennes versions iPhone.
  await openExternal(data.url);
}

/**
 * IPHONE (24 nov. 2026) : fenêtre de connexion d'Apple (`ASWebAuthenticationSession`, greffon
 * `ConnexionWeb` de `SceneDelegate.swift`). Elle partage les comptes Google de Safari — dans
 * `SFSafariViewController`, Google n'en voyait aucun — et rend directement l'adresse
 * `salondz://reprise?d=…` posée par la page de retour, sans la question « Ouvrir dans Salon DZ ? ».
 */
const ConnexionWeb = registerPlugin<{ ouvrir(o: { url: string }): Promise<{ url: string }> }>('ConnexionWeb');

async function connexionIOS(url: string): Promise<void> {
  let retour: string;
  try {
    retour = (await ConnexionWeb.ouvrir({ url })).url;
    trace('ios-retour', { schema: retour.split(':')[0], d: /[?&]d=/.test(retour), jetons: /refresh_token/.test(decodeURIComponent(retour)) });
  } catch (e) {
    trace('ios-erreur', { m: String((e as Error)?.message ?? e) });
    // Fenêtre fermée par la personne : rien à signaler, elle reste sur l'écran de connexion.
    finConnexionExterne();
    if (String((e as Error)?.message ?? e).includes('annule')) return;
    throw e;
  }
  const d = new URL(retour).searchParams.get('d');
  if (!d || !d.startsWith('/')) return;
  const { router } = await import('@/app/router');
  await router.navigate(d);
}
