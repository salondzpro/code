/**
 * Carte d'un rendez-vous, UNE pour trois écrans : confirmer, confirmation, fiche du rendez-vous.
 * Compacte et SANS DOUBLON (15 nov. 2026, demande du propriétaire) : l'heure une seule fois, en grand ;
 * le jour sous le jour relatif ; la durée une seule fois, sous la prestation ; une ligne de pied.
 */
import type { ReactNode } from 'react';
import { CalendarDays, Scissors, Banknote } from 'lucide-react';
import type { BookingStatus, CancellationKind, CancelledBy } from '@salondz/constants';
import { formatDA, formatDateLongDZ, formatTimeDZ, lateRule, relativeDayLabelDZ, toLocalDateKey } from '@salondz/constants';
import { Avatar, StatusBadge } from './ui';
import { FactRow } from './BookingFacts';
import { formatDuration } from '@/lib/format';
import { t } from '@/i18n';

export interface SummaryLine {
  id: string;
  name: string;
  minutes?: number | null;
  priceDa: number;
}

export function BookingSummary({
  salon,
  status,
  cancelledBy,
  cancellationKind,
  startsAt,
  endsAt,
  lines,
  staffName,
  priceDa,
  payNote,
  showLate = false,
  extra,
  muted,
  className = '',
}: {
  salon: { name: string; logoUrl?: string | null; coverUrl?: string | null; area?: string | null };
  status?: BookingStatus;
  cancelledBy?: CancelledBy | null;
  cancellationKind?: CancellationKind | null;
  startsAt: string;
  endsAt: string;
  lines: SummaryLine[];
  staffName?: string | null;
  priceDa: number;
  payNote: string;
  showLate?: boolean;
  /** Lignes propres à l'écran (pour qui, note, motif d'annulation). */
  extra?: ReactNode;
  /** Rendez-vous passé ou annulé : l'heure en gris. */
  muted?: boolean;
  className?: string;
}) {
  const dayLabel = relativeDayLabelDZ(toLocalDateKey(new Date(startsAt)));
  const dateLong = formatDateLongDZ(startsAt).replace(/^\w/, (c) => c.toUpperCase());
    const single = lines.length === 1;
  const late = lateRule(startsAt);

  return (
    <div className={`crd !gap-0 !py-1 ${className}`}>
      <div className="li !items-center !gap-3">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={40} />
          <span className="min-w-0">
            <span className="block truncate text-[1rem] font-semibold">{salon.name}</span>
            {salon.area && <span className="block truncate text-[0.857rem] text-muted">{salon.area}</span>}
          </span>
        </span>
        {status && (
          <span className="bk-badge flex-none">
            <StatusBadge status={status} cancelledBy={cancelledBy} kind={cancellationKind} />
          </span>
        )}
      </div>
      <FactRow
        icon={CalendarDays}
        title={/^\p{L}+\. \d/u.test(dayLabel) ? dateLong : dayLabel}
        sub={/^\p{L}+\. \d/u.test(dayLabel) ? undefined : dateLong}
        right={
          <span className={`mono text-[1.429rem] font-semibold tracking-[-0.5px] ${muted ? 'text-muted' : ''}`} dir="ltr">
            {formatTimeDZ(startsAt)}
          </span>
        }
      />
      {lines.map((l) => (
        <FactRow
          key={l.id}
          icon={Scissors}
          title={l.name}
          sub={[l.minutes ? formatDuration(l.minutes) : null, single && staffName ? t('Avec {name}', { name: staffName }) : null]
            .filter(Boolean)
            .join(' · ') || undefined}
          right={<span className="text-[1rem] font-semibold">{formatDA(l.priceDa)}</span>}
        />
      ))}
      {!single && (
        <FactRow
          icon={Banknote}
          title={t('Total')}
          sub={staffName ? t('Avec {name}', { name: staffName }) : undefined}
          right={<span className="text-[1rem] font-semibold">{formatDA(priceDa)}</span>}
        />
      )}
      {extra}
      <p className="px-0.5 pb-2 pt-2.5 text-[0.786rem] leading-[1.45] text-muted">
        {payNote}
        {showLate && (
          <>
            {' · '}
            {t('Arrivez à {a}, retard toléré jusqu’à {b}', { a: late.arriveAt, b: late.lateUntil })}
          </>
        )}
      </p>
    </div>
  );
}
