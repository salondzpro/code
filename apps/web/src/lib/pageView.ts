/**
 * Visite de la page publique d'un salon (1er nov. 2026) : alimente la carte « Votre page » de
 * l'accueil pro. Un compteur ANONYME (salon, jour, provenance) — aucune donnée personnelle ne part.
 *
 * Une fois par session et par salon (un rechargement ne recompte pas). Jamais bloquant : une
 * erreur réseau est ignorée.
 *
 * Provenance : `?src=qr` (codes QR de SalonDZ), Instagram (`?src=ig`, `utm_source=instagram`, page
 * ouverte depuis l'application Instagram ou un lien instagram.com), sinon « lien ».
 */
import type { PageViewSource } from '@salondz/types';

export function pageViewSource(): PageViewSource {
  try {
    const q = new URLSearchParams(location.search);
    const src = (q.get('src') ?? q.get('utm_source') ?? '').toLowerCase();
    if (src === 'qr') return 'qr';
    if (src === 'ig' || src.includes('instagram')) return 'instagram';
    if (/instagram/i.test(navigator.userAgent) || /instagram\.com/i.test(document.referrer)) return 'instagram';
  } catch {
    /* lecture impossible : provenance par défaut */
  }
  return 'link';
}

export function recordPageView(salonId: string, send: (source: PageViewSource) => Promise<unknown>) {
  const key = `salondz:vu:${salonId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* stockage indisponible (navigation privée) : on compte quand même, une fois par affichage */
  }
  void send(pageViewSource()).catch(() => undefined);
}
