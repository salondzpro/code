/**
 * ITINÉRAIRE VERS UN SALON — UNE seule source (16 nov. 2026, demande du propriétaire : « ouvrir la
 * carte, Google Maps, Waze ou autre selon le téléphone, laisser la personne choisir »).
 *
 *   - Android : adresse `geo:` — le système propose les applications de cartes installées (Google
 *     Maps, Waze…) ou ouvre celle que la personne a choisie par défaut ;
 *   - iPhone / iPad : `maps.apple.com`, que iOS remet à l'application de cartes par défaut ;
 *   - ordinateur : Google Maps dans le navigateur.
 * Les coordonnées priment quand on les a (un point exact), sinon le nom et l'adresse.
 */
export interface LieuSalon {
  name: string;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export function itineraireUrl(s: LieuSalon, ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  const texte = [s.name, s.address, s.city].filter(Boolean).join(', ');
  const point = s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : null;
  if (/android/i.test(ua)) {
    return point ? `geo:${point}?q=${point}(${encodeURIComponent(s.name)})` : `geo:0,0?q=${encodeURIComponent(texte)}`;
  }
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && 'ontouchend' in (globalThis.document ?? {}))) {
    return point
      ? `https://maps.apple.com/?daddr=${point}&q=${encodeURIComponent(s.name)}`
      : `https://maps.apple.com/?daddr=${encodeURIComponent(texte)}`;
  }
  return point
    ? `https://www.google.com/maps/dir/?api=1&destination=${point}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texte)}`;
}

/** `target` du lien : un nouvel onglet seulement pour la carte web ; `geo:` et Plans s'ouvrent dans l'application du téléphone. */
export const cibleCarte = (url: string): '_blank' | undefined => (url.startsWith('https://www.google.com') ? '_blank' : undefined);
