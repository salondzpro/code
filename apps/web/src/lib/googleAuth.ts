/**
 * CONNEXION AVEC GOOGLE (21 nov. 2026, demande du propriétaire).
 *
 * Le bouton n'apparaît que si le fournisseur Google est ACTIVÉ sur Supabase (lu sur
 * `/auth/v1/settings`, public) : rien à recompiler le jour où il l'est.
 *
 * Le retour se fait sur `/connexion/retour?next=…&portail=client|pro&google=1` (jetons dans le
 * fragment, flux implicite) :
 *   - sur le SITE, la page entière part chez Google puis revient ;
 *   - dans l'APPLICATION, Google refuse les vues web intégrées : la page de Google s'ouvre dans le
 *     navigateur du système (`openExternal`), et au retour la passation (`lib/appHandoff.ts`) rouvre
 *     la BONNE application (pro si `portail=pro`) avec la session.
 * Un compte créé par Google naît client ; par le portail pro, `WelcomeBack` le déclare pro tant
 * qu'il est neuf (`POST /v1/auth/google-pro`).
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { env } from './env';
import { isNative } from './native';
import { openExternal } from './openExternal';

let dispo: Promise<boolean> | null = null;

/** Le fournisseur Google est-il activé sur le projet Supabase ? (une seule lecture par lancement) */
export function googleDisponible(): Promise<boolean> {
  dispo ??= fetch(`${env.supabaseUrl}/auth/v1/settings`, { headers: { apikey: env.supabasePublishableKey } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { external?: { google?: boolean } } | null) => !!j?.external?.google)
    .catch(() => false);
  return dispo;
}

export function useGoogleDisponible(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let vivant = true;
    void googleDisponible().then((v) => vivant && setOk(v));
    return () => {
      vivant = false;
    };
  }, []);
  return ok;
}

export async function connexionGoogle(role: 'client' | 'pro', next: string): Promise<void> {
  const retour = new URL('/connexion/retour', env.siteUrl);
  retour.searchParams.set('next', next);
  retour.searchParams.set('portail', role);
  retour.searchParams.set('google', '1');
  const natif = isNative();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: retour.toString(), skipBrowserRedirect: natif, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
  if (natif && data?.url) await openExternal(data.url);
}
