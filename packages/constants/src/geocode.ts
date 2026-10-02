/**
 * Géocodage d'adresses (« Quartier, ville ou adresse ») via Photon (OpenStreetMap, komoot) :
 * gratuit, sans clé, autorise l'autocomplétion. Limité à l'Algérie.
 *
 * SUR LE RÉSEAU ALGÉRIEN, UN SERVICE TIERS SANS DÉLAI D'ATTENTE NE RÉPOND JAMAIS « NON » : la requête
 * reste en l'air, et l'écran affiche « Aucun lieu trouvé » pour un problème de réseau. D'où, ici :
 * un délai maximal, une seule reprise, et une ERREUR levée quand le service est injoignable — pour
 * que l'appelant distingue « rien ne correspond » de « on n'a pas pu demander ». Une liste vide veut
 * dire vide, rien d'autre.
 */
export interface GeoPlace {
  label: string;
  detail: string;
  lat: number;
  lng: number;
}

/** Au-delà, la suggestion n'a plus d'intérêt : la personne a fini de taper depuis longtemps. */
const DELAI_MS = 5_000;
/** Une seule reprise, après un souffle. Deux coups suffisent à passer un trou de réseau. */
const REPRISES = [0, 400];

/**
 * `fetch` avec délai maximal, qui respecte AUSSI l'annulation de l'appelant (frappe suivante,
 * écran quitté). `AbortSignal.any` n'existe pas sur toutes les WebView Android encore en service :
 * on compose les deux signaux à la main.
 */
async function fetchCourt(url: string, signal?: AbortSignal): Promise<Response> {
  const ctrl = new AbortController();
  const stop = () => ctrl.abort();
  const minuteur = setTimeout(stop, DELAI_MS);
  signal?.addEventListener('abort', stop);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(minuteur);
    signal?.removeEventListener('abort', stop);
  }
}

const dort = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Position → libellé lisible (« Hydra, Alger » ; hors Algérie « Roubaix, France »), ou null si inconnu. */
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<{ label: string; inDZ: boolean; /** Wilaya / région administrative, quand le service la connaît. */ region: string | null } | null> {
  try {
    const res = await fetchCourt(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=fr`, signal);
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: { properties: Record<string, string | undefined> }[] };
    const p = json.features?.[0]?.properties;
    if (!p) return null;
    const inDZ = p.countrycode === 'DZ';
    const local = p.district ?? p.locality ?? p.name;
    const city = p.city ?? p.county ?? p.state;
    const parts = inDZ ? [local, city] : [city ?? local, p.country];
    const label = parts.filter((x, i, a): x is string => !!x && a.indexOf(x) === i).join(', ');
    const region = p.state ?? p.county ?? p.city ?? null;
    return label ? { label, inDZ, region } : null;
  } catch {
    return null;
  }
}

/**
 * Points superposés (même adresse, ou coordonnées identiques) : on les écarte en éventail d'environ 35 m
 * pour que chaque bulle reste visible et touchable sur la carte. Les coordonnées d'origine ne sont pas modifiées.
 */
export function spreadOverlaps<T extends { lat: number; lng: number }>(points: T[]): (T & { drawLat: number; drawLng: number })[] {
  const groups = new Map<string, number[]>();
  points.forEach((p, i) => {
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const out = points.map((p) => ({ ...p, drawLat: p.lat, drawLng: p.lng }));
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    const r = 0.00032; // ≈ 35 m
    idx.forEach((i, k) => {
      const a = (2 * Math.PI * k) / idx.length - Math.PI / 2;
      out[i]!.drawLat = points[i]!.lat + r * Math.sin(a);
      out[i]!.drawLng = points[i]!.lng + (r * Math.cos(a)) / Math.cos((points[i]!.lat * Math.PI) / 180);
    });
  }
  return out;
}

/** Emprise de l'Algérie (lng min, lat min, lng max, lat max). */
const DZ_BBOX = '-8.7,18.9,12.0,37.2';

type PhotonReponse = { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[] };

function lirePhoton(json: PhotonReponse): GeoPlace[] {
  const seen = new Set<string>();
  const out: GeoPlace[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties;
    if (p.countrycode && p.countrycode !== 'DZ') continue;
    const name = p.name ?? [p.street, p.housenumber].filter(Boolean).join(' ');
    if (!name) continue;
    const detail = [p.district, p.city ?? p.county, p.state].filter((x): x is string => !!x && x !== name).join(', ');
    const key = `${name}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: name, detail, lat: Number(f.geometry.coordinates[1].toFixed(5)), lng: Number(f.geometry.coordinates[0].toFixed(5)) });
  }
  return out;
}

/**
 * Mémoire de la session : en tapant « Akbou » on interroge « Akb », « Akbo », « Akbou », et effacer
 * une lettre redemande ce qu'on vient d'obtenir. Sur une connexion lente, resservir est la
 * différence entre une liste instantanée et une liste qui clignote.
 */
const cache = new Map<string, GeoPlace[]>();
const CACHE_MAX = 60;

/** Signale que le service de géocodage n'a pas pu être interrogé — à ne pas confondre avec « aucun résultat ». */
export class GeocodeIndisponible extends Error {
  constructor(cause?: unknown) {
    super('Service d’adresses injoignable');
    this.name = 'GeocodeIndisponible';
    this.cause = cause;
  }
}

/**
 * Adresses algériennes correspondant à la saisie. Rend une liste (éventuellement vide) ou lève
 * `GeocodeIndisponible` : une liste vide signifie « rien ne correspond », jamais « ça n'a pas
 * marché ». Une annulation (frappe suivante) rend une liste vide sans bruit.
 */
export async function geocodeDZ(q: string, signal?: AbortSignal): Promise<GeoPlace[]> {
  const needle = q.trim();
  if (needle.length < 3) return [];
  const cle = needle.toLowerCase();
  const connu = cache.get(cle);
  if (connu) return connu;

  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(needle)}&limit=6&lang=fr&bbox=${DZ_BBOX}`;
  let dernier: unknown = null;
  for (const attente of REPRISES) {
    if (signal?.aborted) return [];
    if (attente) await dort(attente);
    if (signal?.aborted) return [];
    try {
      const res = await fetchCourt(url, signal);
      if (res.ok) {
        const places = lirePhoton((await res.json()) as PhotonReponse);
        if (cache.size >= CACHE_MAX) cache.clear();
        cache.set(cle, places);
        return places;
      }
      // 4xx : la requête elle-même ne convient pas, la rejouer donnerait le même refus.
      if (res.status < 500) return [];
      dernier = new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (signal?.aborted) return [];
      dernier = err;
    }
  }
  throw new GeocodeIndisponible(dernier);
}
