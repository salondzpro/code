import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, queryKeys, useAvailability, useCreateBooking, useMe, useSalon } from '@salondz/api-client';
import { addDaysToKey, dayOfWeekFromKey, formatDA, formatDateLongDZ, formatTimeDZ, toLocalDateKey } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import type { AvailabilitySlot, BookingWithSalon, Service } from '@salondz/types';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { WeekStrip } from '@/components/WeekStrip';
import { TimeSlotGrid } from '@/components/TimeSlotGrid';
import { Field } from '@/components/Field';
import { EmptyState } from '@/components/EmptyState';

const PENDING_KEY = 'salondz:pendingBooking';
interface PendingBooking {
  slug: string;
  serviceId: string;
  date: string;
  startsAt: string;
  staffId: string | null;
}

function readPending(slug: string): PendingBooking | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingBooking;
    return p.slug === slug ? p : null;
  } catch {
    return null;
  }
}

export function BookingFlow() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const { session } = useAuth();
  const qc = useQueryClient();
  const salon = useSalon(slug);
  const me = useMe(!!session);
  const create = useCreateBooking();

  const pending = useMemo(() => readPending(slug), [slug]);
  const [serviceId, setServiceId] = useState<string>(pending?.serviceId ?? params.get('service') ?? '');
  const today = toLocalDateKey();
  const [date, setDate] = useState<string>(pending?.date ?? today);
  const [weekOf, setWeekOf] = useState<string>(pending?.date ?? today);
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [staffId, setStaffId] = useState<string | null>(pending?.staffId ?? null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingWithSalon | null>(null);

  const s = salon.data;
  const service: Service | undefined = s?.services.find((x) => x.id === serviceId);
  const availability = useAvailability(s?.id ?? '', { serviceId, date, staffId: staffId ?? undefined });

  // Restaure le créneau choisi avant connexion
  useEffect(() => {
    if (pending && availability.data && !slot) {
      const found = availability.data.slots.find((x) => x.startsAt === pending.startsAt);
      if (found) setSlot(found);
      sessionStorage.removeItem(PENDING_KEY);
    }
  }, [pending, availability.data, slot]);

  useEffect(() => {
    setSlot(null);
  }, [date, serviceId, staffId]);

  if (salon.isPending) return <Spinner label="Chargement…" />;
  if (salon.isError || !s) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;

  const maxDate = addDaysToKey(today, s.bookingHorizonDays);
  const closedDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.openingHours.some((h) => h.dayOfWeek === d && !h.isClosed));
  const profile = me.data?.profile;
  const needName = !profile?.fullName;
  const needPhone = !profile?.phone;
  const loginNext = encodeURIComponent(`/s/${slug}/reserver`);

  const savePendingAndLogin = () => {
    if (slot && service) {
      const p: PendingBooking = { slug, serviceId, date, startsAt: slot.startsAt, staffId };
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!slot || !service) return;
    setFormError(null);
    let clientPhone: string | undefined;
    if (needPhone) {
      const parsed = phoneDZ.safeParse(phone);
      if (!parsed.success) return setFormError('Numéro de téléphone algérien invalide (ex : 05 51 23 45 67).');
      clientPhone = parsed.data;
    }
    if (needName && name.trim().length < 2) return setFormError('Indiquez votre nom.');
    try {
      const b = await create.mutateAsync({
        salonId: s.id,
        serviceId,
        staffId,
        startsAt: slot.startsAt,
        notes: notes.trim() || undefined,
        clientName: needName ? name.trim() : undefined,
        clientPhone,
      });
      setDone(b);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'SLOT_TAKEN' || err.code === 'TOO_SOON')) {
        setSlot(null);
        qc.invalidateQueries({ queryKey: queryKeys.availability(s.id, { serviceId, date, staffId: staffId ?? undefined }) });
      }
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          title={done.status === 'confirmed' ? 'Réservation confirmée !' : 'Demande envoyée'}
          description={`${done.salon.name} · ${done.serviceName} · ${formatDateLongDZ(done.startsAt)} à ${formatTimeDZ(done.startsAt)}${done.status === 'pending' ? ' — le salon doit confirmer.' : ''}`}
          action={
            <div className="flex gap-2">
              <Link to="/compte/reservations" className="btn-primary">
                Mes réservations
              </Link>
              <Link to={`/s/${slug}`} className="btn-ghost">
                Retour au salon
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <Link to={`/s/${slug}`} className="text-sm text-muted underline">
          ← {s.name}
        </Link>
        <h1 className="text-2xl font-bold">Réserver</h1>
      </header>

      {/* Étape 1 : service */}
      <section className="card p-4">
        <h2 className="mb-3 font-semibold">1. Service</h2>
        <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Service">
          {s.services.map((sv) => (
            <li key={sv.id}>
              <button
                type="button"
                role="radio"
                aria-checked={sv.id === serviceId}
                onClick={() => setServiceId(sv.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${sv.id === serviceId ? 'border-primary bg-primary/5' : 'border-line hover:bg-bg'}`}
              >
                <span>
                  <span className="font-medium">{sv.name}</span>
                  <span className="block text-sm text-muted">{formatDuration(sv.durationMinutes)}</span>
                </span>
                <span className="font-semibold">{formatDA(sv.priceDa)}</span>
              </button>
            </li>
          ))}
        </ul>
        {s.staff.length > 1 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Avec</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={staffId === null ? 'chip-active' : 'chip'} onClick={() => setStaffId(null)}>
                N'importe qui
              </button>
              {s.staff.map((m) => (
                <button key={m.id} type="button" className={staffId === m.id ? 'chip-active' : 'chip'} onClick={() => setStaffId(m.id)}>
                  {m.displayName}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Étape 2 : date + créneau */}
      {service && (
        <section className="card flex flex-col gap-4 p-4">
          <h2 className="font-semibold">2. Date et heure</h2>
          <WeekStrip weekOf={weekOf} selected={date} onSelect={setDate} onWeekChange={setWeekOf} minDate={today} maxDate={maxDate} disabledDays={closedDays} />
          {closedDays.includes(dayOfWeekFromKey(date)) ? (
            <p className="text-sm text-muted">Le salon est fermé ce jour-là.</p>
          ) : availability.isPending ? (
            <Spinner label="Recherche des créneaux…" inline />
          ) : availability.isError ? (
            <ErrorMessage error={availability.error} retry={() => availability.refetch()} />
          ) : availability.data.slots.length === 0 ? (
            <p className="text-sm text-muted">Plus de créneau disponible ce jour. Essayez un autre jour.</p>
          ) : (
            <TimeSlotGrid slots={availability.data.slots} selected={slot?.startsAt ?? null} onSelect={setSlot} />
          )}
        </section>
      )}

      {/* Étape 3 : confirmation */}
      {service && slot && (
        <section className="card flex flex-col gap-4 p-4">
          <h2 className="font-semibold">3. Confirmation</h2>
          <p className="text-sm">
            <strong>{service.name}</strong> · {formatDateLongDZ(slot.startsAt)} à {formatTimeDZ(slot.startsAt)} · {formatDA(service.priceDa)}
          </p>
          {!session ? (
            <Link to={`/connexion?next=${loginNext}`} onClick={savePendingAndLogin} className="btn-primary self-start">
              Se connecter pour confirmer
            </Link>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              {needName && (
                <Field label="Votre nom" required>
                  {(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
                </Field>
              )}
              {needPhone && (
                <Field label="Téléphone" hint="Le salon pourra vous joindre en cas d'imprévu." required>
                  {(id) => <input id={id} className="input" type="tel" inputMode="tel" placeholder="05 51 23 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />}
                </Field>
              )}
              <Field label="Remarque (facultatif)">
                {(id) => <input id={id} className="input" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />}
              </Field>
              {formError && <p className="text-sm text-danger">{formError}</p>}
              <ErrorMessage error={create.error} />
              <button type="submit" className="btn-primary self-start" disabled={create.isPending}>
                {create.isPending ? 'Réservation…' : s.autoConfirm ? 'Confirmer la réservation' : 'Envoyer la demande'}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
