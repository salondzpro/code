/**
 * Géocodage d'adresses (« Quartier, ville ou adresse ») via Photon (OpenStreetMap, komoot) :
 * gratuit, sans clé, autorise l'autocomplétion. Limité à l'Algérie.
 */
export interface GeoPlace {
  label: string;
  detail: string;
  lat: number;
  lng: number;
}

/** Position → libellé lisible (« Hydra, Alger » ; hors Algérie « Roubaix, France »), ou null si inconnu. */
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<{ label: string; inDZ: boolean } | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=fr`, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: { properties: Record<string, string | undefined> }[] };
    const p = json.features?.[0]?.properties;
    if (!p) return null;
    const inDZ = p.countrycode === 'DZ';
    const local = p.district ?? p.locality ?? p.name;
    const city = p.city ?? p.county ?? p.state;
    const parts = inDZ ? [local, city] : [city ?? local, p.country];
    const label = parts.filter((x, i, a): x is string => !!x && a.indexOf(x) === i).join(', ');
    return label ? { label, inDZ } : null;
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

export async function geocodeDZ(q: string, signal?: AbortSignal): Promise<GeoPlace[]> {
  const needle = q.trim();
  if (needle.length < 3) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(needle)}&limit=6&lang=fr&bbox=${DZ_BBOX}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[] };
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
