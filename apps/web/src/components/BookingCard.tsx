import type { ReactNode } from 'react';
import type { Booking } from '@salondz/types';
import { formatDA, formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import { StatusBadge } from './StatusBadge';
import { formatDuration } from '@/lib/format';

/** Carte réservation — `title` = nom du salon (client) ou nom du client (pro). */
export function BookingCard({
  booking,
  title,
  subtitle,
  actions,
}: {
  booking: Booking;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <article className="card flex flex-col gap-2 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{title}</h3>
          {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        </div>
        <StatusBadge status={booking.status} />
      </header>
      <p className="text-sm">
        <time dateTime={booking.startsAt}>
          {formatDateShortDZ(booking.startsAt)} · {formatTimeDZ(booking.startsAt)}
        </time>{' '}
        – {formatTimeDZ(booking.endsAt)}
      </p>
      <p className="text-sm text-muted">
        {booking.serviceName} · {formatDuration(booking.durationMinutes)} · <strong className="text-text">{formatDA(booking.priceDa)}</strong>
      </p>
      {booking.notes && <p className="text-sm italic text-muted">« {booking.notes} »</p>}
      {booking.cancellationReason && <p className="text-sm text-danger">Motif : {booking.cancellationReason}</p>}
      {actions && <footer className="mt-1 flex flex-wrap gap-2">{actions}</footer>}
    </article>
  );
}
