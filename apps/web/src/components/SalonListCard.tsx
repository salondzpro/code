/**
 * Carte salon de la marketplace (design C-H 01 / C-F 01) : grande version avec couverture,
 * version compacte avec vignette. Prestations phares, note, prochains créneaux du jour.
 */
import { Link } from 'react-router';
import type { SalonSummary } from '@salondz/types';
import { categoryLabel, formatDA } from '@salondz/constants';
import { formatKm, formatRating } from '@/lib/clientPrefs';
import { Img } from './ui';

export function RatingPill({ avg, count, className = '' }: { avg: number; count?: number; className?: string }) {
  return (
    <span className={`inline-flex flex-none items-center gap-1 rounded-full bg-fill px-3 py-1.5 text-[15px] font-semibold ${className}`}>
      ★ {formatRating(avg)}
      {count != null && <span className="font-normal text-muted">({count})</span>}
    </span>
  );
}

export function SlotPills({ slots, empty = "Complet aujourd'hui" }: { slots: string[]; empty?: string }) {
  if (slots.length === 0) return <span className="s">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((t) => (
        <span key={t} className="pill soft mono !px-4 !py-2.5 !text-[16px]">
          {t}
        </span>
      ))}
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
        <div className="relative h-[230px] w-full bg-line">
          {s.coverUrl && <img src={s.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
        </div>
        <div className="flex flex-col gap-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[22px] font-bold leading-tight tracking-[-0.4px]">{s.name}</span>
            {s.ratingCount > 0 && <RatingPill avg={s.ratingAvg} />}
          </div>
          <span className="text-[16px] text-muted">
            {[cats, place, km].filter(Boolean).join(' · ')}
          </span>
          {s.topServices.length > 0 && <span className="text-[15px] text-subtle">{servicesLine(s)}</span>}
          <div className="mt-2.5">
            <SlotPills slots={s.nextSlots} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={href} className="crd !gap-3">
      <div className="flex items-start gap-3.5">
        <Img src={s.logoUrl ?? s.coverUrl} className="h-[112px] w-[112px] flex-none !rounded-[16px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[21px] font-bold leading-tight tracking-[-0.4px]">{s.name}</span>
            {s.ratingCount > 0 && <RatingPill avg={s.ratingAvg} />}
          </div>
          <span className="mt-1 block text-[16px] text-muted">{[cats, place, km].filter(Boolean).join(' · ')}</span>
          {s.topServices.length > 0 && <span className="mt-0.5 block text-[15px] text-subtle">{servicesLine(s)}</span>}
        </div>
      </div>
      <SlotPills slots={s.nextSlots} />
    </Link>
  );
}
