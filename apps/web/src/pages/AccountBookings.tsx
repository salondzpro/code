import { useState } from 'react';
import { Link } from 'react-router';
import { useCancelBooking, useCreateReview, useMyBookings } from '@salondz/api-client';
import { CLIENT_CANCEL_MIN_HOURS } from '@salondz/constants';
import type { BookingWithSalon } from '@salondz/types';
import { BookingCard } from '@/components/BookingCard';
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

export function AccountBookings() {
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const list = useMyBookings({ scope });
  const cancel = useCancelBooking();

  const canCancel = (b: BookingWithSalon) =>
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
                    {canCancel(b) && (
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
                    )}
                    {b.status === 'completed' && <ReviewForm booking={b} />}
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
