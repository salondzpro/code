/**
 * Espace pro — Nouveau rendez-vous. Refonte du 28 oct. 2026 : TROIS étapes numérotées, sur une
 * seule page, dans l'ordre d'un appel téléphonique — QUI (le client), QUOI (les prestations,
 * en tuiles touchées directement sur la page, sans feuille à ouvrir), QUAND (membre, jour, puis
 * créneaux en GRILLE par période : matin, après-midi, soir — tout est visible, rien ne défile
 * de côté). Chaque étape faite prend une coche. La barre du bas récapitule (total, jour, plage
 * horaire) : l'heure n'est écrite qu'à cet endroit, jamais répétée dans la page.
 *
 * Les prestations précèdent l'heure parce que la durée décide des créneaux possibles.
 *
 * Le client se cherche AVANT de se saisir : la moitié des rendez-vous pris au téléphone
 * sont ceux d'habitués, et retaper leur nom crée des doublons dans la clientèle.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Check, Search, StickyNote, UserPlus } from 'lucide-react';
import {
  pagesItems,
  useProBookingMutations,
  useProBookings,
  useProClientsInfinite,
  useProSalon,
} from '@salondz/api-client';
import {
  addDaysToKey,
  dayOfWeekFromKey,
  formatDA,
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
  Segmented,
  Skeleton,
  TopBar, Dim } from '@/components/ui';
import { DayScroller } from '@/components/DayCarousel';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { PageLoading } from '@/components/PageLoading';
import { SuccessSplash } from '@/components/SuccessSplash';
import { formatDuration } from '@/lib/format';
import { t } from '@/i18n';

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
    if (newName.trim().length < 2) return setErr(t("Indiquez le nom du client."));
    let p: string | undefined;
    if (newPhone.trim()) {
      const parsed = phoneDZ.safeParse(newPhone);
      if (!parsed.success) return setErr(t("Numéro invalide (ex : 05 51 23 45 67)."));
      p = parsed.data;
    }
    onPick(newName.trim(), p ?? '');
  };
  return (
    <>
      <Dim onClose={onClose} className="!z-[45]" />
      <BottomSheet modal className="!z-50 max-h-[90vh] overflow-y-auto">
        <div className="h2 text-center !text-[1.143rem]">{t("Client")}</div>
        <SearchBox value={q} onChange={setQ} placeholder={t("Rechercher dans ma clientèle")} autoFocus />
        {clients.isPending ? (
          <Skeleton className="h-[6rem] w-full !rounded-[var(--radius-card)]" />
        ) : rows.length > 0 ? (
          <div className="crd !gap-0 !py-1">
            {rows.map((c) => (
              <button
                key={c.clientKey}
                type="button"
                className="li w-full text-start"
                onClick={() => onPick(c.name, c.phone ?? '')}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={c.name} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-[1rem] font-semibold">{c.name}</span>
                    <span className="block text-[0.857rem] text-muted">
                      {c.phone ? formatDZPhone(c.phone) : t('Sans numéro')} · {t('{n} rendez-vous', { n: c.bookingsCount })}
                    </span>
                  </span>
                </span>
                {c.name === name && (c.phone ?? '') === phone && <I icon={Check} size={20} />}
              </button>
            ))}
          </div>
        ) : (
          <p className="p">
            {needle ? t('Aucun client pour « {q} ».', { q: needle }) : t('Votre clientèle apparaîtra ici.')}
          </p>
        )}
        <span className="h3">{t("Client de passage")}</span>
        <div className="g2">
          <Field label={t("Nom *")} htmlFor="nc-name">
            <Input
              id="nc-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setErr(null);
              }}
              placeholder={t("Mohamed B.")}
              aria-required
            />
          </Field>
          <Field label={t("Téléphone")} htmlFor="nc-phone">
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
        <Button onClick={validate}>{t("Valider")}</Button>
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
  const [sheet, setSheet] = useState<'client' | null>(null);
  // Rendez-vous créé : validation animée, puis fiche du rendez-vous.
  const [done, setDone] = useState<{ id: string } | null | false>(false);
  // Rendez-vous déjà pris ce jour-là (pour griser les créneaux du membre choisi).
  const dayBookings = useProBookings({ from: date, to: date, limit: 200 }, !!salon);
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

  /**
   * Ouvert sans date imposée (bouton « + »), un soir ou un jour de fermeture : on partait sur
   * « 23:00 · Salon fermé ce jour — heure libre ». On saute UNE fois au prochain jour d'ouverture,
   * où le premier créneau libre est pris par l'effet ci-dessus. Une date venue de l'agenda
   * (toucher un vide) est respectée telle quelle.
   */
  const sauteAuProchainJour = useRef(!params.get('date'));
  useEffect(() => {
    if (!salon || !sauteAuProchainJour.current || dayBookings.isPending) return;
    sauteAuProchainJour.current = false;
    if (date !== toLocalDateKey() || slots.length > 0) return;
    for (let i = 1; i <= 14; i++) {
      const d = addDaysToKey(date, i);
      if (salon.openingHours.some((h) => h.dayOfWeek === dayOfWeekFromKey(d) && !h.isClosed)) {
        setDate(d);
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salon, dayBookings.isPending]);

  // Période affichée (matin, après-midi, soir) : celle de l'heure choisie, sauf si l'on en
  // touche une autre pour regarder.
  const periods = PERIODS.filter((pd) => slots.some((x) => periodOf(x.t) === pd.value));
  const [period, setPeriod] = useState<Period>(periodOf(time));
  useEffect(() => setPeriod(periodOf(time)), [time, date]);
  const shownPeriod = periods.some((pd) => pd.value === period) ? period : periods[0]?.value;
  const [serviceQ, setServiceQ] = useState('');
  const [allServices, setAllServices] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  if (!salon) return <PageLoading />;

  const submit = async () => {
    const errs: typeof fieldErr = {};
    if (name.trim().length < 2) errs.name = 'Indiquez le client.';
    if (services.length === 0) errs.services = 'Choisissez au moins une prestation.';
    setFieldErr(errs);
    if (errs.name) return setSheet('client');
    if (errs.services)
      return document.getElementById('nb-services')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setError(null);
    try {
      // Plusieurs prestations = UN rendez-vous, comme côté client : un seul bloc dans l'agenda,
      // une seule ligne dans l'historique, une seule chose à annuler ou à déplacer.
      const b = await createWalkIn.mutateAsync({
        serviceIds: chosen.map((s) => s!.id),
        staffId: staffId || staff[0]!.id,
        startsAt: localDateTimeToISO(date, time),
        clientName: name.trim(),
        clientPhone: phone || undefined,
        notes: notes.trim() || undefined,
        source: 'walk_in',
      });
      setDone(b);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const q = serviceQ.trim().toLowerCase();
  const filtered = q ? active.filter((sv) => sv.name.toLowerCase().includes(q)) : active;
  // Au-delà de huit prestations, on montre les huit premières (et toutes celles déjà cochées).
  const visible =
    allServices || q || filtered.length <= SERVICES_PREVIEW
      ? filtered
      : filtered.filter((sv, i) => i < SERVICES_PREVIEW || services.includes(sv.id));
  const hidden = filtered.length - visible.length;
  const toggleService = (id: string) => {
    setServices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setFieldErr((f) => ({ ...f, services: undefined }));
  };
  const clientDone = name.trim().length >= 2;

  return (
    <Screen bottom={SHEET_PAD} gap={12}>
      <TopBar backTo="/pro/agenda" close />
      <h1 className="h1 !text-[1.714rem]">{t('Nouveau rendez-vous')}</h1>

      {/* 1. QUI */}
      <section className="crd !gap-2.5" aria-labelledby="nb-s1">
        <StepHead n={1} id="nb-s1" title={t('Client')} done={clientDone} />
        <button
          type="button"
          className={`nb-pick ${fieldErr.name ? 'err' : ''}`}
          onClick={() => setSheet('client')}
          aria-invalid={!!fieldErr.name || undefined}
        >
          {clientDone ? (
            <>
              <Avatar name={name} size={36} />
              <span className="min-w-0 flex-1 text-start">
                <span className="block truncate text-[1rem] font-semibold">{name}</span>
                <span className="block text-[0.857rem] text-muted" dir="ltr">
                  {phone ? formatDZPhone(phone) : t('Sans numéro')}
                </span>
              </span>
              <span className="text-[0.857rem] font-semibold text-muted">{t('Changer')}</span>
            </>
          ) : (
            <>
              <span className="nb-pick-i">
                <I icon={Search} size={18} />
              </span>
              <span className="min-w-0 flex-1 truncate text-start text-[1rem] text-subtle">
                {t('Rechercher ou ajouter un client')}
              </span>
              <I icon={UserPlus} size={18} className="shrink-0 text-muted" />
            </>
          )}
        </button>
        {fieldErr.name && (
          <p className="text-[0.857rem] text-danger" role="alert">
            {fieldErr.name}
          </p>
        )}
      </section>

      {/* 2. QUOI — tuiles touchées directement ; plusieurs = UN rendez-vous */}
      <section id="nb-services" className="crd !gap-2.5" aria-labelledby="nb-s2">
        <StepHead
          n={2}
          id="nb-s2"
          title={t('Prestations')}
          done={chosen.length > 0}
        />
        {active.length > SERVICES_PREVIEW && (
          <SearchBox value={serviceQ} onChange={setServiceQ} placeholder={t('Rechercher une prestation')} />
        )}
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('Prestations')}>
          {visible.map((sv) => {
            const on = services.includes(sv.id);
            return (
              <button
                key={sv.id}
                type="button"
                aria-pressed={on}
                className={`nb-svc ${on ? 'on' : ''}`}
                onClick={() => toggleService(sv.id)}
              >
                <span className="nb-svc-n">{sv.name}</span>
                <span className="nb-svc-m">
                  <span dir="ltr">{formatDuration(sv.durationMinutes)}</span> ·{' '}
                  <span dir="ltr">{formatDA(sv.priceDa)}</span>
                </span>
                {on && (
                  <span className="nb-svc-c" aria-hidden>
                    <I icon={Check} size={13} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {q && filtered.length === 0 && (
          <p className="text-[0.857rem] text-muted">{t('Aucune prestation ne correspond.')}</p>
        )}
        {(hidden > 0 || (allServices && !q && active.length > SERVICES_PREVIEW)) && (
          <button
            type="button"
            className="self-start text-[0.857rem] font-semibold text-muted underline-offset-2 hover:underline"
            onClick={() => setAllServices((v) => !v)}
          >
            {hidden > 0 ? t('Voir les {n} autres', { n: hidden }) : t('Réduire')}
          </button>
        )}
        {fieldErr.services && (
          <p className="text-[0.857rem] text-danger" role="alert">
            {fieldErr.services}
          </p>
        )}
      </section>

      {/* 3. QUAND — membre, jour, puis la grille des créneaux de la période */}
      <section className="crd !gap-3" aria-labelledby="nb-s3">
        <StepHead n={3} id="nb-s3" title={t('Quand')} done={chosen.length > 0 && (slots.length === 0 || slots.some((x) => x.t === time && !x.taken))} />
        {staff.length > 1 && (
          <div className="pills -mx-4 !gap-1.5 px-4" role="radiogroup" aria-label={t('Membre')}>
            {staff.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={m.id === sid}
                className={`pill flex-none !gap-2 !py-1 !ps-1 !pe-3 !text-[1rem] font-semibold ${m.id === sid ? 'on' : 'soft'}`}
                onClick={() => setStaffId(m.id)}
              >
                <Avatar src={m.avatarUrl} name={m.displayName} size={24} /> {m.displayName}
              </button>
            ))}
          </div>
        )}
        <DayScroller selected={date} onSelect={setDate} minDate={toLocalDateKey()} />
        {/* Appareil sur un autre fuseau : les créneaux restent en heure d'Alger, on le dit. */}
        {!isDeviceOnDZTime() && (
          <p className="text-[0.857rem] text-muted">
            {t("Heures en heure d'Alger · il est")} {nowTimeDZ()} {t('à Alger.')}
          </p>
        )}
        {slots.length === 0 ? (
          <label className="nb-free">
            <span className="min-w-0 text-[1rem] text-muted">{t('Salon fermé ce jour — heure libre')}</span>
            <input
              type="time"
              step={300}
              min={date === toLocalDateKey() ? ceilToStep(nowTimeDZ(), 5) : undefined}
              className="inp mono !w-auto !py-2 text-center"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label={t('Heure')}
            />
          </label>
        ) : (
          <>
            {periods.length > 1 && shownPeriod && (
              <Segmented
                sm
                label={t('Moment de la journée')}
                value={shownPeriod}
                onChange={setPeriod}
                options={periods.map((pd) => ({ value: pd.value, label: t(pd.label) }))}
              />
            )}
            <div className="grid grid-cols-4 gap-1.5" role="listbox" aria-label={t('Heure')}>
              {slots
                .filter((sl) => periodOf(sl.t) === shownPeriod)
                .map((sl) => (
                  <button
                    key={sl.t}
                    type="button"
                    role="option"
                    aria-selected={sl.t === time}
                    disabled={sl.taken}
                    className={`slot mono !py-2.5 !text-[1rem] font-semibold ${sl.t === time ? 'on' : sl.taken ? 'off line-through' : ''}`}
                    onClick={() => setTime(sl.t)}
                  >
                    {sl.t}
                  </button>
                ))}
            </div>
          </>
        )}
      </section>

      {/* Note : repliée tant qu'on n'en a pas besoin — la plupart des rendez-vous n'en ont pas. */}
      {noteOpen ? (
        <div className="crd !gap-1.5">
          <label htmlFor="nb-note" className="text-[0.857rem] font-semibold text-muted">
            {t('Note (facultatif)')}
          </label>
          <textarea
            id="nb-note"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            rows={2}
            autoFocus
            placeholder={t('Coloration à préparer, cliente pressée…')}
            className="inp !p-2.5 !text-[1rem]"
            style={{ resize: 'none' }}
          />
        </div>
      ) : (
        <button type="button" className="nb-add" onClick={() => setNoteOpen(true)}>
          <I icon={StickyNote} size={16} /> {t('Ajouter une note')}
        </button>
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
      {done !== false && (
        <SuccessSplash
          title={t('Rendez-vous ajouté')}
          subtitle={`${name.trim()} · ${relativeDayLabelDZ(date)} · ${time}`}
          onDone={() =>
            navigate(done ? `/pro/rendez-vous/${done.id}` : '/pro/agenda', { replace: true })
          }
        />
      )}
      {/* Récapitulatif : le seul endroit où l'heure est écrite. */}
      <BottomSheet>
        {error && (
          <p className="mb-2 text-[0.857rem] text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[1.429rem] font-semibold leading-tight tracking-[-0.4px]" dir="ltr">
              {formatDA(total)}
            </div>
            <div className="truncate text-[0.857rem] text-muted">
              {relativeDayLabelDZ(date)} ·{' '}
              <span className="mono" dir="ltr">
                {time}
                {minutes ? `–${endTime}` : ''}
              </span>
              {minutes ? (
                <>
                  {' · '}
                  <span dir="ltr">{formatDuration(minutes)}</span>
                </>
              ) : null}
            </div>
          </div>
          <Button auto className="!px-6" onClick={() => void submit()} loading={createWalkIn.isPending}>
            {t('Enregistrer')}
          </Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}

const SERVICES_PREVIEW = 8;

type Period = 'morning' | 'afternoon' | 'evening';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'morning', label: 'Matin' },
  { value: 'afternoon', label: 'Après-midi' },
  { value: 'evening', label: 'Soir' },
];
const periodOf = (hhmm: string): Period => {
  const m = timeToMinutes(hhmm);
  return m < 12 * 60 ? 'morning' : m < 17 * 60 ? 'afternoon' : 'evening';
};

/** En-tête d'étape : numéro (coche une fois faite), titre, et une précision à droite. */
function StepHead({
  n,
  id,
  title,
  done,
  right,
}: {
  n: number;
  id: string;
  title: string;
  done: boolean;
  right?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`nb-n ${done ? 'on' : ''}`} aria-hidden>
        {done ? <I icon={Check} size={14} /> : n}
      </span>
      <h2 id={id} className="min-w-0 flex-1 text-[1.143rem] font-semibold">
        {title}
      </h2>
      {right && <span className="text-[0.857rem] font-medium text-muted">{right}</span>}
    </div>
  );
}
