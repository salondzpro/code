import { useProBookingMutations, useProPendingBookings } from '@salondz/api-client';
import { BookingCard } from '@/components/BookingCard';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';

export function Requests() {
  const pending = useProPendingBookings();
  const { setStatus, cancel } = useProBookingMutations();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Demandes en attente</h1>
      <ErrorMessage error={setStatus.error ?? cancel.error} />
      {pending.isPending && <Spinner />}
      {pending.isError && <ErrorMessage error={pending.error} retry={() => pending.refetch()} />}
      {pending.data && pending.data.items.length === 0 && <EmptyState title="Tout est à jour" description="Aucune demande à confirmer." />}
      {pending.data && (
        <ul className="grid gap-3 md:grid-cols-2">
          {pending.data.items.map((b) => (
            <li key={b.id}>
              <BookingCard
                booking={b}
                title={b.clientName}
                subtitle={`${b.clientPhone ?? 'Sans téléphone'}${b.staff ? ` · avec ${b.staff.displayName}` : ''}`}
                actions={
                  <>
                    <button type="button" className="btn-primary px-3 py-1 text-sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}>
                      Confirmer
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-3 py-1 text-sm"
                      disabled={cancel.isPending}
                      onClick={() => {
                        const reason = window.prompt('Motif (facultatif) :') ?? undefined;
                        cancel.mutate({ id: b.id, reason: reason || undefined });
                      }}
                    >
                      Refuser
                    </button>
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
