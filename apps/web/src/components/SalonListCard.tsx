/**
 * Carte salon de la marketplace (design C-H 01 / C-F 01) : grande version avec couverture, version compacte
 * avec vignette. Nom, « ★ 4,9 (383 avis) · quartier », prestations phares, puis « Prochaines disponibilités » :
 * les 5 premiers créneaux libres du premier jour disponible, chacun ouvre la réservation avec la date et l'heure
 * déjà choisies (il ne reste que les prestations). « Voir plus » ouvre la fiche du salon.
 */
import { Link, useNavigate } from 'react-router';
import type { SalonSummary } from '@salondz/types';
import {
  addDaysToKey,
  categoryLabel,
  dayChipLabelDZ,
  formatDA,
  toLocalDateKey,
} from '@salondz/constants';
import { formatKm, formatRating } from '@/lib/clientPrefs';
import { Img } from './ui';

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
    <span className="flex items-center gap-1.5 text-[0.875rem]">
      <span aria-hidden>★</span>
      {count > 0 ? (
        <>
          <b>{formatRating(avg)}</b>
          <span className="text-muted">({count} avis)</span>
        </>
      ) : (
        <span className="text-muted">Nouveau sur Salon DZ</span>
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

/** Libellé du jour des prochaines disponibilités : « Aujourd'hui », « Demain · Ven. 11 », « Prochain créneau · Sam. 12 ». */
export function nextDayLabel(date: string, today: string = toLocalDateKey()): string {
  if (date === today) return "Aujourd'hui";
  if (date === addDaysToKey(today, 1)) return `Demain · ${dayChipLabelDZ(date)}`;
  return `Prochain créneau · ${dayChipLabelDZ(date)}`;
}

/**
 * « Prochaines disponibilités » directement sur la carte : les créneaux réellement libres les plus proches
 * (aujourd'hui, sinon demain, sinon le prochain jour ouvert et non complet — calcul SQL côté API, revalidé à la
 * réservation). Chaque heure ouvre la réservation avec la date et l'heure déjà choisies. « Voir plus » = fiche salon.
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
  if (!next || next.slots.length === 0) {
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
  const label = nextDayLabel(next.date);
  return (
    <div className="flex flex-col gap-2" aria-label={`Prochaines disponibilités ${label}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-muted">
          Prochaines disponibilités
        </span>
        <span className="text-[0.8125rem] font-semibold">{label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {next.slots.map((t) => (
          <button
            key={t}
            type="button"
            className="pill mono !border-ink !px-3.5 !py-2.5 !text-[0.9375rem] font-semibold hover:!bg-fill"
            aria-label={`Réserver ${label} à ${t}`}
            onClick={(e) => go(e, `/s/${salon.slug}/prestations?date=${next.date}&time=${t}`)}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          className="!px-1 text-[0.8125rem] font-semibold text-muted"
          aria-label="Voir plus de créneaux"
          onClick={(e) => go(e, `/s/${salon.slug}`)}
        >
          Voir plus →
        </button>
      </div>
    </div>
  );
}

function servicesLine(s: SalonSummary): string {
  return s.topServices.map((t) => `${t.name} ${formatDA(t.priceDa)}`).join(' · ');
}

export function SalonListCard({
  salon,
  large,
  to,
}: {
  salon: SalonSummary;
  large?: boolean;
  to?: string;
}) {
  const s = salon;
  const km = formatKm(s.distanceKm);
  const place = s.zone ?? s.city;
  const cats = s.categoryIds
    .slice(0, 2)
    .map((c) => categoryLabel(c))
    .join(' · ');
  const href = to ?? `/s/${s.slug}`;

  if (large) {
    return (
      <Link to={href} className="crd !gap-0 overflow-hidden !p-0">
        <div className="relative h-[14.375rem] w-full bg-line">
          {s.coverUrl && (
            <img src={s.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          )}
        </div>
        <div className="flex flex-col gap-1 p-4">
          <span className="text-[1.125rem] font-bold leading-tight tracking-[-0.4px]">
            {s.name}
          </span>
          <span className="text-[0.8125rem] text-muted">
            {[cats, place, km].filter(Boolean).join(' · ')}
          </span>
          <RatingLine avg={s.ratingAvg} count={s.ratingCount} />
          {s.topServices.length > 0 && (
            <span className="text-[0.9375rem] text-subtle">{servicesLine(s)}</span>
          )}
          <div className="mt-2.5">
            <NextSlots salon={s} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={href} className="crd !gap-3">
      <div className="flex items-start gap-3.5">
        <Img
          src={s.logoUrl ?? s.coverUrl}
          className="h-[7rem] w-[7rem] flex-none !rounded-[1rem]"
        />
        <div className="min-w-0 flex-1">
          <span className="text-[1.0625rem] font-bold leading-tight tracking-[-0.4px]">
            {s.name}
          </span>
          <span className="mt-1 block text-[0.8125rem] text-muted">
            {[cats, place, km].filter(Boolean).join(' · ')}
          </span>
          <div className="mt-1">
            <RatingLine avg={s.ratingAvg} count={s.ratingCount} />
          </div>
          {s.topServices.length > 0 && (
            <span className="mt-0.5 block text-[0.9375rem] text-subtle">{servicesLine(s)}</span>
          )}
        </div>
      </div>
      <NextSlots salon={s} />
    </Link>
  );
}
