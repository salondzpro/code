/**
 * Carte d'un rendez-vous, UNE pour les écrans de confirmation et de fiche du rendez-vous.
 *
 * FAÇON PLANITY (19 nov. 2026, demande du propriétaire : « tout le projet comme Planity ») : le salon
 * et l'état en tête, puis « Jeudi 20 novembre 2026 » / « à 19:00 », puis chaque prestation avec sa
 * durée • son prix, le total s'il y en a plusieurs. Le pied n'existe que pour un VERSEMENT (`payNote`).
 */
import type { ReactNode } from 'react';
import type { BookingStatus, CancellationKind, CancelledBy } from '@salondz/constants';
import { TIMEZONE, formatDA, formatLocale, formatTimeDZ } from '@salondz/constants';
import { StatusBadge } from './ui';
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
  lines,
  priceDa,
  payNote,
  extra,
  muted,
  className = '',
}: {
  salon: { name: string; logoUrl?: string | null; coverUrl?: string | null };
  status?: BookingStatus;
  cancelledBy?: CancelledBy | null;
  cancellationKind?: CancellationKind | null;
  startsAt: string;
  lines: SummaryLine[];
  priceDa: number;
  /** Seulement pour un versement : « Versement de 500 DA à faire · reste 1 000 DA sur place ». */
  payNote?: string | null;
  /** Lignes propres à l'écran (pour qui, note, motif d'annulation). */
  extra?: ReactNode;
  /** Rendez-vous passé ou annulé : la date en gris. */
  muted?: boolean;
  className?: string;
}) {
  const jourTxt = new Intl.DateTimeFormat(formatLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(new Date(startsAt));
  const jour = jourTxt.charAt(0).toUpperCase() + jourTxt.slice(1);
  const single = lines.length === 1;

  return (
    <div className={`pl-sum ${className}`}>
      <div className="pl-sum-top">
        <span className="pl-sum-salon">{salon.name}</span>
        {status && (
          <span className="flex-none">
            <StatusBadge status={status} cancelledBy={cancelledBy} kind={cancellationKind} />
          </span>
        )}
      </div>
      <div className="pl-sum-row">
        <span className={`pl-bk-svn${muted ? ' text-muted' : ''}`}>{jour}</span>
        <span className="pl-bk-svm">{t('à {heure}', { heure: formatTimeDZ(startsAt) })}</span>
      </div>
      {lines.map((l) => (
        <div key={l.id} className="pl-sum-row pl-sum-sv">
          <span className="min-w-0">
            <span className="pl-bk-svn">{l.name}</span>
            {l.minutes ? <span className="pl-bk-svm">{formatDuration(l.minutes)}</span> : null}
          </span>
          <b dir="ltr">{formatDA(l.priceDa)}</b>
        </div>
      ))}
      {!single && (
        <div className="pl-sum-row pl-sum-sv">
          <span className="pl-bk-svn">{t('Total')}</span>
          <b dir="ltr">{formatDA(priceDa)}</b>
        </div>
      )}
      {extra}
      {payNote && <p className="pl-sum-pay">{payNote}</p>}
    </div>
  );
}
