/**
 * Provenance de campagne (23 nov. 2026) : `?src=` / `utm_source=` (+ `c=` / `utm_campaign=`) retenus
 * 30 jours sur l'appareil (premier contact), puis envoyés UNE fois à l'inscription. Rien d'autre.
 */
const CLE = 'salondz:acq';
const DUREE = 30 * 86_400_000;

export function retenirProvenance(): void {
  try {
    const q = new URLSearchParams(location.search);
    const src = q.get('src') ?? q.get('utm_source');
    if (!src) return;
    const deja = JSON.parse(localStorage.getItem(CLE) ?? 'null') as { at?: number } | null;
    if (deja?.at && Date.now() - deja.at < DUREE) return;
    localStorage.setItem(CLE, JSON.stringify({ src: src.slice(0, 30), c: (q.get('c') ?? q.get('utm_campaign') ?? '').slice(0, 40), at: Date.now() }));
  } catch {
    /* navigation privée : pas de provenance */
  }
}

export function provenance(): { src: string; c?: string } | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? 'null') as { src?: string; c?: string; at?: number } | null;
    if (!v?.src || !v.at || Date.now() - v.at > DUREE) return undefined;
    return { src: v.src, ...(v.c ? { c: v.c } : {}) };
  } catch {
    return undefined;
  }
}
