/**
 * Visages « Femme » / « Homme » de l'inscription (16 nov. 2026, demande du propriétaire : des
 * visages avec cheveux, en couleur, pour comprendre d'un coup d'œil — plus les symboles ♀ ♂).
 * Dessinés ici, en aplats (jamais de dégradé), 64 × 64, posés dans un rond de couleur pâle qui
 * les recadre (`.pa-genre-i`, `overflow: hidden`).
 */
const PEAU = '#f3c9a6';
const PEAU_OMBRE = '#e6b08a';
const CHEVEUX = '#4a2c22';
const TRAITS = '#3a2a24';

export function VisageFemme({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      {/* Cheveux longs, derrière les épaules */}
      <path d="M15 31c0-12 7.5-19 17-19s17 7 17 19v17c0 3-2 5-5 5H20c-3 0-5-2-5-5V31z" fill={CHEVEUX} />
      {/* Haut rose */}
      <path d="M11 64c0-9.5 9.4-15.5 21-15.5S53 54.5 53 64z" fill="#e0457f" />
      <rect x="28" y="38" width="8" height="12" rx="3" fill={PEAU_OMBRE} />
      <ellipse cx="32" cy="30.5" rx="10" ry="12" fill={PEAU} />
      {/* Frange balayée */}
      <path d="M21.5 29c1.5-8.5 6.5-13 12.5-13 5.6 0 9.6 3.6 9 10-5-1-10.5-3.4-13.5-7.5-1.8 5-4.4 8.4-8 10.5z" fill={CHEVEUX} />
      <circle cx="28" cy="31.5" r="1.4" fill={TRAITS} />
      <circle cx="36" cy="31.5" r="1.4" fill={TRAITS} />
      <path d="M29 36.5q3 2.6 6 0" stroke="#c2604f" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* Boucles d'oreilles */}
      <circle cx="21.6" cy="36" r="1.6" fill="#f5b700" />
      <circle cx="42.4" cy="36" r="1.6" fill="#f5b700" />
    </svg>
  );
}

export function VisageHomme({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      {/* Haut bleu */}
      <path d="M11 64c0-9.5 9.4-15.5 21-15.5S53 54.5 53 64z" fill="#007aff" />
      <rect x="28" y="38" width="8" height="12" rx="3" fill={PEAU_OMBRE} />
      <ellipse cx="21.6" cy="31.5" rx="2.2" ry="3.2" fill={PEAU_OMBRE} />
      <ellipse cx="42.4" cy="31.5" rx="2.2" ry="3.2" fill={PEAU_OMBRE} />
      <ellipse cx="32" cy="30.5" rx="10" ry="12" fill={PEAU} />
      {/* Cheveux courts, dégradé de barbier sur les côtés */}
      <path d="M21.6 28.5c-1.4-9.6 4-15.5 10.6-15.5 7.6 0 11.8 5.4 10.2 15.5-1.6-4.6-4.8-7-10.4-7s-8.8 2.4-10.4 7z" fill={CHEVEUX} />
      {/* Barbe courte */}
      <path d="M22.2 32c.2 8 4.4 12.6 9.8 12.6s9.6-4.6 9.8-12.6c-1.8 3.6-5 5-9.8 5s-8-1.4-9.8-5z" fill={CHEVEUX} />
      <circle cx="28" cy="30.5" r="1.4" fill={TRAITS} />
      <circle cx="36" cy="30.5" r="1.4" fill={TRAITS} />
      <path d="M29.2 38.2q2.8 1.8 5.6 0" stroke={PEAU} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
