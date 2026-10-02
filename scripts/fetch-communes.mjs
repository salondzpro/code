/**
 * Fabrique la liste des COMMUNES d'Algérie, depuis OpenStreetMap (Overpass).
 *
 *   node scripts/fetch-communes.mjs
 *
 * Écrit `apps/web/src/lib/communes.data.ts` — un fichier GÉNÉRÉ, versionné, à ne pas modifier à la
 * main : le relancer le reconstruit.
 *
 * POURQUOI UNE LISTE EMBARQUÉE PLUTÔT QU'UN SERVICE. Le champ « ville » doit proposer quelque chose
 * dès la première lettre, sur une connexion algérienne, et la place de marché est encore presque
 * vide — suggérer uniquement les quartiers où un salon existe déjà ne proposait rien du tout. 1 537
 * communes tiennent en ~70 ko de texte, chargés à la demande : la réponse est instantanée et ne
 * dépend d'aucun tiers. Photon reste branché par-dessus pour les adresses fines (une rue, un
 * commerce), là où un service a un sens.
 *
 * LA WILAYA NE SE LIT PAS DANS LE CODE ONS. Le code de l'Office national des statistiques date
 * d'avant la réforme de 2019 : In Salah porte encore `1108`, c'est-à-dire Tamanrasset, alors
 * qu'elle est wilaya 53 depuis. On prend donc le préfixe ONS comme base, puis on télécharge le
 * CONTOUR des dix wilayas créées en 2019 et l'on reclasse par appartenance géométrique — soixante
 * communes changent ainsi de tutelle. L'appariement se fait sur le code officiel porté par OSM,
 * jamais sur le nom : OSM écrit « Timimoune » là où la nomenclature écrit « Timimoun ».
 *
 * Source : OpenStreetMap, licence ODbL — l'attribution est déjà portée par les fonds de carte.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WILAYAS } from '../packages/constants/src/wilayas.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(ROOT, 'apps', 'web', 'src', 'lib', 'communes.data.ts');
const OVERPASS = 'https://overpass-api.de/api/interpreter';
/** Overpass renvoie 406 sans agent identifiable. */
const AGENT = 'SalonDZ/1.0 (contact@salondz.com)';
/** Les wilayas créées en 2019 : leurs communes portent encore le code ONS de l'ancienne tutelle. */
const NOUVELLES = WILAYAS.filter((w) => w.code >= 49);

const dort = (ms) => new Promise((r) => setTimeout(r, ms));
/** Overpass public est partagé et renvoie volontiers 429 / 504 : on insiste, poliment et longtemps. */
const CACHE = path.join(ROOT, 'node_modules', '.overpass');

async function overpass(nomCache, requete) {
  const fichier = path.join(CACHE, `${nomCache}.json`);
  if (fs.existsSync(fichier)) {
    console.log(`  (${nomCache} déjà téléchargé)`);
    return JSON.parse(fs.readFileSync(fichier, 'utf8'));
  }
  for (let essai = 1; essai <= 8; essai++) {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      headers: { 'User-Agent': AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: requete }),
    }).catch((err) => ({ ok: false, status: String(err) }));
    if (res.ok) {
      const json = await res.json();
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(fichier, JSON.stringify(json), 'utf8');
      return json;
    }
    const attente = Math.min(90, essai * 15);
    console.log(`  Overpass ${res.status}, nouvelle tentative dans ${attente} s (${essai}/8)`);
    await dort(attente * 1000);
  }
  throw new Error(`Overpass ne répond pas (${nomCache})`);
}

/**
 * Point dans un polygone, par lancer de rayon. On ne reconstitue PAS les anneaux de la relation :
 * la parité des croisements se compte sur l'ensemble des segments de la frontière, dans n'importe
 * quel ordre — ce qui évite de recoller à la main les dizaines de tronçons d'une wilaya saharienne.
 */
function dansSegments(lat, lng, segments) {
  let dedans = false;
  for (const [aLat, aLng, bLat, bLng] of segments) {
    if (aLat > lat !== bLat > lat) {
      const x = ((bLng - aLng) * (lat - aLat)) / (bLat - aLat) + aLng;
      if (lng < x) dedans = !dedans;
    }
  }
  return dedans;
}

const nom = (tags) => tags['name:fr'] ?? tags.name ?? null;

// ---------------------------------------------------------------------------------------------
// 1. Toutes les communes du pays
// ---------------------------------------------------------------------------------------------
console.log('Communes du pays…');
const brut = await overpass('communes', `[out:json][timeout:240];
area["ISO3166-1"="DZ"][admin_level=2]->.dz;
rel(area.dz)["boundary"="administrative"]["admin_level"="8"];
out center tags;`);

