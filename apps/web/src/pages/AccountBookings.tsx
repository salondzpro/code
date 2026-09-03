import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAvailability, useCancelBooking, useCreateReview, useMyBookings, useRescheduleBooking, useSalon } from '@salondz/api-client';
import { CLIENT_CANCEL_MIN_HOURS, addDaysToKey, dayOfWeekFromKey, formatDateLongDZ, formatTimeDZ, toLocalDateKey } from '@salondz/constants';
import type { AvailabilitySlot, BookingWithSalon } from '@salondz/types';
import { BookingCard } from '@/components/BookingCard';
import { WeekStrip } from '@/components/WeekStrip';
import { TimeSlotGrid } from '@/components/TimeSlotGrid';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';

function ReviewForm({ booking }: { booking: BookingWithSalon }) {
  const review = useCreateReview();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  if (review.isSuccess) return <p className="text-sm text-success">Merci pour votre avis !</p>;
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        review.mutate({ bookingId: booking.id, rating, comment: comment.trim() || undefined });
      }}
    >
      <select className="input w-auto" value={rating} onChange={(e) => setRating(Number(e.target.value))} aria-label="Note">
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {'★'.repeat(n)}
          </option>
        ))}
      </select>
      <input className="input flex-1" placeholder="Un mot sur votre visite ?" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} />
      <button type="submit" className="btn-ghost text-sm" disabled={review.isPending}>
        Publier
      </button>
      <ErrorMessage error={review.error} className="w-full" />
    </form>
  );
}

/**
 * Report d'un rendez-vous : même salon, même service, même membre ; seul le créneau
 * change. Les créneaux proposés viennent de `get_available_slots` (source de vérité).
 */
function RescheduleForm({ booking, onDone }: { booking: BookingWithSalon; onDone: () => void }) {
  const salon = useSalon(booking.salon.slug);
  const reschedule = useRescheduleBooking();
  const today = toLocalDateKey();
  const [date, setDate] = useState(() => toLocalDateKey(new Date(booking.startsAt)));
  const [weekOf, setWeekOf] = useState(date);
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const availability = useAvailability(booking.salonId, { serviceId: booking.serviceId, date, staffId: booking.staffId ?? undefined });

  useEffect(() => {
    setSlot(null);
  }, [date]);

  if (salon.isPending) return <Spinner inline />;
  if (salon.isError) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;
  const s = salon.data;
  const maxDate = addDaysToKey(today, s.bookingHorizonDays);
  const closedDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.openingHours.some((h) => h.dayOfWeek === d && !h.isClosed));

  const confirm = async () => {
    if (!slot) return;
    await reschedule.mutateAsync({ id: booking.id, startsAt: slot.startsAt, staffId: booking.staffId });
    onDone();
  };

  return (
    <div className="mt-2 flex w-full flex-col gap-3 border-t border-line pt-3" aria-label="Reporter le rendez-vous">
      <p className="text-sm font-medium">Nouveau créneau{booking.staff ? ` avec ${booking.staff.displayName}` : ''}</p>
      <WeekStrip weekOf={weekOf} selected={date} onSelect={setDate} onWeekChange={setWeekOf} minDate={today} maxDate={maxDate} disabledDays={closedDays} />
      {closedDays.includes(dayOfWeekFromKey(date)) ? (
        <p className="text-sm text-muted">Le salon est fermé ce jour-là.</p>
      ) : availability.isPending || availability.isFetching ? (
        // isFetching aussi : le cache peut encore contenir le créneau du RDV actuel juste après la réservation
        <Spinner label="Recherche des créneaux…" inline />
      ) : availability.isError ? (
        <ErrorMessage error={availability.error} retry={() => availability.refetch()} />
      ) : availability.data.slots.length === 0 ? (
        <p className="text-sm text-muted">Plus de créneau disponible ce jour. Essayez un autre jour.</p>
      ) : (
        <TimeSlotGrid slots={availability.data.slots} selected={slot?.startsAt ?? null} onSelect={setSlot} />
      )}
      <ErrorMessage error={reschedule.error} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary px-3 py-1 text-sm" disabled={!slot || reschedule.isPending} onClick={confirm}>
          {slot ? `Reporter au ${formatDateLongDZ(slot.startsAt)} à ${formatTimeDZ(slot.startsAt)}` : 'Choisissez un créneau'}
        </button>
        <button type="button" className="btn-ghost px-3 py-1 text-sm" onClick={onDone}>
          Fermer
        </button>
      </div>
    </div>
  );
}

export function AccountBookings() {
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const list = useMyBookings({ scope });
  const cancel = useCancelBooking();

  /** Annulation / report possibles jusqu'à CLIENT_CANCEL_MIN_HOURS avant le rendez-vous. */
  const canModify = (b: BookingWithSalon) =>
    (b.status === 'pending' || b.status === 'confirmed') && (new Date(b.startsAt).getTime() - Date.now()) / 3_600_000 >= CLIENT_CANCEL_MIN_HOURS;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Mes réservations</h1>
      <div className="flex gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={scope === 'upcoming'} className={scope === 'upcoming' ? 'chip-active' : 'chip'} onClick={() => setScope('upcoming')}>
          À venir
        </button>
        <button type="button" role="tab" aria-selected={scope === 'past'} className={scope === 'past' ? 'chip-active' : 'chip'} onClick={() => setScope('past')}>
          Passées
        </button>
      </div>
      <ErrorMessage error={cancel.error} />
      {list.isPending && <Spinner />}
      {list.isError && <ErrorMessage error={list.error} retry={() => list.refetch()} />}
      {list.data && list.data.items.length === 0 && (
        <EmptyState
          title={scope === 'upcoming' ? 'Aucun rendez-vous à venir' : 'Aucun historique'}
          description="Trouvez un salon et réservez votre prochain créneau."
          action={
            <Link to="/recherche" className="btn-primary">
              Trouver un salon
            </Link>
          }
        />
      )}
      {list.data && (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.data.items.map((b) => (
            <li key={b.id}>
              <BookingCard
                booking={b}
                title={b.salon.name}
                subtitle={`${b.salon.city}${b.staff ? ` · avec ${b.staff.displayName}` : ''}`}
                actions={
                  <>
                    <Link to={`/s/${b.salon.slug}`} className="btn-ghost px-3 py-1 text-sm">
                      Voir le salon
                    </Link>
                    {canModify(b) && (
                      <>
                        <button type="button" className="btn-ghost px-3 py-1 text-sm" aria-expanded={rescheduling === b.id} onClick={() => setRescheduling((v) => (v === b.id ? null : b.id))}>
                          Reporter
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-3 py-1 text-sm"
                          disabled={cancel.isPending}
                          onClick={() => {
                            if (window.confirm('Annuler cette réservation ?')) cancel.mutate({ id: b.id });
                          }}
                        >
                          Annuler
                        </button>
                      </>
                    )}
                    {b.status === 'completed' && <ReviewForm booking={b} />}
                    {rescheduling === b.id && <RescheduleForm booking={b} onDone={() => setRescheduling(null)} />}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
