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

/** Femme, homme, femme, homme… — les photos des pages d'ouverture. */
export const HERO_MIXTE = ['f-chignon-mariee', 'cover-hommes', 'f-balayage', 'h-coupe', 'cover-femmes'];

export function HeroSlides({
  photos = HERO_MIXTE,
  intervalle = 5200,
  className = '',
}: {
  photos?: string[];
  intervalle?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (photos.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % photos.length), intervalle);
    return () => window.clearInterval(id);
  }, [photos.length, intervalle]);

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
