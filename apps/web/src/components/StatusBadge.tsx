import type { BookingStatus } from '@salondz/constants';
import { BOOKING_STATUS_LABELS_FR } from '@salondz/constants';

const TONE: Record<BookingStatus, string> = {
  pending: 'bg-warning/15 text-warning',
  confirmed: 'bg-success/15 text-success',
  cancelled: 'bg-danger/15 text-danger',
  completed: 'bg-info/15 text-info',
  no_show: 'bg-muted/15 text-muted',
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`inline-flex rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-medium ${TONE[status]}`}>{BOOKING_STATUS_LABELS_FR[status]}</span>;
}
