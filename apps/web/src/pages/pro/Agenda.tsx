import { useMemo, useState, type FormEvent } from 'react';
import { useProBookingMutations, useProBookings, useProSalon } from '@salondz/api-client';
import { DAY_LABELS_SHORT_FR, addDaysToKey, dayOfWeekFromKey, formatDA, formatTimeDZ, localDateTimeToISO, toLocalDateKey, weekKeys } from '@salondz/constants';
import type { BookingWithStaff, SalonOwnerView } from '@salondz/types';
import { WeekStrip } from '@/components/WeekStrip';
import { StatusBadge } from '@/components/StatusBadge';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Field } from '@/components/Field';
import { dayNumber } from '@/lib/format';

function toDateKey(iso: string): string {
  return toLocalDateKey(new Date(iso));
}

function BookingActions({ b }: { b: BookingWithStaff }) {
  const { setStatus, cancel } = useProBookingMutations();
  const busy = setStatus.isPending || cancel.isPending;
  return (
    <div className="flex flex-wrap gap-1">
      {b.status === 'pending' && (
        <button type="button" className="btn-primary px-2 py-0.5 text-xs" disabled={busy} onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}>
          Confirmer
        </button>
      )}
      {b.status === 'confirmed' && (
        <>
          <button type="button" className="btn-ghost px-2 py-0.5 text-xs" disabled={busy} onClick={() => setStatus.mutate({ id: b.id, status: 'completed' })}>
            Terminé
          </button>
          <button type="button" className="btn-ghost px-2 py-0.5 text-xs" disabled={busy} onClick={() => setStatus.mutate({ id: b.id, status: 'no_show' })}>
            Absent
          </button>
        </>
      )}
      {(b.status === 'pending' || b.status === 'confirmed') && (
        <button
          type="button"
          className="btn-danger px-2 py-0.5 text-xs"
          disabled={busy}
          onClick={() => {
            const reason = window.prompt('Motif (facultatif) :') ?? undefined;
            cancel.mutate({ id: b.id, reason: reason || undefined });
          }}
        >
          Annuler
        </button>
      )}
    </div>
  );
}

function BookingChip({ b, compact = false }: { b: BookingWithStaff; compact?: boolean }) {
  const tone = b.status === 'cancelled' || b.status === 'no_show' ? 'opacity-50 line-through' : '';
  return (
    <div className={`rounded-lg border border-line bg-surface p-2 text-xs ${tone}`}>
      <p className="font-medium">
        {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)}
      </p>
      <p className="truncate">{b.clientName}</p>
      {!compact && (
        <>
          <p className="truncate text-muted">
            {b.serviceName} · {formatDA(b.priceDa)}
          </p>
          <div className="mt-1 flex items-center justify-between gap-1">
            <StatusBadge status={b.status} />
          </div>
          <div className="mt-1">
            <BookingActions b={b} />
          </div>
        </>
      )}
    </div>
  );
}

