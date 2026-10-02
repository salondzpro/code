/**
 * SUGGESTION DE LIEUX — une seule source pour TOUS les champs « ville ou adresse » du produit :
 * la place de marché, l'écran Localisation, et l'adresse du salon côté professionnel.
 *
 * Trois gisements, et l'ordre compte :
 *   1. les 58 WILAYAS, en mémoire ;
 *   2. les 1 536 COMMUNES d'Algérie (`communes.data.ts`, chargé à la demande) ;
 *   3. les ADRESSES fines (rue, commerce) par Photon, qui demande le réseau.
 *
 * POURQUOI LES DEUX PREMIERS SONT EMBARQUÉS. Le champ ne proposait que les quartiers où un salon
 * EXISTE DÉJÀ : sur une place de marché qui démarre, cela ne proposait rien du tout — on tapait
 * « Oran » et l'écran restait vide. Une liste embarquée répond dès la PREMIÈRE lettre, sans
 * réseau, donc toujours et instantanément. Photon ne sert plus qu'à ce qu'il sait faire de mieux :
 * une adresse précise, quand on en cherche une.
 *
 * ON CHERCHE SANS ACCENT ET DANS LES DEUX ÉCRITURES : « bejaia » trouve Béjaïa, « تيزي » trouve
 * Tizi Ouzou. Taper correctement les accents d'un nom algérien sur un clavier de téléphone n'est
 * pas une condition d'accès au produit.
 */
import { useEffect, useState } from 'react';
import { WILAYAS, geocodeDZ, wilayaName, type GeoPlace } from '@salondz/constants';

/** Un lieu proposé. `point` dit s'il peut servir de centre à un rayon. */
export type Lieu =
  | { kind: 'wilaya'; cle: string; label: string; detail: string; wilaya: number }
  | { kind: 'commune'; cle: string; label: string; detail: string; wilaya: number; lat: number; lng: number }
  | { kind: 'adresse'; cle: string; label: string; detail: string; lat: number; lng: number };

/**
 * Forme comparable d'un texte : sans accent, sans apostrophe, en minuscules. Les noms algériens
 * s'écrivent de dix façons (« Béjaïa », « Bejaia », « Bgayet ») et personne ne pose les accents en
 * tapant sur un téléphone.
 */
