/**
 * CONNEXION EN COURS HORS DE L'APPLICATION (24 nov. 2026).
 *
 * Pendant une connexion Google ou Apple, la page du fournisseur s'ouvre hors de l'application puis
 * rend la session par un lien (`salondz://reprise?d=…`). Si la mise à jour automatique
 * (`lib/liveUpdate.ts`) rechargeait l'application à ce moment-là — passage en arrière-plan sur
 * Android, retour au premier plan, minute de calme —, la session en transit était perdue et
 * l'application retombait sur son écran d'ouverture. Ce repère suspend les rechargements le temps
 * de la connexion (10 min au plus). Gardé dans le stockage local : il survit à un rechargement.
 */
const CLE = 'salondz:connexion-externe';
const DUREE_MS = 10 * 60_000;

export function debutConnexionExterne(): void {
  try {
    localStorage.setItem(CLE, String(Date.now()));
  } catch {
    /* stockage indisponible */
  }
}

export function finConnexionExterne(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible */
  }
}

export function connexionExterneEnCours(): boolean {
  try {
    const t = Number(localStorage.getItem(CLE));
    return Boolean(t) && Date.now() - t < DUREE_MS;
  } catch {
    return false;
  }
}