function WalkInForm({ salon, date, onDone }: { salon: SalonOwnerView; date: string; onDone: () => void }) {
  const { createWalkIn } = useProBookingMutations();
  const activeServices = salon.services.filter((s) => s.isActive);
  const activeStaff = salon.staff.filter((s) => s.isActive);
  const [serviceId, setServiceId] = useState(activeServices[0]?.id ?? '');
  const [staffId, setStaffId] = useState(activeStaff[0]?.id ?? '');
  const [time, setTime] = useState('10:00');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await createWalkIn.mutateAsync({
      serviceId,
      staffId,
      startsAt: localDateTimeToISO(date, time),
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || undefined,
      source: 'walk_in',
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card grid gap-3 p-4 sm:grid-cols-2">
      <h3 className="font-semibold sm:col-span-2">Ajouter un rendez-vous ({date})</h3>
      <Field label="Service" required>
        {(id) => (
          <select id={id} className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {activeServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatDA(s.priceDa)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Membre" required>
        {(id) => (
          <select id={id} className="input" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {activeStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Heure" required>{(id) => <input id={id} type="time" step={300} className="input" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
      <Field label="Client" required>{(id) => <input id={id} className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} required />}</Field>
      <Field label="Téléphone">{(id) => <input id={id} type="tel" className="input" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="05 51 23 45 67" />}</Field>
      <div className="flex items-end gap-2">
        <button type="submit" className="btn-primary" disabled={createWalkIn.isPending || !serviceId || !staffId}>
          Ajouter
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Fermer
        </button>
      </div>
      <ErrorMessage error={createWalkIn.error} className="sm:col-span-2" />
    </form>
  );
}

export function Agenda() {
  const { data } = useProSalon();
  const salon = data?.salon ?? null;
  const today = toLocalDateKey();
  const [date, setDate] = useState(today);
  const [weekOf, setWeekOf] = useState(today);
  const [view, setView] = useState<'day' | 'week'>('day');
  const [showWalkIn, setShowWalkIn] = useState(false);

  const days = weekKeys(weekOf);
  const from = view === 'day' ? date : days[0]!;
  const to = view === 'day' ? date : days[6]!;
  const bookings = useProBookings({ from, to, limit: 200 }, !!salon);

  const byStaff = useMemo(() => {
    const map = new Map<string, BookingWithStaff[]>();
    for (const b of bookings.data?.items ?? []) map.set(b.staffId, [...(map.get(b.staffId) ?? []), b]);
    return map;
  }, [bookings.data]);

  const byDay = useMemo(() => {
    const map = new Map<string, BookingWithStaff[]>();
    for (const b of bookings.data?.items ?? []) {
      const k = toDateKey(b.startsAt);
      map.set(k, [...(map.get(k) ?? []), b]);
    }
    return map;
  }, [bookings.data]);

  if (!salon) return <Spinner />;
  const activeStaff = salon.staff.filter((s) => s.isActive);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <div className="flex gap-2">
          <button type="button" className={view === 'day' ? 'chip-active' : 'chip'} onClick={() => setView('day')}>
            Jour
          </button>
          <button type="button" className={view === 'week' ? 'chip-active' : 'chip'} onClick={() => setView('week')}>
            Semaine
          </button>
          <button type="button" className="btn-primary px-3 py-1 text-sm" onClick={() => setShowWalkIn((v) => !v)}>
            + Rendez-vous
          </button>
        </div>
      </header>

      <WeekStrip
        weekOf={weekOf}
        selected={date}
        onSelect={(d) => {
          setDate(d);
          setView('day');
        }}
        onWeekChange={(w) => {
          setWeekOf(w);
          setDate(w);
        }}
      />

      {showWalkIn && <WalkInForm salon={salon} date={date} onDone={() => setShowWalkIn(false)} />}

      {bookings.isPending && <Spinner inline />}
      {bookings.isError && <ErrorMessage error={bookings.error} retry={() => bookings.refetch()} />}

      {view === 'day' ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, activeStaff.length)}, minmax(0, 1fr))` }}>
          {activeStaff.map((m) => (
            <section key={m.id} className="card flex flex-col gap-2 p-3">
              <h2 className="font-semibold">{m.displayName}</h2>
              {(byStaff.get(m.id) ?? []).length === 0 && <p className="text-xs text-muted">Aucun rendez-vous.</p>}
              {(byStaff.get(m.id) ?? []).map((b) => (
                <BookingChip key={b.id} b={b} />
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 overflow-x-auto">
          {days.map((d) => (
            <section key={d} className={`card flex min-w-24 flex-col gap-1 p-2 ${d === today ? 'border-primary' : ''}`}>
              <button type="button" className="text-left text-xs font-semibold" onClick={() => { setDate(d); setView('day'); }}>
                {DAY_LABELS_SHORT_FR[dayOfWeekFromKey(d)]} {dayNumber(d)}
              </button>
              {(byDay.get(d) ?? []).map((b) => (
                <BookingChip key={b.id} b={b} compact />
              ))}
            </section>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">
        Semaine du {dayNumber(days[0]!)} au {dayNumber(days[6]!)} · {addDaysToKey(days[0]!, 0)} → {days[6]}
      </p>
    </div>
  );
}
