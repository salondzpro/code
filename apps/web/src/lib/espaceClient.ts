/**
 * UN PROFESSIONNEL PEUT AUSSI ÊTRE CLIENT (14 nov. 2026, demande du propriétaire). Entré par le
 * portail client avec son adresse pro, il choisit « Continuer comme client » : ce choix est retenu
 * sur l'appareil, POUR CE COMPTE (son identifiant), et `RequireClient` le laisse alors entrer dans
 * l'espace client au lieu de le renvoyer sur `/pro`. Rien ne change côté serveur : un compte pro
 * a toujours pu réserver. Repasser par l'espace pro ou par le portail pro n'efface pas le choix ;
 * « Mon espace pro » sur l'écran de choix, si.
 */
const KEY = 'salondz:pro-en-client';

export function proEnClient(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(KEY) === userId;
  } catch {
    return false;
  }
}

export function choisirEspace(userId: string, espace: 'client' | 'pro'): void {
  try {
    if (espace === 'client') localStorage.setItem(KEY, userId);
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : le choix vaut pour la page en cours seulement */
  }
}
