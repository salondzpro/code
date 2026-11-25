/**
 * RECHERCHE INTELLIGENTE CÔTÉ APPAREIL (25 nov. 2026, demande du propriétaire : « style Uber »).
 *
 * Deux choses que le serveur ne peut pas faire seul :
 *   1. Les RECHERCHES RÉCENTES de la personne (gardées sur l'appareil, jamais envoyées).
 *   2. Comprendre un LIEU écrit dans la saisie : « coupe akbou », « barbier à oran », « ongles
 *      hydra » règlent le lieu (commune ou wilaya) et ne gardent que le « quoi » comme recherche.
 *      Le reste du classement (fautes, synonymes, proximité, note, disponibilité) vit dans la base
 *      (`search_salons_v2`, migration 0063).
 */
import { aplatir, chercherLieux, type Lieu } from './places';

const CLE = 'salondz:recherches';
const MAX = 6;

export function recherchesRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function retenirRecherche(q: string): void {
  const v = q.trim();
  if (v.length < 2) return;
  const autres = recherchesRecentes().filter((x) => aplatir(x) !== aplatir(v));
  try {
    localStorage.setItem(CLE, JSON.stringify([v, ...autres].slice(0, MAX)));
  } catch {
    /* stockage indisponible */
  }
}

export function oublierRecherches(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible */
  }
}

/** Mots qui relient un lieu au reste (« à Akbou », « sur Oran », « في وهران »). */
const LIENS = new Set(['a', 'au', 'aux', 'sur', 'vers', 'pres', 'de', 'du', 'in', 'near', 'في', 'ب']);

/**
 * Cherche un lieu EXACT (commune ou wilaya) au début ou à la fin de la saisie — jusqu'à trois mots
 * (« Tizi Ouzou », « Bordj Bou Arreridj »). Rend le lieu et la saisie sans lui. Un nom seulement
 * PROCHE d'un lieu ne compte pas : « coupe » ne doit jamais devenir une commune.
 */
export async function extraireLieu(q: string): Promise<{ lieu: Lieu | null; reste: string }> {
  const mots = q.trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return { lieu: null, reste: q };
  const essais: { debut: number; fin: number }[] = [];
  for (let n = Math.min(3, mots.length); n >= 1; n--) {
    essais.push({ debut: mots.length - n, fin: mots.length });
    essais.push({ debut: 0, fin: n });
  }
  for (const { debut, fin } of essais) {
    const candidat = aplatir(mots.slice(debut, fin).join(' '));
    if (candidat.length < 3) continue;
    const trouves = await chercherLieux(candidat, 4);
    const lieu = trouves.find((l) => l.kind !== 'adresse' && aplatir(l.label) === candidat);
    if (!lieu) continue;
    const avant = mots.slice(0, debut);
    // Le petit mot qui reliait le lieu en fin de saisie (« barbier à Oran ») part avec lui.
    if (debut > 0 && avant.length && LIENS.has(aplatir(avant[avant.length - 1]!))) avant.pop();
    return { lieu, reste: [...avant, ...mots.slice(fin)].join(' ') };
  }
  return { lieu: null, reste: q };
}

/** Découpe un libellé pour mettre en gras la partie qui correspond à la saisie (sans accent). */
export function decouper(texte: string, q: string): { avant: string; gras: string; apres: string } | null {
  const n = aplatir(q);
  if (n.length < 1) return null;
  // `aplatir` garde la longueur caractère par caractère sauf ponctuation : on compare lettre à lettre.
  const plat = texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const i = plat.indexOf(n);
  if (i < 0) return null;
  return { avant: texte.slice(0, i), gras: texte.slice(i, i + n.length), apres: texte.slice(i + n.length) };
}
