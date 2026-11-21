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
 * Un compte créé par Google naît client ; par le portail pro, `WelcomeBack` le déclare pro tant
 * qu'il est neuf (`POST /v1/auth/google-pro`).
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { env } from './env';
import { isNative } from './native';
import { openExternal } from './openExternal';

/** Fournisseurs de connexion proposés (21 nov. 2026 : Google, puis Apple). */
export type Fournisseur = 'google' | 'apple';

let reglages: Promise<Record<string, boolean>> | null = null;

/** Fournisseurs ACTIVÉS sur le projet Supabase (une seule lecture par lancement). */
function fournisseursActifs(): Promise<Record<string, boolean>> {
  reglages ??= fetch(`${env.supabaseUrl}/auth/v1/settings`, { headers: { apikey: env.supabasePublishableKey } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { external?: Record<string, boolean> } | null) => j?.external ?? {})
    .catch(() => ({}));
  return reglages;
}

/** Ceux des fournisseurs demandés qui sont activés, dans l'ordre demandé. */
export function useFournisseurs(liste: Fournisseur[]): Fournisseur[] {
  const [ok, setOk] = useState<Fournisseur[]>([]);
  useEffect(() => {
    let vivant = true;
    void fournisseursActifs().then((ext) => vivant && setOk(liste.filter((f) => ext[f])));
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ok;
}

export async function connexionOAuth(fournisseur: Fournisseur, role: 'client' | 'pro', next: string): Promise<void> {
  const retour = new URL('/connexion/retour', env.siteUrl);
  retour.searchParams.set('next', next);
  retour.searchParams.set('portail', role);
  retour.searchParams.set('oauth', '1');
  const natif = isNative();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: fournisseur,
    options: {
      redirectTo: retour.toString(),
      skipBrowserRedirect: natif,
      ...(fournisseur === 'google' ? { queryParams: { prompt: 'select_account' } } : { scopes: 'name email' }),
    },
  });
  if (error) throw error;
  if (natif && data?.url) await openExternal(data.url);
}
