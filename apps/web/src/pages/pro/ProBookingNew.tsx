/**
 * Espace pro — Nouveau rendez-vous, sur le modèle des outils du métier (Planity Pro) :
 * d'abord QUAND (jours à faire défiler, heure en grand, créneaux du jour en un tap — ceux
 * déjà pris par le membre sont grisés, membre en pastilles), puis un formulaire en LIGNES
 * qui s'ouvrent en feuille : le client (recherche parmi la clientèle, ou client de passage),
 * les prestations (cochées dans une liste), une note. « Enregistrer » en bas, avec le total.
 *
 * Le client se cherche AVANT de se saisir : la moitié des rendez-vous pris au téléphone
 * sont ceux d'habitués, et retaper leur nom crée des doublons dans la clientèle.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Check, ChevronRight, ContactRound, Scissors, StickyNote } from 'lucide-react';
import {
  pagesItems,
  useProBookingMutations,
  useProBookings,
  useProClientsInfinite,
  useProSalon,
} from '@salondz/api-client';
import {
  dayOfWeekFromKey,
  formatDA,
  formatDateShortDZ,
  formatDZPhone,
  localDateTimeToISO,
  minutesToTime,
  relativeDayLabelDZ,
  timeToMinutes,
  toLocalDateKey,
  isPastSlot,
  ceilToStep,
  nowTimeDZ,
  isDeviceOnDZTime,
} from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { errorText } from '@/components/ErrorMessage';
import {
  Avatar,
  BottomSheet,
  Button,
  Field,
  I,
  Input,
  SearchBox,
  Skeleton,
  TopBar,
} from '@/components/ui';
import { DayScroller } from '@/components/DayCarousel';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { SuccessSplash } from '@/components/SuccessSplash';
import { formatDuration } from '@/lib/format';
import type { LucideIcon } from 'lucide-react';

/** Ligne du formulaire : icône, libellé, valeur choisie (ou invitation), chevron. */
function FormRow({
  icon,
  label,
  value,
  placeholder,
  error,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
  placeholder: string;
  error?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="li w-full text-left"
      onClick={onClick}
      aria-invalid={!!error || undefined}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${error ? 'bg-cancel-bg text-danger' : 'bg-fill text-muted'}`}
        >
          <I icon={icon} size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-[0.857rem] text-muted">{label}</span>
          <span className={`block truncate text-[1rem] font-semibold ${value ? '' : 'text-subtle'}`}>
            {value || placeholder}
          </span>
          {error && <span className="block text-[0.857rem] text-danger">{error}</span>}
        </span>
      </span>
      <I icon={ChevronRight} size={18} className="shrink-0 text-disabled" />
    </button>
  );
}

/** Feuille « Client » : la clientèle d'abord (recherche serveur), sinon un client de passage. */
function ClientSheet({
  name,
  phone,
  onPick,
  onClose,
}: {
  name: string;
  phone: string;
  onPick: (name: string, phone: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [needle, setNeedle] = useState('');
  const [newName, setNewName] = useState(name);
  const [newPhone, setNewPhone] = useState(phone);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setNeedle(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);
  const clients = useProClientsInfinite(needle);
  const rows = pagesItems(clients.data).slice(0, 8);
  const validate = () => {
    if (newName.trim().length < 2) return setErr('Indiquez le nom du client.');
    let p: string | undefined;
    if (newPhone.trim()) {
      const parsed = phoneDZ.safeParse(newPhone);
      if (!parsed.success) return setErr('Numéro invalide (ex : 05 51 23 45 67).');
      p = parsed.data;
    }
    onPick(newName.trim(), p ?? '');
  };
  return (
    <>
      <div className="dim !z-[45]" onClick={onClose} />
      <BottomSheet className="!z-50 max-h-[90vh] overflow-y-auto">
        <div className="h2 text-center !text-[1.143rem]">Client</div>
        <SearchBox value={q} onChange={setQ} placeholder="Rechercher dans ma clientèle" autoFocus />
        {clients.isPending ? (
          <Skeleton className="h-[6rem] w-full !rounded-[var(--radius-card)]" />
        ) : rows.length > 0 ? (
          <div className="crd !gap-0 !py-1">
            {rows.map((c) => (
              <button
                key={c.clientKey}
                type="button"
                className="li w-full text-left"
                onClick={() => onPick(c.name, c.phone ?? '')}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={c.name} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-[1rem] font-semibold">{c.name}</span>
                    <span className="block text-[0.857rem] text-muted">
                      {c.phone ? formatDZPhone(c.phone) : 'Sans numéro'} · {c.bookingsCount}{' '}
                      rendez-vous
                    </span>
                  </span>
                </span>
                {c.name === name && (c.phone ?? '') === phone && <I icon={Check} size={20} />}
              </button>
            ))}
          </div>
        ) : (
          <p className="p">
            {needle ? `Aucun client pour « ${needle} ».` : 'Votre clientèle apparaîtra ici.'}
          </p>
        )}
        <span className="h3">Client de passage</span>
        <div className="g2">
          <Field label="Nom *" htmlFor="nc-name">
            <Input
              id="nc-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setErr(null);
              }}
              placeholder="Mohamed B."
              aria-required
            />
          </Field>
          <Field label="Téléphone" htmlFor="nc-phone">
            <Input
              id="nc-phone"
              type="tel"
              inputMode="tel"
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value);
                setErr(null);
              }}
              placeholder="05 51 23 45 67"
            />
          </Field>
        </div>
        {err && (
          <p className="text-[1rem] text-danger" role="alert">
            {err}
          </p>
        )}
        <Button onClick={validate}>Valider</Button>
      </BottomSheet>
    </>
  );
}

/** Feuille « Prestations » : cases à cocher, plusieurs prestations s'enchaînent. */
function ServicesSheet({
  services,
  value,
  onChange,
  onClose,
}: {
  services: { id: string; name: string; durationMinutes: number; priceDa: number }[];
  value: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [ids, setIds] = useState(value);
  const chosen = ids.map((id) => services.find((s) => s.id === id)).filter(Boolean);
  const total = chosen.reduce((a, s) => a + (s?.priceDa ?? 0), 0);
  const minutes = chosen.reduce((a, s) => a + (s?.durationMinutes ?? 0), 0);
  return (
    <>
      <div className="dim !z-[45]" onClick={onClose} />
      <BottomSheet className="!z-50 max-h-[90vh] overflow-y-auto">
        <div className="h2 text-center !text-[1.143rem]">Prestations</div>
        <div className="crd !gap-0 !py-1">
          {services.map((s) => {
            const on = ids.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className="li w-full text-left"
                aria-pressed={on}
                onClick={() =>
                  setIds((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-[1rem] font-semibold">{s.name}</span>
                  <span className="block text-[0.857rem] text-muted">
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
        <Button
          disabled={ids.length === 0}
          onClick={() => {
            onChange(ids);
            onClose();
          }}
        >
          {ids.length
            ? `Valider · ${formatDuration(minutes)} · ${formatDA(total)}`
            : 'Choisissez une prestation'}
        </Button>
      </BottomSheet>
    </>
  );
}

export function ProBookingNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const salon = useProSalon().data?.salon ?? null;
  const { createWalkIn } = useProBookingMutations();
  const [name, setName] = useState(params.get('name') ?? '');
  const [phone, setPhone] = useState(params.get('phone') ?? '');
  const [services, setServices] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(params.get('date') ?? toLocalDateKey());
  const [time, setTime] = useState(
    /^\d{2}:\d{2}$/.test(params.get('time') ?? '') ? params.get('time')! : '10:00',
  );
  const [staffId, setStaffId] = useState<string>(params.get('staff') ?? '');
  const [error, setError] = useState<string | null>(null);
  // Erreurs affichées sur la ligne concernée (client obligatoire, prestation).
  const [fieldErr, setFieldErr] = useState<{ name?: string; services?: string }>({});
  const [sheet, setSheet] = useState<'client' | 'services' | null>(null);
  // Rendez-vous créé : validation animée, puis fiche du rendez-vous.
  const [done, setDone] = useState<{ id: string } | null | false>(false);
  // Rendez-vous déjà pris ce jour-là (pour griser les créneaux du membre choisi).
  const dayBookings = useProBookings({ from: date, to: date, limit: 200 }, !!salon);
  const timeStrip = useRef<HTMLDivElement | null>(null);
  const active = useMemo(() => salon?.services.filter((s) => s.isActive) ?? [], [salon]);
  const staff = useMemo(() => salon?.staff.filter((s) => s.isActive) ?? [], [salon]);
  const chosen = services.map((id) => active.find((s) => s.id === id)).filter(Boolean);
  const total = chosen.reduce((a, s) => a + (s?.priceDa ?? 0), 0);
  const minutes = chosen.reduce((a, s) => a + (s?.durationMinutes ?? 0), 0);
  const sid = staffId || staff[0]?.id || '';
  const dow = dayOfWeekFromKey(date);
  const hours = salon?.openingHours.filter((h) => h.dayOfWeek === dow && !h.isClosed) ?? [];
  const step = salon?.slotIntervalMinutes || 15;
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

  if (!salon) return <Splash />;

  const submit = async () => {
    const errs: typeof fieldErr = {};
    if (name.trim().length < 2) errs.name = 'Indiquez le client.';
    if (services.length === 0) errs.services = 'Choisissez au moins une prestation.';
    setFieldErr(errs);
    if (errs.name) return setSheet('client');
    if (errs.services) return setSheet('services');
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
          clientPhone: phone || undefined,
          notes: first ? undefined : notes.trim() || undefined,
          source: 'walk_in',
        });
        first ??= b;
        start = b.endsAt;
      }
      setDone(first);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={12}>
      <TopBar backTo="/pro/agenda" close right="Nouveau rendez-vous" />
      <h1 className="h1">Ajouter un rendez-vous</h1>

      {/* 1. QUAND — jours à faire défiler, heure en grand, créneaux du jour en un tap */}
      <div className="crd !gap-3">
        <DayScroller selected={date} onSelect={setDate} minDate={toLocalDateKey()} />
        <div className="flex items-end justify-between gap-3">
          <span className="mono text-[2.286rem] font-semibold leading-none tracking-[-0.9px]">
            {time}{' '}
            <span className="text-[1rem] font-medium text-muted">
              {minutes ? `→ ${endTime}` : ''}
            </span>
          </span>
          <span className="text-right text-[1rem] font-semibold">
            {relativeDayLabelDZ(date)}
            {/* « Aujourd'hui » / « Demain » : on rappelle la date ; sinon le libellé est déjà la date. */}
            {!/^\p{L}+\. \d/u.test(relativeDayLabelDZ(date)) && (
              <span className="block text-[0.857rem] font-normal text-muted">
                {formatDateShortDZ(localDateTimeToISO(date, '12:00')).replace(/^\w/, (c) =>
                  c.toUpperCase(),
                )}
              </span>
            )}
          </span>
        </div>
        {/* Appareil sur un autre fuseau : les créneaux restent en heure d'Alger, on le dit. */}
        {!isDeviceOnDZTime() && (
          <p className="text-[0.857rem] text-muted">
            Heures en heure d'Alger · il est {nowTimeDZ()} à Alger.
          </p>
        )}
        {slots.length === 0 ? (
          <label className="flex items-center justify-between gap-3 text-[1rem]">
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
                className={`slot mono flex-none !px-3.5 !py-2.5 !text-[1rem] font-semibold ${sl.t === time ? 'on' : sl.taken ? 'off line-through' : ''}`}
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
                className={`pill !gap-2 !py-1.5 !pl-1.5 !pr-3.5 !text-[1rem] font-semibold ${m.id === sid ? 'on' : 'soft'}`}
                onClick={() => setStaffId(m.id)}
              >
                <Avatar src={m.avatarUrl} name={m.displayName} size={24} /> {m.displayName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Qui et quoi — des lignes qui s'ouvrent en feuille, comme un formulaire de caisse. */}
      <div className="crd !gap-0 !py-1">
        <FormRow
          icon={ContactRound}
          label="Client"
          value={name ? `${name}${phone ? ` · ${formatDZPhone(phone)}` : ''}` : null}
          placeholder="Choisir ou saisir un client"
          error={fieldErr.name}
          onClick={() => setSheet('client')}
        />
        <FormRow
          icon={Scissors}
          label="Prestations"
          value={
            chosen.length
              ? `${chosen.map((s) => s!.name).join(', ')} · ${formatDuration(minutes)} · ${formatDA(total)}`
              : null
          }
          placeholder="Choisir une ou plusieurs prestations"
          error={fieldErr.services}
          onClick={() => setSheet('services')}
        />
        <div className="li !items-start">
          <span className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-fill text-muted">
              <I icon={StickyNote} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.857rem] text-muted">Note (facultatif)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Coloration à préparer, cliente pressée…"
                className="inp mt-1 !p-2.5 !text-[1rem]"
                style={{ resize: 'none' }}
                aria-label="Note"
              />
            </span>
          </span>
        </div>
      </div>
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}

      {sheet === 'client' && (
        <ClientSheet
          name={name}
          phone={phone}
          onPick={(n, p) => {
            setName(n);
            setPhone(p);
            setFieldErr((f) => ({ ...f, name: undefined }));
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'services' && (
        <ServicesSheet
          services={active}
          value={services}
          onChange={(ids) => {
            setServices(ids);
            setFieldErr((f) => ({ ...f, services: undefined }));
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {done !== false && (
        <SuccessSplash
          title="Rendez-vous ajouté"
          subtitle={`${name.trim()} · ${relativeDayLabelDZ(date)} · ${time}`}
          onDone={() =>
            navigate(done ? `/pro/rendez-vous/${done.id}` : '/pro/agenda', { replace: true })
          }
        />
      )}
      <BottomSheet>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[1.429rem] font-semibold tracking-[-0.4px]">{formatDA(total)}</div>
            <div className="p truncate">
              {relativeDayLabelDZ(date)} · {time}
              {chosen.length
                ? ` · ${chosen.length} prestation${chosen.length > 1 ? 's' : ''} · ${formatDuration(minutes)}`
                : ' · choisissez une prestation'}
            </div>
          </div>
          <Button
            auto
            className="!px-6"
            onClick={() => void submit()}
            disabled={createWalkIn.isPending}
          >
            {createWalkIn.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}
