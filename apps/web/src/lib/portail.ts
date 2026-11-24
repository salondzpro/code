/**
 * QUEL PORTAIL ? UNE SEULE RÈGLE (24 nov. 2026, demande du propriétaire).
 *
 * L'espace professionnel se reconnaissait à `startsWith('/pro')`, recopié à huit endroits — qui
 * attrapait aussi `/profil/creer` et `/professionnels`. Conséquence vue sur iPhone : une connexion
 * Google lancée depuis l'application CLIENTE (destination `/profil/creer`) rouvrait l'application
 * PRO. Désormais : `/pro` ou `/pro/…`, et rien d'autre. Sans dépendance : importé par la passation,
 * qui s'exécute avant le reste du site.
 */
export type Portail = 'client' | 'pro';

/** Le chemin (requête et fragment ignorés) est-il dans l'espace professionnel ? */
export function estCheminPro(chemin: string): boolean {
  const p = chemin.split(/[?#]/)[0] ?? '';
  return p === '/pro' || p.startsWith('/pro/');
}

/**
 * Portail d'une destination complète, dans l'ordre de confiance :
 *   1. `app=client|pro` — posé par l'APPLICATION qui a lancé la connexion (elle sait qui elle est) ;
 *   2. `portail=client|pro` — posé par l'écran d'accès emprunté ;
 *   3. le chemin lui-même, puis `next`.
 */
export function portailDe(destination: string): Portail {
  const avant = destination.split('#')[0] ?? '';
  const q = new URLSearchParams(avant.split('?')[1] ?? '');
  for (const cle of ['app', 'portail']) {
    const v = q.get(cle);
    if (v === 'pro' || v === 'client') return v;
  }
  if (estCheminPro(avant)) return 'pro';
  const next = q.get('next');
  return next && estCheminPro(next) ? 'pro' : 'client';
}