const communes = new Map();
for (const e of brut.elements ?? []) {
  const t = e.tags ?? {};
  const n = nom(t);
  if (!n || !e.center) continue;
  const ons = String(t['ref:ONS'] ?? t.ref ?? '').padStart(4, '0');
  const wilaya = Number(ons.slice(0, 2));
  // Clé = code ONS, et non le nom : trente-cinq noms de communes existent en double dans le pays
  // (Sidi M'Hamed, El Marsa, Aïn Benian…). Les regrouper par nom en effaçait trente-huit.
  communes.set(ons === '0000' ? n.toLowerCase() : ons, {
    nom: n,
    ar: t['name:ar'] ?? '',
    wilaya: Number.isFinite(wilaya) && wilaya >= 1 && wilaya <= 58 ? wilaya : 0,
    lat: Number(e.center.lat.toFixed(4)),
    lng: Number(e.center.lon.toFixed(4)),
  });
}
console.log(`  ${communes.size} communes`);

// ---------------------------------------------------------------------------------------------
// 2. Correction des dix wilayas de 2019
// ---------------------------------------------------------------------------------------------
// Une SEULE requête : les contours des dix wilayas. Dix requêtes « quelles communes contient
// cette wilaya » se faisaient refuser l'une après l'autre par le serveur public.
console.log('Contours des wilayas de 2019…');
const contours = await overpass(
  'nouvelles-wilayas',
  `[out:json][timeout:240];
area["ISO3166-1"="DZ"][admin_level=2]->.dz;
rel(area.dz)["admin_level"="4"]["boundary"="administrative"]["ref"~"^(49|50|51|52|53|54|55|56|57|58)$"];
out geom;`,
);

const polygones = [];
for (const e of contours.elements ?? []) {
  // Appariement par le CODE officiel porté par OSM, jamais par le nom : OSM écrit « Timimoune »
  // là où la nomenclature écrit « Timimoun », et la correspondance tombait à côté en silence.
  const w = NOUVELLES.find((x) => x.code === Number(e.tags?.ref));
  if (!w) continue;
  const segments = [];
  for (const m of e.members ?? []) {
    const g = m.geometry;
    if (!g) continue;
    for (let i = 1; i < g.length; i++) segments.push([g[i - 1].lat, g[i - 1].lon, g[i].lat, g[i].lon]);
  }
  if (segments.length) polygones.push({ code: w.code, nom: w.name, segments });
}
console.log(`  ${polygones.length}/${NOUVELLES.length} contours trouvés`);

let corrigees = 0;
for (const c of communes.values()) {
  const p = polygones.find((x) => dansSegments(c.lat, c.lng, x.segments));
  if (p && c.wilaya !== p.code) {
    c.wilaya = p.code;
    corrigees++;
  }
}
console.log(`  ${corrigees} rattachements corrigés`);

// ---------------------------------------------------------------------------------------------
// 3. Écriture
// ---------------------------------------------------------------------------------------------
const orphelines = [...communes.values()].filter((c) => !c.wilaya);
if (orphelines.length) console.log(`  ${orphelines.length} sans wilaya : ${orphelines.map((c) => c.nom).join(', ')}`);

const lignes = [...communes.values()]
  .filter((c) => c.wilaya)
  .sort((a, b) => a.wilaya - b.wilaya || a.nom.localeCompare(b.nom, 'fr'))
  // Une ligne par commune, quatre champs : la table tient en deux fois moins de place qu'un
  // tableau d'objets JavaScript, et se découpe en une passe au premier usage.
  .map((c) => `${c.wilaya}|${c.nom}|${c.ar}|${c.lat}|${c.lng}`);

const fichier = `/**
 * COMMUNES D'ALGÉRIE — FICHIER GÉNÉRÉ, NE PAS MODIFIER À LA MAIN.
 * Reconstruit par \`node scripts/fetch-communes.mjs\` depuis OpenStreetMap (ODbL).
 * ${lignes.length} communes · ${new Date().toISOString().slice(0, 10)}
 *
 * Une ligne par commune : wilaya|nom|nom arabe|latitude|longitude. Ce module n'est JAMAIS importé
 * statiquement — \`lib/places.ts\` le charge à la demande, pour qu'il ne parte pas dans le bundle
 * d'entrée de chaque visiteur.
 */
export const COMMUNES_BRUT = \`${lignes.join('\n')}\`;
`;

fs.writeFileSync(SORTIE, fichier, 'utf8');
console.log(`✔ ${lignes.length} communes → ${path.relative(ROOT, SORTIE)} (${Math.round(fichier.length / 1024)} ko)`);
