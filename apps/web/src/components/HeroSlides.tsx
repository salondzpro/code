/**
 * Fond d'ouverture qui ALTERNE les photos en fondu enchaîné (28 oct. 2026) : Salon DZ sert les
 * salons de FEMMES autant que ceux d'hommes, et une seule photo de barbier le faisait oublier.
 * L'ordre alterne femme / homme, en commençant par une femme.
 *
 * Toutes les images sont empilées ; seule la courante est opaque (transition d'opacité, plus un
 * lent zoom sur la photo affichée). La première est prioritaire au chargement, les suivantes
 * arrivent pendant qu'on regarde la première. Immobile sous `prefers-reduced-motion`.
 *
 * Photos : celles de la démonstration (`/demo/*.webp`, Unsplash, licence commerciale libre).
 */
import { useEffect, useState } from 'react';

/**
 * ORDRE DES PHOTOS (28 oct. 2026, d'après les métiers qui utilisent le plus Salon DZ) : ongles,
 * cils et sourcils, barbiers, puis coiffure femme. On alterne femme / homme pour que chacun s'y
 * reconnaisse dès la première seconde, en ouvrant sur le métier le plus présent : l'onglerie.
 */
/** Pages des clients (salondz.com) : ce qu'on vient réserver. */
export const HERO_MIXTE = ['f-pose-gel', 'cover-hommes', 'f-extension-cils', 'h-coupe', 'f-sourcils', 'f-balayage'];
/** Pages des professionnels : les métiers qui s'équipent, du plus présent au moins présent. */
export const HERO_PRO = ['f-pose-gel', 'h-barbe', 'f-extension-cils', 'h-coupe', 'f-sourcils', 'f-balayage'];

/** Index courant d'un défilé, avancé toutes les `intervalle` ms (immobile si moins d'animations). */
export function useDefile(n: number, intervalle = 5200): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (n < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % n), intervalle);
    return () => window.clearInterval(id);
  }, [n, intervalle]);
  return i;
}

export function HeroSlides({
  photos = HERO_MIXTE,
  intervalle = 5200,
  index,
  className = '',
}: {
  photos?: string[];
  intervalle?: number;
  /** Index imposé par la page, pour qu'un texte change EN MÊME TEMPS que la photo. */
  index?: number;
  className?: string;
}) {
  const interne = useDefile(index === undefined ? photos.length : 0, intervalle);
  const i = (index ?? interne) % photos.length;

  return (
    <div className={`hsl ${className}`} aria-hidden>
      {photos.map((p, n) => (
        <img
          key={p}
          src={`/demo/${p}.webp`}
          alt=""
          className={n === i ? 'on' : ''}
          decoding="async"
          fetchPriority={n === 0 ? 'high' : 'low'}
        />
      ))}
    </div>
  );
}
