/**
 * Album photo de la fiche salon : couverture, photos du salon et réalisations dans un seul
 * défilé, avec flèches et compteur.
 *
 * Les réalisations étaient reléguées dans l'onglet « À propos », alors que ce sont elles qui
 * décident d'une prise de rendez-vous en coiffure : elles rejoignent donc l'album principal.
 *
 * Les dégradés ne sont posés QUE sur les bords gauche et droit, verticalement : ils détachent
 * les flèches de la photo sans l'assombrir au centre, là où il y a quelque chose à regarder.
 */
import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { I } from './ui';

export function SalonGallery({
  images,
  alt,
  children,
  className = 'h-[14rem]',
}: {
  images: string[];
  alt: string;
  /** Boutons posés sur la photo (retour, partage, favori). */
  children?: ReactNode;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const count = images.length;
  const go = (d: number) => setI((v) => (v + d + count) % count);

  return (
    <div className={`relative overflow-hidden bg-line ${className}`}>
      {count > 0 && (
        <img
          src={images[Math.min(i, count - 1)]}
          alt={alt}
          className="h-full w-full object-cover"
        />
      )}

      {/* Dégradés latéraux uniquement : le centre de la photo reste intact. */}
      {count > 0 && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/5 bg-gradient-to-r from-black/45 to-transparent"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-1/5 bg-gradient-to-l from-black/45 to-transparent"
          />
        </>
      )}

      {children}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Photo précédente"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm"
          >
            <I icon={ChevronLeft} size={20} className="text-current" />
          </button>
          <button
            type="button"
            aria-label="Photo suivante"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm"
          >
            <I icon={ChevronRight} size={20} className="text-current" />
          </button>
          <span className="absolute bottom-2 right-3 rounded-full bg-black/45 px-2 py-0.5 text-[0.857rem] font-semibold text-white">
            {i + 1}/{count}
          </span>
        </>
      )}
    </div>
  );
}
