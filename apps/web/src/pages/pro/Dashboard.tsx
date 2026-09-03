import { Link } from 'react-router';
import { useProBookingMutations, useProPendingBookings, useProSalon, useProStats } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import { BookingCard } from '@/components/BookingCard';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export function Dashboard() {
  const { data } = useProSalon();
  const salon = data?.salon;
  const stats = useProStats();
  const pending = useProPendingBookings();
  const { setStatus, cancel } = useProBookingMutations();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Bonjour, {salon?.name}</h1>
        <Link to="/pro/agenda" className="btn-primary">
          Ouvrir l'agenda
        </Link>
      </header>
      {!salon?.isPublished && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          Votre salon n'est pas encore visible. <Link to="/pro/salon" className="underline">Publiez-le</Link> dès que vos services et horaires sont prêts.
        </div>
      )}
      {stats.isPending ? (
        <Spinner inline />
      ) : stats.isError ? (
        <ErrorMessage error={stats.error} retry={() => stats.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Aujourd'hui" value={stats.data.todayCount} />
          <Stat label="En attente" value={stats.data.pendingCount} />
          <Stat label="Cette semaine" value={stats.data.weekCount} />
          <Stat label="Chiffre d'affaires (semaine)" value={formatDA(stats.data.weekRevenueDa)} />
        </div>
      )}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Demandes à confirmer</h2>
        <ErrorMessage error={setStatus.error ?? cancel.error} />
        {pending.isPending ? (
          <Spinner inline />
        ) : pending.data?.items.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {pending.data.items.slice(0, 6).map((b) => (
              <li key={b.id}>
                <BookingCard
                  booking={b}
                  title={b.clientName}
                  subtitle={b.staff ? `avec ${b.staff.displayName}` : undefined}
                  actions={
                    <>
                      <button type="button" className="btn-primary px-3 py-1 text-sm" onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })} disabled={setStatus.isPending}>
                        Confirmer
                      </button>
                      <button type="button" className="btn-danger px-3 py-1 text-sm" onClick={() => cancel.mutate({ id: b.id })} disabled={cancel.isPending}>
                        Refuser
                      </button>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Aucune demande en attente.</p>
        )}
      </section>
    </div>
  );
}
