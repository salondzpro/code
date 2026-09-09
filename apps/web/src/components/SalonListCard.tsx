/**
 * Carte salon de la marketplace (design C-H 01 / C-F 01, présentation « à la Planity ») : grande version avec
 * couverture, version compacte avec vignette. Prestations phares, « ★ 4,9 (383 avis) », puis la grille
 * MATIN / APRÈS-MIDI / SOIR × 3 jours : une puce active ouvre la réservation au premier créneau libre du moment.
 */
import { Fragment } from 'react';
import { Link, useNavigate } from 'react-router';
import type { PeriodDay, SalonSummary } from '@salondz/types';
import { categoryLabel, dayChipLabelDZ, formatDA, relativeDayLabelDZ } from '@salondz/constants';
import { formatKm, formatRating } from '@/lib/clientPrefs';
import { Img } from './ui';

export function RatingPill({ avg, count, className = '' }: { avg: number; count?: number; className?: string }) {
  return (
    <span className={`inline-flex flex-none items-center gap-1 rounded-full bg-fill px-3 py-1.5 text-[0.9375rem] font-semibold ${className}`}>
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
          <span className="text-muted">
            ({count} avis)
          </span>
        </>
      ) : (
        <span className="text-muted">Nouveau sur Salon DZ</span>
      )}
    </span>
  );
}

const PERIODS: { key: keyof Omit<PeriodDay, 'date'>; label: string }[] = [
  { key: 'matin', label: 'Matin' },
  { key: 'apresMidi', label: 'Après-midi' },
  { key: 'soir', label: 'Soir' },
];

/**
 * Grille « Matin / Après-midi / Soir » × 3 jours (Planity) : puce active = premier créneau libre du moment,
 * puce grisée = rien de libre. La ligne Soir n'apparaît que si le salon a des créneaux le soir.
 * Aucun créneau sur 3 jours → repli sur la prochaine disponibilité (`NextSlots`).
 */
export function PeriodGrid({ salon }: { salon: Pick<SalonSummary, 'slug' | 'nextAvailable' | 'periods'> }) {
  const navigate = useNavigate();
  const days = salon.periods ?? [];
  const any = days.some((d) => d.matin || d.apresMidi || d.soir);
  if (!any) return <NextSlots salon={salon} empty="Aucune disponibilité ces 3 prochains jours" />;
  const rows = PERIODS.filter((p) => p.key !== 'soir' || days.some((d) => d.soir));
  return (
    <div className="grid items-center gap-x-2 gap-y-2" style={{ gridTemplateColumns: `5.75rem repeat(${days.length}, minmax(0, 1fr))` }} role="group" aria-label="Disponibilités par moment de la journée">
      {rows.map((p) => (
        <Fragment key={p.key}>
          <span className="text-[0.75rem] font-bold uppercase tracking-[0.08em]">{p.label}</span>
          {days.map((d) => {
            const t = d[p.key];
            const label = dayChipLabelDZ(d.date);
            return t ? (
              <button
                key={d.date}
                type="button"
                className="pill !border-ink !px-1 !py-2.5 text-center !text-[0.8125rem] font-semibold hover:!bg-fill"
                aria-label={`Réserver ${label} ${p.label.toLowerCase()} à ${t}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(`/s/${salon.slug}/prestations?date=${d.date}&time=${t}`);
                }}
              >
                {label}
              </button>
            ) : (
              <span key={d.date} className="pill soft !px-1 !py-2.5 text-center !text-[0.8125rem] text-subtle" aria-label={`${label} ${p.label.toLowerCase()} : complet`}>
                {label}
              </span>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

export function SlotPills({ slots, empty = "Complet aujourd'hui" }: { slots: string[]; empty?: string }) {
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

/**
 * Prochaine disponibilité directement sur la carte : « Aujourd'hui · 12:00 12:45 15:30 » ou « Demain · 10:00 … ».
 * Chaque heure ouvre la réservation avec la date et l'heure déjà choisies (le client n'a plus qu'à cocher ses prestations).
 * Sans compte : accessible aux visiteurs, la connexion est demandée plus loin dans le parcours.
 */
export function NextSlots({ salon, empty = 'Aucune disponibilité cette semaine' }: { salon: Pick<SalonSummary, 'slug' | 'nextAvailable'>; empty?: string }) {
  const navigate = useNavigate();
  const next = salon.nextAvailable;
  if (!next || next.slots.length === 0) return <span className="s">{empty}</span>;
  const label = relativeDayLabelDZ(next.date);
  return (
    <div className="flex flex-col gap-2" aria-label={`Prochaines disponibilités ${label}`}>
      <span className="t3 font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">
        {next.slots.map((t) => (
          <button
            key={t}
            type="button"
            className="pill soft mono !px-4 !py-2.5 !text-[0.8125rem] hover:!bg-line"
            aria-label={`Réserver ${label} à ${t}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/s/${salon.slug}/prestations?date=${next.date}&time=${t}`);
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function servicesLine(s: SalonSummary): string {
  return s.topServices.map((t) => `${t.name} ${formatDA(t.priceDa)}`).join(' · ');
}

export function SalonListCard({ salon, large, to }: { salon: SalonSummary; large?: boolean; to?: string }) {
  const s = salon;
  const km = formatKm(s.distanceKm);
  const place = s.zone ?? s.city;
  const cats = s.categoryIds.slice(0, 2).map((c) => categoryLabel(c)).join(' · ');
  const href = to ?? `/s/${s.slug}`;

  if (large) {
    return (
      <Link to={href} className="crd !gap-0 overflow-hidden !p-0">
        <div className="relative h-[14.375rem] w-full bg-line">
          {s.coverUrl && <img src={s.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
        </div>
        <div className="flex flex-col gap-1 p-4">
          <span className="text-[1.125rem] font-bold leading-tight tracking-[-0.4px]">{s.name}</span>
          <span className="text-[0.8125rem] text-muted">
            {[cats, place, km].filter(Boolean).join(' · ')}
          </span>
          <RatingLine avg={s.ratingAvg} count={s.ratingCount} />
          {s.topServices.length > 0 && <span className="text-[0.9375rem] text-subtle">{servicesLine(s)}</span>}
          <div className="mt-2.5">
            <PeriodGrid salon={s} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={href} className="crd !gap-3">
      <div className="flex items-start gap-3.5">
        <Img src={s.logoUrl ?? s.coverUrl} className="h-[7rem] w-[7rem] flex-none !rounded-[1rem]" />
        <div className="min-w-0 flex-1">
          <span className="text-[1.0625rem] font-bold leading-tight tracking-[-0.4px]">{s.name}</span>
          <span className="mt-1 block text-[0.8125rem] text-muted">{[cats, place, km].filter(Boolean).join(' · ')}</span>
          <div className="mt-1">
            <RatingLine avg={s.ratingAvg} count={s.ratingCount} />
          </div>
          {s.topServices.length > 0 && <span className="mt-0.5 block text-[0.9375rem] text-subtle">{servicesLine(s)}</span>}
        </div>
      </div>
      <PeriodGrid salon={s} />
    </Link>
  );
}
