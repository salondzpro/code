/**
 * PROVENANCE DES INSCRIPTIONS (23 nov. 2026, lancement marketing) : un lien de campagne
 * (`salondz.com/salons?src=tiktok&c=bf-pros`) est retenu sur l'appareil, puis compté quand la
 * personne s'INSCRIT — on sait quel réseau et quelle campagne amènent des comptes, sans rien
 * savoir de la personne. Compteurs dans `app_settings` (`acq_stats`), lus dans `/admin/marketing`.
 */
export const ACQ_SOURCES = ['instagram', 'tiktok', 'snapchat', 'facebook', 'whatsapp', 'youtube', 'qr', 'flyer', 'autre'] as const;
export type AcqSource = (typeof ACQ_SOURCES)[number];

/** Normalise une valeur de `?src=` / `utm_source=` ; `null` si vide. */
export function normaliserSource(v: string | null | undefined): AcqSource | null {
  const s = (v ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'ig' || s.includes('instagram')) return 'instagram';
  if (s === 'tt' || s.includes('tiktok')) return 'tiktok';
  if (s === 'snap' || s.includes('snapchat')) return 'snapchat';
  if (s === 'fb' || s.includes('facebook') || s === 'meta') return 'facebook';
  if (s === 'wa' || s.includes('whatsapp')) return 'whatsapp';
  if (s === 'yt' || s.includes('youtube')) return 'youtube';
  if (s === 'qr') return 'qr';
  if (s.includes('flyer') || s.includes('affiche')) return 'flyer';
  return 'autre';
}
