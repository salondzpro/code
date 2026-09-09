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
