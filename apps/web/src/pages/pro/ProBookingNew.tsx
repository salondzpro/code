/**
 * Espace pro — Nouveau rendez-vous (client de passage ou téléphone), pensé pour le quotidien : d'abord QUAND
 * (jours à faire défiler, heure en grand, créneaux du jour en un tap — ceux déjà pris par le membre sont grisés),
 * puis les prestations, puis le client. Le membre se choisit en pastilles.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Check } from 'lucide-react';
import { useProBookingMutations, useProBookings, useProSalon } from '@salondz/api-client';
import {
  dayOfWeekFromKey,
  formatDA,
  formatDateShortDZ,
  localDateTimeToISO,
  minutesToTime,
  relativeDayLabelDZ,
  timeToMinutes,
  toLocalDateKey,
  isPastSlot,
  ceilToStep,
  nowTimeDZ,
} from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { errorText } from '@/components/ErrorMessage';
import { BottomSheet, Button, Field, I, Input, TopBar } from '@/components/ui';
import { DayScroller } from '@/components/DayCarousel';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { formatDuration } from '@/lib/format';

export function ProBookingNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const salon = useProSalon().data?.salon ?? null;
  const { createWalkIn } = useProBookingMutations();
  const [name, setName] = useState(params.get('name') ?? '');
  const [phone, setPhone] = useState(params.get('phone') ?? '');
  const [services, setServices] = useState<string[]>([]);
  const [date, setDate] = useState(params.get('date') ?? toLocalDateKey());
  const [time, setTime] = useState(
    /^\d{2}:\d{2}$/.test(params.get('time') ?? '') ? params.get('time')! : '10:00',
  );
  const [staffId, setStaffId] = useState<string>(params.get('staff') ?? '');
  const [error, setError] = useState<string | null>(null);
  // Rendez-vous déjà pris ce jour-là (pour griser les créneaux du membre choisi).
  const dayBookings = useProBookings({ from: date, to: date, limit: 200 }, !!salon);
  const timeStrip = useRef<HTMLDivElement | null>(null);
  if (!salon) return <Splash />;
  const active = salon.services.filter((s) => s.isActive);
  const staff = salon.staff.filter((s) => s.isActive);
  const chosen = services.map((id) => active.find((s) => s.id === id)).filter(Boolean);
  const total = chosen.reduce((a, s) => a + (s?.priceDa ?? 0), 0);
  const minutes = chosen.reduce((a, s) => a + (s?.durationMinutes ?? 0), 0);
  const sid = staffId || staff[0]?.id || '';
  const dow = dayOfWeekFromKey(date);
  const hours = salon.openingHours.filter((h) => h.dayOfWeek === dow && !h.isClosed);
  const step = salon.slotIntervalMinutes || 15;
  const need = Math.max(minutes, step);
  // Créneaux du jour : toutes les heures d'ouverture au pas du salon ; pris = chevauche un rendez-vous du membre.
  const slots = hours.flatMap((h) => {
    const out: { t: string; taken: boolean }[] = [];
    for (let m = timeToMinutes(h.opensAt); m + need <= timeToMinutes(h.closesAt); m += step) {
      const t = minutesToTime(m);
      const startIso = localDateTimeToISO(date, t);
      const endMs = new Date(startIso).getTime() + need * 60_000;
      const taken = (dayBookings.data?.items ?? []).some(
        (b) =>
          (b.status === 'pending' || b.status === 'confirmed') &&
          b.staffId === sid &&
          new Date(b.startsAt).getTime() < endMs &&
          new Date(b.endsAt).getTime() > new Date(startIso).getTime(),
      );
      // Jamais le passé : un créneau déjà commencé n'est pas proposé.
      if (!isPastSlot(date, t)) out.push({ t, taken });
    }
    return out;
  });
  const endTime = minutesToTime(timeToMinutes(time) + minutes);
  const firstFree = slots.find((x) => !x.taken)?.t ?? slots[0]?.t;
  useEffect(() => {
    if (
      slots.length > 0 &&
      (isPastSlot(date, time) || !slots.some((x) => x.t === time)) &&
      firstFree
    )
      setTime(firstFree);
    else if (slots.length === 0 && isPastSlot(date, time)) setTime(ceilToStep(nowTimeDZ(), 5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, slots.length, firstFree]);

  useEffect(() => {
    const el = timeStrip.current?.querySelector<HTMLElement>(`[data-time="${time}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [time, date]);

  const submit = async () => {
    if (name.trim().length < 2) return setError('Indiquez le nom du client.');
    if (services.length === 0) return setError('Choisissez au moins une prestation.');
    let clientPhone: string | undefined;
    if (phone.trim()) {
      const parsed = phoneDZ.safeParse(phone);
      if (!parsed.success) return setError('Numéro invalide (ex : 05 51 23 45 67).');
      clientPhone = parsed.data;
    }
    setError(null);
    try {
      // Plusieurs prestations : enchaînées à la suite, même membre.
      let start = localDateTimeToISO(date, time);
      let first: { id: string } | null = null;
      for (const s of chosen) {
        const b = await createWalkIn.mutateAsync({
          serviceId: s!.id,
          staffId: staffId || staff[0]!.id,
          startsAt: start,
          clientName: name.trim(),
          clientPhone,
          source: 'walk_in',
        });
        first ??= b;
        start = b.endsAt;
      }
      navigate(first ? `/pro/rendez-vous/${first.id}` : '/pro/agenda', { replace: true });
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo="/pro/agenda" right="Nouveau rendez-vous" />
      <h1 className="h1">Ajouter un rendez-vous</h1>

      {/* 1. QUAND — jours à faire défiler, heure en grand, créneaux du jour en un tap */}
      <div className="crd !gap-3">
        <DayScroller selected={date} onSelect={setDate} minDate={toLocalDateKey()} />
        <div className="flex items-end justify-between gap-3">
          <span className="mono text-[2rem] font-bold leading-none tracking-[-0.9px]">
            {time}{' '}
            <span className="text-[1rem] font-medium text-muted">
              {minutes ? `→ ${endTime}` : ''}
            </span>
          </span>
          <span className="text-right text-[0.9375rem] font-semibold">
            {relativeDayLabelDZ(date)}
            {/* « Aujourd'hui » / « Demain » : on rappelle la date ; sinon le libellé est déjà la date. */}
            {!/^\p{L}+\. \d/u.test(relativeDayLabelDZ(date)) && (
              <span className="block text-[0.8125rem] font-normal text-muted">
                {formatDateShortDZ(localDateTimeToISO(date, '12:00')).replace(/^\w/, (c) =>
                  c.toUpperCase(),
                )}
              </span>
            )}
          </span>
        </div>
        {slots.length === 0 ? (
          <label className="flex items-center justify-between gap-3 text-[0.9375rem]">
            <span className="text-muted">Salon fermé ce jour — heure libre</span>
            <input
              type="time"
              step={300}
              min={date === toLocalDateKey() ? ceilToStep(nowTimeDZ(), 5) : undefined}
              className="bg-transparent text-right outline-none"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Heure"
            />
          </label>
        ) : (
          <div
            ref={timeStrip}
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5"
            style={{ scrollbarWidth: 'none' }}
            role="listbox"
            aria-label="Heure"
          >
            {slots.map((sl) => (
              <button
                key={sl.t}
                type="button"
                role="option"
                aria-selected={sl.t === time}
                aria-label={sl.t}
                data-time={sl.t}
                disabled={sl.taken}
                className={`pill mono flex-none !px-3.5 !py-2.5 !text-[1rem] font-semibold ${sl.t === time ? 'on' : sl.taken ? 'soft !text-disabled line-through' : '!border-ink'}`}
                onClick={() => setTime(sl.t)}
              >
                {sl.t}
              </button>
            ))}
          </div>
        )}
        {staff.length > 1 && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Membre">
            {staff.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={m.id === sid}
                className={`pill !px-3.5 !py-2 !text-[0.875rem] font-semibold ${m.id === sid ? 'on' : 'soft'}`}
                onClick={() => setStaffId(m.id)}
              >
                {m.displayName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Prestations */}
      <span className="lbl">Prestations</span>
      <div className="crd !gap-0 !py-1">
        {active.map((s) => {
          const on = services.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className="li w-full !py-3 text-left"
              onClick={() =>
                setServices((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
              }
              aria-pressed={on}
            >
              <span>
                <span className="block text-[1rem] font-semibold">{s.name}</span>
                <span className="p block text-[0.9375rem]">
                  {formatDuration(s.durationMinutes)} · {formatDA(s.priceDa)}
                </span>
              </span>
              <span className={`chk${on ? ' on' : ''}`} aria-hidden>
                {on && <I icon={Check} size={16} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Client */}
      <Field label="Client" htmlFor="nb-name">
        <Input
          id="nb-name"
          lg
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mohamed B."
        />
      </Field>
      <Field label="Téléphone (facultatif)" htmlFor="nb-phone">
        <Input
          id="nb-phone"
          lg
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="05 51 23 45 67"
        />
      </Field>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <BottomSheet>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[1.25rem] font-bold tracking-[-0.4px]">{formatDA(total)}</div>
            <div className="p truncate">
              {relativeDayLabelDZ(date)} · {time}
              {chosen.length
                ? ` · ${chosen.length} prestation${chosen.length > 1 ? 's' : ''} · ${formatDuration(minutes)}`
                : ' · choisissez une prestation'}
            </div>
          </div>
          <Button
            auto
            className="!rounded-full !px-7 !py-3.5"
            onClick={() => void submit()}
            disabled={createWalkIn.isPending}
          >
            Ajouter
          </Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}