export const aplatir = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’`\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

interface Commune {
  nom: string;
  ar: string;
  wilaya: number;
  lat: number;
  lng: number;
  /** Forme aplatie, calculée une fois au chargement. */
  plat: string;
}

let table: Commune[] | null = null;
let chargement: Promise<Commune[]> | null = null;

/**
 * Charge la table des communes. Le module de données n'est JAMAIS importé statiquement : 56 ko
 * partiraient dans le bundle d'entrée de chaque visiteur, y compris ceux qui ne touchent jamais à
 * un champ de lieu.
 */
export function chargerCommunes(): Promise<Commune[]> {
  if (table) return Promise.resolve(table);
  chargement ??= import('./communes.data').then(({ COMMUNES_BRUT }) => {
    table = COMMUNES_BRUT.split('\n')
      .map((ligne) => {
        const [w, nom, ar, lat, lng] = ligne.split('|');
        return { nom: nom!, ar: ar ?? '', wilaya: Number(w), lat: Number(lat), lng: Number(lng), plat: aplatir(nom!) };
      })
      .filter((c) => c.nom && Number.isFinite(c.lat));
    return table;
  });
  return chargement;
}

/**
 * À appeler dès qu'un champ de lieu prend le focus, AVANT la première lettre : le temps que la
 * personne tape, la table est là, et la première suggestion ne se fait pas attendre.
 */
export const prechargerLieux = (): void => void chargerCommunes().catch(() => undefined);

/** 0 = exact, 1 = début, 2 = début d'un mot, 3 = contenu ; -1 = ne correspond pas. */
function rang(champ: string, q: string): number {
  if (!champ) return -1;
  if (champ === q) return 0;
  if (champ.startsWith(q)) return 1;
  if (champ.includes(` ${q}`)) return 2;
  return champ.includes(q) ? 3 : -1;
}

/**
 * Wilayas et communes correspondant à la saisie, les plus probables d'abord. Dès UNE lettre : un
 * champ qui attend trois caractères pour proposer quoi que ce soit ne se sent pas vivant.
 */
export async function chercherLieux(q: string, max = 7): Promise<Lieu[]> {
  const needle = aplatir(q);
  if (!needle) return [];
  const communes = await chargerCommunes().catch(() => [] as Commune[]);

  const trouves: { lieu: Lieu; rang: number; taille: number }[] = [];
  for (const w of WILAYAS) {
    const r = Math.min(...[rang(aplatir(w.name), needle), rang(w.nameAr, needle)].map((x) => (x < 0 ? 9 : x)));
    if (r > 3) continue;
    trouves.push({
      lieu: { kind: 'wilaya', cle: `w-${w.code}`, label: w.name, detail: `Wilaya ${String(w.code).padStart(2, '0')} · toute la wilaya`, wilaya: w.code },
      // Une wilaya passe juste derrière la commune de même rang : on cherche presque toujours une
      // ville, et la wilaya entière est le choix large qu'on prend par défaut, pas par hasard.
      rang: r * 2 + 1,
      taille: w.name.length,
    });
  }
  for (const c of communes) {
    const r = Math.min(...[rang(c.plat, needle), rang(c.ar, needle)].map((x) => (x < 0 ? 9 : x)));
    if (r > 3) continue;
    trouves.push({
      // Le chef-lieu porte le nom de sa wilaya : « Oran · Oran » n'apprend rien, et donne l'air
      // d'un doublon juste au-dessus de la ligne « Oran · toute la wilaya ».
      lieu: { kind: 'commune', cle: `c-${c.wilaya}-${c.nom}`, label: c.nom, detail: wilayaName(c.wilaya) === c.nom ? 'Commune' : wilayaName(c.wilaya), wilaya: c.wilaya, lat: c.lat, lng: c.lng },
      rang: r * 2,
      taille: c.nom.length,
    });
  }

  return trouves
    // À rang égal, le nom le plus court : qui tape « alger » veut Alger, pas « Alger-Centre ».
    .sort((a, b) => a.rang - b.rang || a.taille - b.taille || a.lieu.label.localeCompare(b.lieu.label, 'fr'))
    .slice(0, max)
    .map((x) => x.lieu);
}

/** Où en est la recherche d'adresses. Un écran qui dit « rien trouvé » en attendant ment. */
export type EtatGeocodage = 'repos' | 'cherche' | 'fini' | 'injoignable';

/**
 * Suggestions complètes d'un champ de lieu : wilayas et communes tout de suite, adresses fines
 * quand le réseau répond. Les deux listes sont rendues séparément pour que la première s'affiche
 * sans attendre la seconde.
 */
export function useLieux(q: string, { adresses = true }: { adresses?: boolean } = {}) {
  const [locaux, setLocaux] = useState<Lieu[]>([]);
  const [fines, setFines] = useState<Lieu[]>([]);
  const [geocodage, setGeocodage] = useState<EtatGeocodage>('repos');

  useEffect(() => {
    let vivant = true;
    if (!q.trim()) {
      setLocaux([]);
      return;
    }
    void chercherLieux(q).then((r) => vivant && setLocaux(r));
    return () => {
      vivant = false;
    };
  }, [q]);

  useEffect(() => {
    // Photon ne sait rien faire d'utile en dessous de trois lettres, et la table embarquée couvre
    // déjà ce cas : on ne gaspille pas la connexion.
    if (!adresses || q.trim().length < 3) {
      setFines([]);
      setGeocodage('repos');
      return;
    }
    const ctrl = new AbortController();
    setGeocodage('cherche');
    geocodeDZ(q, ctrl.signal)
      .then((r: GeoPlace[]) => {
        if (ctrl.signal.aborted) return;
        setFines(r.map((a) => ({ kind: 'adresse', cle: `a-${a.lat}-${a.lng}`, label: a.label, detail: a.detail, lat: a.lat, lng: a.lng })));
        setGeocodage('fini');
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setFines([]);
        setGeocodage('injoignable');
      });
    return () => ctrl.abort();
  }, [q, adresses]);

  /** Les adresses qui répètent une commune déjà proposée n'apportent rien. */
  const connus = new Set(locaux.map((l) => aplatir(l.label)));
  return { locaux, adresses: fines.filter((a) => !connus.has(aplatir(a.label))), geocodage };
}
