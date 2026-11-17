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
import { useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { I } from './ui';
import { t } from '@/i18n';

/**
 * GLISSER AU DOIGT (17 nov. 2026, demande du propriétaire) : les photos sont une bande qui défile de
 * côté avec aimantation (`scroll-snap`) — elle suit le doigt, comme Instagram ou Airbnb. Les flèches
 * restent et font défiler la même bande ; le compteur suit la photo visible. En arabe, le défilement
 * part de la droite : la position est lue en valeur absolue.
 */
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
  const bande = useRef<HTMLDivElement>(null);
  const count = images.length;

  const aller = (n: number) => {
    const el = bande.current;
    if (!el) return;
    const cible = (n + count) % count;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollTo({ left: (rtl ? -1 : 1) * cible * el.clientWidth, behavior: 'smooth' });
  };
  const surDefilement = () => {
    const el = bande.current;
    if (!el || !el.clientWidth) return;
    setI(Math.min(count - 1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth)));
  };

  return (
    <div className={`relative overflow-hidden bg-line ${className}`}>
      {count > 0 && (
        <div ref={bande} onScroll={surDefilement} className="gal-bande flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
          {images.map((src, k) => (
            <img
              key={src}
              src={src}
              alt={k === 0 ? alt : ''}
              loading={k === 0 ? 'eager' : 'lazy'}
              draggable={false}
              className="h-full w-full flex-none snap-center snap-always object-cover"
            />
          ))}
        </div>
      )}

      {/* Dégradés latéraux uniquement : le centre de la photo reste intact. */}
      {count > 0 && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-0 w-1/5 bg-gradient-to-r from-black/45 to-transparent"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 end-0 w-1/5 bg-gradient-to-l from-black/45 to-transparent"
          />
        </>
      )}

      {children}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label={t("Photo précédente")}
            onClick={() => aller(i - 1)}
            className="absolute start-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm"
          >
            <I icon={ChevronLeft} size={20} className="text-current" />
          </button>
          <button
            type="button"
            aria-label={t("Photo suivante")}
            onClick={() => aller(i + 1)}
            className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm"
          >
            <I icon={ChevronRight} size={20} className="text-current" />
          </button>
          <span className="absolute bottom-2 end-3 rounded-full bg-black/45 px-2 py-0.5 text-[0.857rem] font-semibold text-white">
            {i + 1}/{count}
          </span>
        </>
      )}
    </div>
  );
}
