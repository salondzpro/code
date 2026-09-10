/**
 * Carte salon de la marketplace, à la Planity : grande photo de couverture (carrousel si plusieurs, cœur favori),
 * nom, « quartier (distance) », « ★ 4,9 (383 avis) », catégories, puis « Prochaines disponibilités » MATIN /
 * APRÈS-MIDI (chaque heure ouvre la réservation avec la date et l'heure déjà choisies) et « Plus d'informations ».
 * Même présentation pour tous les professionnels.
 */
import { useRef, useState } from 'react';
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
}: {
  salon: Pick<SalonSummary, 'slug' | 'nextAvailable'>;
  empty?: string;
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
        <button
          type="button"
          className="text-[0.8125rem] font-semibold text-muted"
          onClick={(e) => go(e, `/s/${salon.slug}`)}
        >
          Voir le salon →
        </button>
      </div>
    );
  }
  const day = nextDayLabel(next.date);
  return (
    <div className="flex flex-col gap-2" aria-label={`Prochaines disponibilités ${day}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-muted">
          Prochaines disponibilités
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="w-[7.75rem] flex-none text-[0.8125rem] font-bold uppercase tracking-[0.06em]">
            {r.label}{' '}
            <span className="font-bold normal-case tracking-normal text-text">· {day}</span>
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {r.slots.map((t) => (
              <button
                key={t}
                type="button"
                className="pill mono !border-ink !px-3.5 !py-2.5 !text-[1rem] font-bold hover:!bg-fill"
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
      {/* Photos de couverture : carrousel au doigt (scroll-snap), points, cœur favori */}
      <div className="relative">
        <div
          ref={scroller}
          className="flex w-full snap-x snap-mandatory overflow-x-auto bg-line"
          style={{ aspectRatio: '16 / 10', scrollbarWidth: 'none' }}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
        >
          {photos.length === 0 && <div className="h-full w-full flex-none" />}
          {photos.map((u, i) => (
            <img
              key={u}
              src={u}
              alt=""
              loading={i === 0 ? 'lazy' : 'lazy'}
              className="h-full w-full flex-none snap-center object-cover"
              draggable={false}
            />
          ))}
        </div>
        {photos.length > 1 && (
          <div
            className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5"
            aria-hidden
          >
            {photos.map((u, i) => (
              <span
                key={u}
                className={`h-2 w-2 rounded-full ${i === idx ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
        )}
        <IconButton
          lg
          className="absolute right-3 top-3 !bg-surface/95 shadow-sm"
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
          <Heart size={22} strokeWidth={1.6} fill={isFav ? 'currentColor' : 'none'} />
        </IconButton>
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <span className="text-[1.3125rem] font-bold leading-tight tracking-[-0.5px]">{s.name}</span>
        <span className="flex items-center gap-1.5 text-[0.9375rem] text-muted">
          <I icon={MapPin} size={17} className="flex-none" />
          <span className="truncate">
            {place}
            {km ? ` (${km})` : ''}
          </span>
        </span>
        <RatingLine avg={s.ratingAvg} count={s.ratingCount} />
        {cats && <span className="text-[0.875rem] text-muted">{cats}</span>}
        <div className="mt-2">
          <NextSlots salon={s} />
        </div>
        <span className="mt-2 self-center text-[0.9375rem] font-semibold underline underline-offset-4">
          Plus d'informations
        </span>
      </div>
    </Link>
  );
}
