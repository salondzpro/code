/**
 * Carte salon de la marketplace, à la Planity : grande photo de couverture (carrousel si plusieurs, cœur favori),
 * nom, « quartier (distance) », « ★ 4,9 (383 avis) », catégories, puis « Prochaines disponibilités » MATIN /
 * APRÈS-MIDI (chaque heure ouvre la réservation avec la date et l'heure déjà choisies) et « Plus d'informations ».
 * Même présentation pour tous les professionnels.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Heart, MapPin, Star } from 'lucide-react';
import { useFavorites, useToggleFavorite } from '@salondz/api-client';
import type { SalonSummary } from '@salondz/types';
import { addDaysToKey, categoryLabel, dayChipLabelDZ, toLocalDateKey } from '@salondz/constants';
import { formatKm, formatRating } from '@/lib/clientPrefs';
import { useAuth } from '@/lib/auth';
import { I, IconButton, Img } from './ui';

/** Catégories affichées sur une carte avant « … ». */
const MAX_CARD_CATEGORIES = 3;

export function RatingPill({
  avg,
  count,
  className = '',
}: {
  avg: number;
  count?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex flex-none items-center gap-1 rounded-full bg-fill px-3 py-1.5 text-[0.9375rem] font-semibold ${className}`}
    >
      ★ {formatRating(avg)}
      {count != null && <span className="font-normal text-muted">({count})</span>}
    </span>
  );
}

/** Ligne d'avis des cartes (Planity : « ☆ 4,9 (383 avis) ») ; sans avis : « Nouveau sur Salon DZ ». */
export function RatingLine({ avg, count }: { avg: number; count: number }) {
  return (
    <span className="flex items-center gap-1.5 text-[0.9375rem]">
      <I icon={Star} size={17} className="flex-none" />
      {count > 0 ? (
        <>
          <b className="text-[1rem]">{formatRating(avg)}</b>
          <span className="text-muted">({count} avis)</span>
        </>
      ) : (
        <span className="font-medium text-muted">Nouveau sur Salon DZ</span>
      )}
    </span>
  );
}

export function SlotPills({
  slots,
  empty = "Complet aujourd'hui",
}: {
  slots: string[];
  empty?: string;
}) {
  if (slots.length === 0) return <span className="s">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((t) => (
        <span key={t} className="pill soft mono !px-4 !py-2.5 !text-[0.8125rem]">
          {t}
        </span>
      ))}
    </div>
  );
}

/** Libellé du jour des prochaines disponibilités : « Aujourd'hui », « Demain », sinon « Jeu. 10 ». */
export function nextDayLabel(date: string, today: string = toLocalDateKey()): string {
  if (date === today) return "Aujourd'hui";
  if (date === addDaysToKey(today, 1)) return 'Demain';
  return dayChipLabelDZ(date);
}

/**
 * « Prochaines disponibilités » directement sur la carte (Planity, en plus compact) : pour le premier jour
 * disponible (aujourd'hui → demain → prochain jour ouvert et non complet, calcul SQL côté API), une ligne MATIN et
 * une ligne APRÈS-MIDI avec au plus 3 heures réellement libres chacune ; une période vide n'est pas affichée.
 * Chaque heure ouvre la réservation avec la date et l'heure déjà choisies (revalidées en SQL à la réservation).
 * « Voir plus » = fiche salon (tous les créneaux).
 */
export function NextSlots({
  salon,
  empty = 'Aucune disponibilité cette semaine',
  more,
}: {
  salon: Pick<SalonSummary, 'slug' | 'nextAvailable'>;
  empty?: string;
  /** Élément affiché à droite de l'en-tête (ex. « Plus d'infos → »). */
  more?: ReactNode;
}) {
  const navigate = useNavigate();
  const next = salon.nextAvailable;
  const go = (e: { preventDefault: () => void; stopPropagation: () => void }, to: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(to);
  };
  const rows = next
    ? [
        {
          key: 'matin',
          label: 'Matin',
          slots: next.morning ?? next.slots.filter((t) => t < '12:00').slice(0, 3),
        },
        {
          key: 'aprem',
          label: 'Après-midi',
          slots: next.afternoon ?? next.slots.filter((t) => t >= '12:00').slice(0, 3),
        },
      ].filter((r) => r.slots.length > 0)
    : [];
  if (!next || rows.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="s">{empty}</span>
        {more ?? (
          <button
            type="button"
            className="text-[0.8125rem] font-semibold text-muted"
            onClick={(e) => go(e, `/s/${salon.slug}`)}
          >
            Voir le salon →
          </button>
        )}
      </div>
    );
  }
  const day = nextDayLabel(next.date);
  return (
    <div className="flex flex-col gap-1.5" aria-label={`Prochaines disponibilités ${day}`}>
      {/* Le jour est indiqué une seule fois, dans l'en-tête : les lignes MATIN / APRÈS-MIDI restent sur une ligne. */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-muted">
          Prochaines disponibilités{' '}
          <span className="normal-case tracking-normal text-text">· {day}</span>
        </span>
        {more}
      </div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="w-[5.75rem] flex-none text-[0.75rem] font-bold uppercase tracking-[0.06em]">
            {r.label}
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {r.slots.map((t) => (
              <button
                key={t}
                type="button"
                className="pill mono !border-ink !px-3 !py-2 !text-[0.9375rem] font-bold hover:!bg-fill"
                aria-label={`Réserver ${day} ${r.label.toLowerCase()} à ${t}`}
                onClick={(e) => go(e, `/s/${salon.slug}/prestations?date=${next.date}&time=${t}`)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SalonListCard({ salon, to }: { salon: SalonSummary; to?: string }) {
  const s = salon;
  const navigate = useNavigate();
  const { session } = useAuth();
  const favs = useFavorites(!!session);
  const toggle = useToggleFavorite();
  const isFav = !!favs.data?.items.some((x) => x.id === s.id);
  const photos = s.photoUrls?.length ? s.photoUrls : s.coverUrl ? [s.coverUrl] : [];
  const [idx, setIdx] = useState(0);
  const scroller = useRef<HTMLDivElement | null>(null);
  const km = formatKm(s.distanceKm);
  const place = s.zone && s.zone !== s.city ? `${s.zone}, ${s.city}` : s.city;
  // Catégories seulement (pas de prix ni de prestations sur la carte) : 3 au plus, « … » s'il y en a d'autres.
  const cats =
    s.categoryIds
      .slice(0, MAX_CARD_CATEGORIES)
      .map((c) => categoryLabel(c))
      .join(' · ') + (s.categoryIds.length > MAX_CARD_CATEGORIES ? ' · …' : '');
  const href = to ?? `/s/${s.slug}`;

  return (
    <Link to={href} className="crd !gap-0 overflow-hidden !p-0">
      {/* Photos de couverture (hauteur réduite, 2:1) : carrousel au doigt, points, cœur favori */}
      <div className="relative">
        <div
          ref={scroller}
          className="flex w-full snap-x snap-mandatory overflow-x-auto bg-line"
          style={{ aspectRatio: '2 / 1', scrollbarWidth: 'none' }}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
        >
          {photos.length === 0 && <div className="h-full w-full flex-none" />}
          {photos.map((u) => (
            <img
              key={u}
              src={u}
              alt=""
              loading="lazy"
              className="h-full w-full flex-none snap-center object-cover"
              draggable={false}
            />
          ))}
        </div>
        {photos.length > 1 && (
          <div
            className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1.5"
            aria-hidden
          >
            {photos.map((u, i) => (
              <span
                key={u}
                className={`h-1.5 w-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
        )}
        <IconButton
          className="absolute right-2.5 top-2.5 !bg-surface/95 shadow-sm"
          aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          aria-pressed={isFav}
          disabled={toggle.isPending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (session) toggle.mutate({ salonId: s.id, on: !isFav });
            else navigate(`/connexion?next=${encodeURIComponent(href)}`);
          }}
        >
          <Heart size={20} strokeWidth={1.6} fill={isFav ? 'currentColor' : 'none'} />
        </IconButton>
      </div>
      <div className="flex flex-col gap-1.5 px-4 pb-3.5 pt-3">
        {/* Gauche : nom · Droite : note — une seule ligne */}
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[1.1875rem] font-bold leading-tight tracking-[-0.5px]">
            {s.name}
          </span>
          <span className="flex-none">
            <RatingLine avg={s.ratingAvg} count={s.ratingCount} />
          </span>
        </div>
        {/* Gauche : lieu (distance) · Droite : catégories — une seule ligne */}
        <div className="flex items-center justify-between gap-3 text-[0.875rem] text-muted">
          <span className="flex min-w-0 items-center gap-1">
            <I icon={MapPin} size={15} className="flex-none" />
            <span className="truncate">
              {place}
              {km ? ` (${km})` : ''}
            </span>
          </span>
          {cats && <span className="min-w-0 flex-none truncate text-right">{cats}</span>}
        </div>
        <div className="mt-1">
          <NextSlots
            salon={s}
            more={
              <button
                type="button"
                className="flex-none text-[0.8125rem] font-semibold underline underline-offset-4"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(href);
                }}
              >
                Plus d'infos
              </button>
            }
          />
        </div>
      </div>
    </Link>
  );
}
