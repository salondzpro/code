import { useMemo, useState, type FormEvent } from 'react';
import { useProBlockMutations, useProBlocks, useProSalon } from '@salondz/api-client';
import { addDaysToKey, formatDateShortDZ, formatTimeDZ, localDateTimeToISO, toLocalDateKey } from '@salondz/constants';
import { createTimeBlockSchema } from '@salondz/validation';
import type { TimeBlock } from '@salondz/types';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';

/** Fenêtre affichée : aujourd'hui → +90 jours. */
const HORIZON_DAYS = 90;

/** Un blocage « journée entière » commence et finit à minuit (heure d'Alger). */
function isAllDay(b: TimeBlock): boolean {
  return formatTimeDZ(b.startsAt) === '00:00' && formatTimeDZ(b.endsAt) === '00:00';
}

/** « sam. 5 sept. · 12:00 – 14:00 » ou « du sam. 5 sept. au lun. 7 sept. · journées entières ». */
export function describeBlock(b: TimeBlock): string {
  if (isAllDay(b)) {
    const lastDay = new Date(new Date(b.endsAt).getTime() - 60_000); // veille de la fin (exclusive)
    const from = formatDateShortDZ(b.startsAt);
    const to = formatDateShortDZ(lastDay);
    return from === to ? `${from} · journée entière` : `du ${from} au ${to} · journées entières`;
  }
  const sameDay = formatDateShortDZ(b.startsAt) === formatDateShortDZ(b.endsAt);
  return sameDay
    ? `${formatDateShortDZ(b.startsAt)} · ${formatTimeDZ(b.startsAt)} – ${formatTimeDZ(b.endsAt)}`
    : `${formatDateShortDZ(b.startsAt)} ${formatTimeDZ(b.startsAt)} → ${formatDateShortDZ(b.endsAt)} ${formatTimeDZ(b.endsAt)}`;
}

export function Blocks() {
  const { data } = useProSalon();
  const salon = data?.salon ?? null;
  const today = toLocalDateKey();
  const blocks = useProBlocks(today, addDaysToKey(today, HORIZON_DAYS));
  const { create, remove } = useProBlockMutations();

  const [staffId, setStaffId] = useState(''); // '' = tout le salon
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('14:00');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const staffName = useMemo(() => new Map((salon?.staff ?? []).map((m) => [m.id, m.displayName])), [salon]);

  if (!salon) return <Spinner />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (allDay && endDate < startDate) return setFormError('La date de fin doit suivre la date de début.');
    const startsAt = localDateTimeToISO(startDate, allDay ? '00:00' : startTime);
    const endsAt = allDay ? localDateTimeToISO(addDaysToKey(endDate, 1), '00:00') : localDateTimeToISO(startDate, endTime);
    const parsed = createTimeBlockSchema.safeParse({ staffId: staffId || null, startsAt, endsAt, reason: reason.trim() || undefined });
    if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? 'Plage invalide.');
    await create.mutateAsync(parsed.data);
    setReason('');
  };

  const items = blocks.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Congés et pauses</h1>
      <p className="text-sm text-muted">Un blocage retire des créneaux réservables en ligne : fermeture exceptionnelle, congé d'un membre, pause déjeuner, rendez-vous personnel…</p>

      <form onSubmit={submit} className="card grid gap-3 p-4 sm:grid-cols-2">
        <Field label="Concerne" required>
          {(id) => (
            <select id={id} className="input" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Tout le salon</option>
              {salon.staff
                .filter((m) => m.isActive)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
            </select>
          )}
        </Field>
        <Field label="Durée" required>
          {(id) => (
            <div id={id} className="flex gap-2 py-1">
              <button type="button" className={allDay ? 'chip-active' : 'chip'} onClick={() => setAllDay(true)}>
                Journée(s) entière(s)
              </button>
              <button type="button" className={!allDay ? 'chip-active' : 'chip'} onClick={() => setAllDay(false)}>
                Plage horaire
              </button>
            </div>
          )}
        </Field>
        <Field label={allDay ? 'Du' : 'Date'} required>
          {(id) => (
            <input
              id={id}
              type="date"
              className="input"
              min={today}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate < e.target.value) setEndDate(e.target.value);
              }}
              required
            />
          )}
        </Field>
        {allDay ? (
          <Field label="Au (inclus)" required>
            {(id) => <input id={id} type="date" className="input" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />}
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Field label="De" required>
              {(id) => <input id={id} type="time" step={300} className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />}
            </Field>
            <Field label="À" required>
              {(id) => <input id={id} type="time" step={300} className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />}
            </Field>
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="Motif (facultatif)">
            {(id) => <input id={id} className="input" maxLength={120} placeholder="Congé, formation, pause…" value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        </div>
        {formError && <p className="text-sm text-danger sm:col-span-2">{formError}</p>}
        <ErrorMessage error={create.error} className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Ajout…' : 'Ajouter le blocage'}
          </button>
        </div>
      </form>

      <ErrorMessage error={remove.error} />
      {blocks.isPending && <Spinner inline />}
      {blocks.isError && <ErrorMessage error={blocks.error} retry={() => blocks.refetch()} />}
      {blocks.data && items.length === 0 && <EmptyState title="Aucun blocage à venir" description="Vos horaires d'ouverture s'appliquent normalement sur les 90 prochains jours." />}
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((b) => (
            <li key={b.id} className="card flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">{describeBlock(b)}</p>
                <p className="text-sm text-muted">
                  {b.staffId ? (staffName.get(b.staffId) ?? 'Membre') : 'Tout le salon'}
                  {b.reason ? ` · ${b.reason}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="btn-danger px-2 py-1 text-xs"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm('Supprimer ce blocage ?')) remove.mutate(b.id);
                }}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
