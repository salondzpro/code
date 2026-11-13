/**
 * Visite de la page publique d'un salon (1er nov. 2026) : alimente la carte « Votre page » de
 * l'accueil pro. Un compteur ANONYME (salon, jour, provenance) — aucune donnée personnelle ne part.
 *
 * Une fois par session et par salon (un rechargement ne recompte pas). Jamais bloquant : une
 * erreur réseau est ignorée.
 *
 * Provenance : `?src=qr` (codes QR de SalonDZ), Instagram et Snapchat (`?src=`, `utm_source=`, page
 * ouverte dans leur application ou depuis leur site), sinon « lien ». Le réseau, jamais la personne :
 * ils ne transmettent ni son nom ni son profil, et un site ne peut pas lire l'historique du navigateur.
 *
 * La provenance est retenue 24 h sur l'appareil pour la réservation qui suit : `bookingOrigin`.
 */
import type { BookingOrigin, PageViewSource } from '@salondz/types';
import { t } from '@/i18n';

const ORIGIN_MS = 24 * 3600 * 1000;
const originKey = (salonId: string) => `salondz:origine:${salonId}`;

/**
 * PLACE DE MARCHÉ (13 nov. 2026) : une page de salon ouverte APRÈS avoir navigué dans Salon DZ
 * (accueil de la place de marché, carte, favoris, mes rendez-vous…) est une visite APPORTÉE PAR SALON
 * DZ. Ouverte directement (lien partagé, story, QR), elle garde sa provenance. Noté par `ScrollToTop`
 * à chaque page ; en mémoire de l'onglet seulement.
 */
const PAGES_SALONDZ = /^\/(?:$|carte|favoris|rendez-vous|profil|notifications|localisation|marche)(?:\/|$)/;
let parSalonDz = false;
export function noterPage(pathname: string) {
  if (PAGES_SALONDZ.test(pathname)) parSalonDz = true;
}

export function pageViewSource(): PageViewSource {
  try {
    const q = new URLSearchParams(location.search);
    const src = (q.get('src') ?? q.get('utm_source') ?? '').toLowerCase();
    if (src === 'qr') return 'qr';
    if (src === 'ig' || src.includes('instagram')) return 'instagram';
    if (src === 'snap' || src.includes('snapchat')) return 'snapchat';
    if (/instagram/i.test(navigator.userAgent) || /instagram\.com/i.test(document.referrer)) return 'instagram';
    if (/snapchat/i.test(navigator.userAgent) || /snapchat\.com/i.test(document.referrer)) return 'snapchat';
    if (parSalonDz) return 'marketplace';
  } catch {
    /* lecture impossible : provenance par défaut */
  }
  return 'link';
}

/** Une visite par un réseau reste la provenance, même si la personne revient ensuite par un lien nu. */
function rememberOrigin(salonId: string, source: PageViewSource) {
  try {
    if (source === 'other') return;
    if (source === 'link' && bookingOrigin(salonId)) return;
    localStorage.setItem(originKey(salonId), JSON.stringify({ source, at: Date.now() }));
  } catch {
    /* navigation privée : pas de provenance pour cette réservation */
  }
}

export function bookingOrigin(salonId: string): BookingOrigin | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(originKey(salonId)) ?? 'null') as { source: BookingOrigin; at: number } | null;
    return saved && Date.now() - saved.at < ORIGIN_MS ? saved.source : undefined;
  } catch {
    return undefined;
  }
}

/** La ligne à montrer sur un rendez-vous. Un simple lien ne dit rien d'utile : pas de ligne. */
export function originLabel(origin: BookingOrigin | null | undefined): string | null {
  if (origin === 'instagram') return t('Réservé depuis Instagram');
  if (origin === 'snapchat') return t('Réservé depuis Snapchat');
  if (origin === 'qr') return t('Réservé avec le code QR');
  if (origin === 'marketplace') return t('Trouvé sur Salon DZ');
  return null;
}

export function recordPageView(salonId: string, send: (source: PageViewSource) => Promise<unknown>) {
  rememberOrigin(salonId, pageViewSource());
  const key = `salondz:vu:${salonId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* stockage indisponible (navigation privée) : on compte quand même, une fois par affichage */
  }
  void send(pageViewSource()).catch(() => undefined);
}
