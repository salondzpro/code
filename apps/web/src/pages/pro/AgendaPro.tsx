/**
 * PRO-F 24 / 25 / 26 — Agenda, sur le modèle des outils du métier (Planity Pro) :
 * vue jour en COLONNES, une par membre de l'équipe, heures à gauche, blocs colorés par
 * catégorie, ligne « maintenant » ; un tap sur un vide crée un rendez-vous à cette heure
 * pour ce membre. Vue semaine (colonnes de jours) et vue mois (points) inchangées.
 *
 * Un rendez-vous s'ouvre en FENÊTRE (`BookingPeekSheet`) : l'agenda reste derrière, à sa
 * date et sa position.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProBlocks, useProBookings, useProSalon } from '@salondz/api-client';
import {
  DAY_LABELS_FR,
  DAY_LABELS_SHORT_FR,
  addDaysToKey,
  categoryTone,
  dayOfWeekFromKey,
  formatDA,
  formatTimeDZ,
  timeToMinutes,
  toLocalDateKey,
  weekKeys,
  minutesToTime,
} from '@salondz/constants';
import { BookingPeekSheet } from '@/components/BookingPeekSheet';
import { useShowCancelled, useStaffFilter } from '@/lib/proPrefs';
import { StaffFilter } from '@/components/StaffFilter';
import { formatDuration } from '@/lib/format';
import {
  Avatar,
  Badge,
  I,
  IconButton,
  Segmented,
  StatusBadge,
  cancelledLabel,
  Pill,
} from '@/components/ui';
import { DayCarousel, DayScroller } from '@/components/DayCarousel';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import type { BookingWithStaff } from '@salondz/types';
import { ErrorMessage } from '@/components/ErrorMessage';
import { t } from '@/i18n';

type View = 'day' | 'week' | 'month';
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const TONE: Record<string, string> = {
  hair: 'bg-cat-hair-bg border-cat-hair-line text-cat-hair-fg',
  barb: 'bg-cat-barb-bg border-cat-barb-line text-cat-barb-fg',
  nail: 'bg-cat-nail-bg border-cat-nail-line text-cat-nail-fg',
  lash: 'bg-cat-lash-bg border-cat-lash-line text-cat-lash-fg',
  skin: 'bg-cat-skin-bg border-cat-skin-line text-cat-skin-fg',
  lasr: 'bg-cat-lasr-bg border-cat-lasr-line text-cat-lasr-fg',
};
const DOT: Record<string, string> = {
  hair: '#38aeb5',
  barb: '#6d8fe8',
  nail: '#d97898',
  lash: '#8a63d8',
  skin: '#55a873',
  lasr: '#d88c52',
};

/** Hauteur d'une heure : 72 px, pour qu'un rendez-vous de 15 min reste un bloc lisible (18 px). */
const PX = 72 / 60;
/** Largeur de la gouttière des heures. */
const GUTTER = '2.75rem';

const localKey = (iso: string) => toLocalDateKey(new Date(iso));
const localMinutes = (iso: string) => timeToMinutes(formatTimeDZ(iso));
const nowMinutes = () => timeToMinutes(formatTimeDZ(new Date().toISOString()));
const hm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Une colonne du planning : un membre, ou toute l'équipe (`id` nul). */
interface Column {
  id: string | null;
  name: string;
  avatarUrl: string | null;
}

export function AgendaPro() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState(today);
  const week = useMemo(() => weekKeys(date), [date]);
  const monthStart = `${date.slice(0, 7)}-01`;
  const monthGridStart = addDaysToKey(monthStart, -dayOfWeekFromKey(monthStart));
  // Fenêtre de chargement : la période affichée ± 1 (les panneaux voisins du carrousel sont déjà remplis).
  const from = view === 'month' ? addDaysToKey(monthGridStart, -42) : addDaysToKey(week[0]!, -7);
  const to = view === 'month' ? addDaysToKey(monthGridStart, 83) : addDaysToKey(week[6]!, 7);
  const prevMonth = addDaysToKey(monthStart, -1).slice(0, 8) + '01';
  const nextMonth = addDaysToKey(monthStart, 32).slice(0, 8) + '01';
  const gridStartOf = (d: string) => {
    const ms = `${d.slice(0, 7)}-01`;
    return addDaysToKey(ms, -dayOfWeekFromKey(ms));
  };
  const bookings = useProBookings({ from, to, limit: 200 }, !!salon);
  const blocks = useProBlocks(from, to);
  // Une journée vide et une requête en échec ne se ressemblent pas : l'échec s'affiche, avec relance.
  const loadError = bookings.isError ? bookings : blocks.isError ? blocks : null;
  // Un rendez-vous s'ouvre en fenêtre : l'agenda reste derrière, à sa date et sa position.
  const [peek, setPeek] = useState<string | null>(null);

  const toneOf = (b: BookingWithStaff) =>
    categoryTone(salon?.services.find((s) => s.id === b.serviceId)?.categoryId);
  const [staffId, setStaffId] = useStaffFilter();
  // Annulés masqués par défaut (planning réel) ; à la demande, ils apparaissent en pointillés avec qui a annulé.
  const [showCancelled, setShowCancelled] = useShowCancelled();
  const items = useMemo(
    () =>
      (bookings.data?.items ?? []).filter(
        (b) => (showCancelled || b.status !== 'cancelled') && (!staffId || b.staffId === staffId),
      ),
    [bookings.data, staffId, showCancelled],
  );
  // La pastille « N annulés » ne parle que du jour affiché : le compte de toute la fenêtre
  // chargée (trois semaines) n'aurait aucun sens sous une date.
  const cancelledOn = (d: string) =>
    (bookings.data?.items ?? []).filter(
      (b) =>
        b.status === 'cancelled' && localKey(b.startsAt) === d && (!staffId || b.staffId === staffId),
    ).length;
  const byDay = useMemo(() => {
    const m = new Map<string, BookingWithStaff[]>();
    for (const b of items) m.set(localKey(b.startsAt), [...(m.get(localKey(b.startsAt)) ?? []), b]);
    return m;
  }, [items]);

  if (!salon) return <Splash />;
  const closedDays = [0, 1, 2, 3, 4, 5, 6].filter(
    (d) => !salon.openingHours.some((h) => h.dayOfWeek === d && !h.isClosed),
  );
  const dayHours = (key: string) =>
    salon.openingHours.filter((h) => h.dayOfWeek === dayOfWeekFromKey(key) && !h.isClosed);

  /**
   * Colonnes de la vue jour : une par membre actif (comme les outils du métier), ou un seul
   * membre quand on a touché son nom ; un salon sans équipe n'a qu'une colonne.
   */
  const team = [...salon.staff.filter((m) => m.isActive)].sort((a, b) => a.sortOrder - b.sortOrder);
  const picked = team.find((m) => m.id === staffId) ?? null;
  const columns: Column[] =
    team.length < 2
      ? [{ id: null, name: salon.name, avatarUrl: null }]
      : (picked ? [picked] : team).map((m) => ({
          id: m.id,
          name: m.displayName,
          avatarUrl: m.avatarUrl,
        }));

  const shift = (n: number) =>
    setDate(
      view === 'month'
        ? addDaysToKey(monthStart, n > 0 ? 32 : -1).slice(0, 8) + '01'
        : addDaysToKey(date, n * (view === 'week' ? 7 : 1)),
    );

  // ---- en-tête : la période, ses flèches, le retour à aujourd'hui ----
  const sub =
    view === 'day'
      ? `${date === today ? `${t("Aujourd'hui")} · ` : date === addDaysToKey(today, 1) ? `${t('Demain')} · ` : ''}${t(DAY_LABELS_FR[dayOfWeekFromKey(date)])}`
      : view === 'week'
        ? `${t('Semaine')} ${isoWeek(date)} · ${t(MONTHS[Number(week[0]!.slice(5, 7)) - 1]!)} ${week[0]!.slice(0, 4)}`
        : date.slice(0, 4);
  const title =
    view === 'day'
      ? `${Number(date.slice(8, 10))} ${t(MONTHS[Number(date.slice(5, 7)) - 1]!)}`
      : view === 'week'
        ? `${Number(week[0]!.slice(8, 10))} – ${Number(week[6]!.slice(8, 10))} ${t(MONTHS[Number(week[6]!.slice(5, 7)) - 1]!)}`
        : t(MONTHS[Number(date.slice(5, 7)) - 1]!).replace(/^\w/, (c) => c.toUpperCase());

  return (
    <Screen bottom={NAV_PAD} gap={12}>
      {loadError && <ErrorMessage error={loadError.error} retry={() => void loadError.refetch()} />}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[0.857rem] text-muted">{sub}</div>
          <h1 className="h1 whitespace-nowrap">{title}</h1>
        </div>
        <div className="flex flex-none gap-2">
          <IconButton aria-label={t("Précédent")} onClick={() => shift(-1)}>
            <I icon={ChevronLeft} size={20} />
          </IconButton>
          <IconButton aria-label={t("Suivant")} onClick={() => shift(1)}>
            <I icon={ChevronRight} size={20} />
          </IconButton>
          {/* Retour à aujourd'hui : n'apparaît que lorsqu'on s'en est éloigné. */}
          {date !== today && (
            <IconButton ink aria-label={t("Aujourd'hui")} title={t("Aujourd'hui")} onClick={() => setDate(today)}>
              <I icon={CalendarCheck} size={20} />
            </IconButton>
          )}
        </div>
      </div>
      <Segmented
        sm
        label={t("Vue")}
        value={view}
        onChange={setView}
        options={[
          { value: 'day', label: t("Jour") },
          { value: 'week', label: t("Semaine") },
          { value: 'month', label: t("Mois") },
        ]}
      />

      {view === 'day' && (
        <>
          <DayScroller selected={date} onSelect={setDate} disabledDays={closedDays} />
          {team.length >= 2 && (
            <StaffColumnsHead
              columns={columns}
              picked={picked?.id ?? null}
              onPick={(id) => setStaffId(staffId === id ? null : id)}
              onAll={() => setStaffId(null)}
            />
          )}
          <DayCarousel
            date={date}
            onChange={setDate}
            render={(d) => {
              const all = (byDay.get(d) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
              const live = all.filter((b) => b.status !== 'cancelled');
              const cancelled = all.filter((b) => b.status === 'cancelled');
              const revenue = live
                .filter((b) => b.status !== 'no_show')
                .reduce((a, b) => a + b.priceDa, 0);
              const pending = live.filter((b) => b.status === 'pending').length;
              const dayBlk = (blocks.data?.items ?? []).filter((t) => localKey(t.startsAt) === d);
              return (
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[1rem]">
                      <b>{t('{n} rendez-vous', { n: live.length })}</b>{' '}
                      <span className="text-muted">· {formatDA(revenue)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {pending > 0 && (
                        <Badge tone="pd" md>
                          {pending} {t("en attente")}
                        </Badge>
                      )}
                      {(showCancelled ? cancelled.length : cancelledOn(d)) > 0 && (
                        <Pill on={showCancelled} onClick={() => setShowCancelled(!showCancelled)}>
                          {t('{n} annulé(s)', { n: showCancelled ? cancelled.length : cancelledOn(d) })}
                        </Pill>
                      )}
                    </span>
                  </div>
                  <DayColumns
                    date={d}
                    columns={columns}
                    items={live}
                    cancelled={cancelled}
                    blocks={dayBlk}
                    hours={dayHours(d)}
                    step={salon.slotIntervalMinutes || 15}
                    toneOf={toneOf}
                    onOpen={setPeek}
                    onFree={(t, sid) =>
                      navigate(
                        `/pro/rendez-vous/nouveau?date=${d}&time=${t}${sid ? `&staff=${sid}` : ''}`,
                      )
                    }
                  />
                </div>
              );
            }}
          />
        </>
      )}

      {view !== 'day' && (
        <StaffFilter staff={salon.staff} value={staffId} onChange={setStaffId} />
      )}

      {view === 'week' && (
        <DayCarousel
          date={date}
          prev={addDaysToKey(date, -7)}
          next={addDaysToKey(date, 7)}
          onChange={setDate}
          render={(d) => (
            <WeekGrid
              week={weekKeys(d)}
              byDay={byDay}
              closedDays={closedDays}
              salonHours={salon.openingHours}
              toneOf={toneOf}
              selected={date}
              onSelect={(x) => {
                setDate(x);
                setView('day');
              }}
            />
          )}
        />
      )}

      {view === 'month' && (
        <DayCarousel
          date={date}
          prev={prevMonth}
          next={nextMonth}
          onChange={setDate}
          render={(d) => (
            <MonthGrid
              date={d}
              gridStart={gridStartOf(d)}
              byDay={byDay}
              closedDays={closedDays}
              toneOf={toneOf}
              selected={date}
              today={today}
              onSelect={setDate}
              onOpenDay={(x) => {
                setDate(x);
                setView('day');
              }}
              onOpen={setPeek}
            />
          )}
        />
      )}
      {peek && <BookingPeekSheet id={peek} onClose={() => setPeek(null)} />}
    </Screen>
  );
}

function isoWeek(key: string): number {
  const d = new Date(`${key}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(((d.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
  );
}

/**
 * En-tête des colonnes : un membre par colonne (avatar, prénom). Il reste COLLÉ sous
 * l'en-tête de l'application pendant le défilement : à 11 h on doit encore savoir quelle
 * colonne est celle de qui. Il vit hors du carrousel, car un ancêtre défilant casse le
 * `sticky` — et il est identique pour les trois panneaux.
 */
function StaffColumnsHead({
  columns,
  picked,
  onPick,
  onAll,
}: {
  columns: Column[];
  picked: string | null;
  onPick: (id: string) => void;
  onAll: () => void;
}) {
  return (
    <div className="sticky z-20 -mx-4 bg-bg px-4" style={{ top: '3.5rem' }}>
      <div className="flex items-stretch border-b border-line">
        <div className="flex-none" style={{ width: GUTTER }} />
        {columns.map((c) => (
          <button
            key={c.id ?? 'all'}
            type="button"
            aria-pressed={picked === c.id}
            onClick={() => c.id && onPick(c.id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 py-1.5 ${picked ? '' : 'flex-col gap-1'}`}
            title={c.name}
          >
            <Avatar src={c.avatarUrl} name={c.name} size={picked ? 24 : 28} />
            <span className="max-w-full truncate text-[0.857rem] font-semibold">
              {picked ? c.name : c.name.split(' ')[0]}
            </span>
          </button>
        ))}
        {picked && (
          <button type="button" className="pill !my-1 !py-1.5" onClick={onAll}>
            {t("Toute l'équipe")}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Vue jour en colonnes : la gouttière des heures à gauche, une colonne par membre.
 * Le vide se touche pour créer un rendez-vous à cette heure, pour ce membre ; les plages
 * fermées (pause, blocage) sont hachurées et ne répondent pas.
 */
function DayColumns({
  date,
  columns,
  items,
  cancelled = [],
  blocks,
  hours,
  step,
  toneOf,
  onOpen,
  onFree,
}: {
  date: string;
  columns: Column[];
  items: BookingWithStaff[];
  /** Rendez-vous annulés du jour (pointillés, avec qui a annulé). */
  cancelled?: BookingWithStaff[];
  blocks: { startsAt: string; endsAt: string; reason: string | null; staffId?: string | null }[];
  hours: { opensAt: string; closesAt: string }[];
  /** Pas des créneaux du salon : le tap sur un vide s'y aligne. */
  step: number;
  toneOf: (b: BookingWithStaff) => string;
  onOpen: (id: string) => void;
  onFree: (timeHM: string, staffId: string | null) => void;
}) {
  const isToday = date === toLocalDateKey();
  const now = nowMinutes();
  // Aujourd'hui : on amène l'heure actuelle au centre de l'écran à l'ouverture (suivi de la journée en direct).
  const nowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isToday) return;
    const t = window.setTimeout(
      () => nowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      150,
    );
    return () => window.clearTimeout(t);
  }, [isToday, date]);

  if (hours.length === 0 && items.length === 0)
    return <p className="p py-6 text-center">{t("Fermé ce jour.")}</p>;
  const startMin = Math.min(
    ...(hours.length ? hours.map((h) => timeToMinutes(h.opensAt)) : [8 * 60]),
    ...items.map((b) => localMinutes(b.startsAt)),
  );
  const endMin = Math.max(
    ...(hours.length ? hours.map((h) => timeToMinutes(h.closesAt)) : [19 * 60]),
    ...items.map((b) => localMinutes(b.endsAt)),
  );
  const top = (m: number) => (m - startMin) * PX;
  const height = (endMin - startMin) * PX + 16;
  const hourMarks: number[] = [];
  for (let m = Math.ceil(startMin / 60) * 60; m <= endMin; m += 60) hourMarks.push(m);
  const halfMarks: number[] = [];
  for (let m = Math.ceil(startMin / 30) * 30; m <= endMin; m += 30)
    if (m % 60 !== 0) halfMarks.push(m);

  // Plages fermées : pauses (toutes colonnes) et blocages (tout le salon, ou un seul membre).
  const closed: { s: number; e: number; label: string; staffId: string | null }[] = [];
  const sortedHours = [...hours].sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  for (let i = 1; i < sortedHours.length; i++)
    closed.push({
      s: timeToMinutes(sortedHours[i - 1]!.closesAt),
      e: timeToMinutes(sortedHours[i]!.opensAt),
      label: t("Pause"),
      staffId: null,
    });
  for (const t of blocks)
    closed.push({
      s: Math.max(startMin, localMinutes(t.startsAt)),
      e: Math.min(endMin, localMinutes(t.endsAt)),
      label: t.reason ?? 'Blocage',
      staffId: t.staffId ?? null,
    });
  const narrow = columns.length > 1;
  const inCol = (col: Column, staffId: string | null) => col.id === null || col.id === staffId;

  /** Tap sur un vide : l'heure sous le doigt, alignée au pas du salon, si elle est libre. */
  const tapFree = (e: MouseEvent<HTMLDivElement>, col: Column) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const m = startMin + Math.floor(y / PX / step) * step;
    if (m < startMin || m + step > endMin) return;
    if (hours.length && !hours.some((h) => timeToMinutes(h.opensAt) <= m && m < timeToMinutes(h.closesAt)))
      return;
    if (isToday && m < now) return;
    const busy = items.some(
      (b) =>
        inCol(col, b.staffId) && localMinutes(b.startsAt) < m + step && localMinutes(b.endsAt) > m,
    );
    if (busy) return;
    if (closed.some((c) => (c.staffId === null || c.staffId === col.id) && c.s < m + step && c.e > m))
      return;
    onFree(minutesToTime(m), col.id);
  };

  return (
    <div className="relative flex" style={{ height }}>
      <div className="relative flex-none" style={{ width: GUTTER }}>
        {hourMarks.map((m) => (
          <span
            key={m}
            className="mono absolute end-2 -translate-y-1/2 text-[0.857rem] text-subtle"
            style={{ top: top(m) }}
          >
            {hm(m)}
          </span>
        ))}
      </div>
      <div className="relative flex flex-1">
        <div className="pointer-events-none absolute inset-0">
          {hourMarks.map((m) => (
            <div key={m} className="absolute start-0 end-0 border-t border-line" style={{ top: top(m) }} />
          ))}
          {halfMarks.map((m) => (
            <div
              key={m}
              className="absolute start-0 end-0 border-t border-dashed border-line-soft"
              style={{ top: top(m) }}
            />
          ))}
        </div>
        {columns.map((col) => (
          <div
            key={col.id ?? 'all'}
            className="agcol"
            onClick={(e) => tapFree(e, col)}
            role="presentation"
          >
            {closed
              .filter((c) => c.staffId === null || c.staffId === col.id)
              .map((c) => (
                <div
                  key={`c-${c.s}-${c.label}`}
                  className="agoff"
                  style={{ top: top(c.s) + 1, height: Math.max(18, (c.e - c.s) * PX - 2) }}
                  title={`${c.label} · ${hm(c.s)} – ${hm(c.e)}`}
                >
                  {c.label}
                  {!narrow && ` · ${hm(c.s)} – ${hm(c.e)}`}
                </div>
              ))}
            {cancelled
              .filter((b) => inCol(col, b.staffId))
              .map((b) => {
                const s = localMinutes(b.startsAt);
                const e = localMinutes(b.endsAt);
                if (e <= startMin || s >= endMin) return null;
                const h = Math.max(22, (e - s) * PX - 2);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpen(b.id);
                    }}
                    className="agb cn"
                    style={{ top: top(s) + 1, height: h }}
                    aria-label={`${b.clientName} · ${cancelledLabel(b.cancelledBy, 'pro', b.cancellationKind)}`}
                  >
                    <span className="block truncate text-[0.857rem] font-semibold line-through">
                      {b.clientName}
                      {!narrow && ` · ${b.serviceName}`}
                    </span>
                    {h >= 32 && (
                      <span className="block truncate text-[0.857rem]">
                        {cancelledLabel(b.cancelledBy, 'pro', b.cancellationKind)}
                      </span>
                    )}
                  </button>
                );
              })}
            {items
              .filter((b) => inCol(col, b.staffId))
              .map((b) => {
                const s = localMinutes(b.startsAt);
                const e = localMinutes(b.endsAt);
                const h = Math.max(22, (e - s) * PX - 2);
                const pending = b.status === 'pending';
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpen(b.id);
                    }}
                    className={`agb ${TONE[toneOf(b)]}`}
                    style={{
                      top: top(s) + 1,
                      height: h,
                      // Demande non confirmée : rayures claires par-dessus la teinte, lisibles de loin.
                      backgroundImage: pending
                        ? 'repeating-linear-gradient(135deg, transparent 0 5px, rgb(255 255 255 / 0.5) 5px 10px)'
                        : undefined,
                    }}
                    aria-label={`${formatTimeDZ(b.startsAt)} ${b.clientName} · ${b.serviceName}${pending ? ' · en attente' : ''}`}
                  >
                    {h < 32 ? (
                      <span className="block truncate text-[0.857rem] font-semibold">
                        {b.clientName}
                        {!narrow && ` · ${b.serviceName}`}
                      </span>
                    ) : (
                      <>
                        <span className={`block truncate font-semibold ${narrow ? 'text-[0.857rem]' : 'text-[1rem]'}`}>
                          {b.clientName}
                        </span>
                        <span className="block truncate text-[0.857rem] opacity-90">
                          {b.serviceName}
                        </span>
                        {h >= 50 && (
                          <span className="mono block truncate text-[0.857rem] opacity-80">
                            {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)}
                            {!narrow && ` · ${formatDA(b.priceDa)}`}
                          </span>
                        )}
                        {pending && h >= 72 && (
                          <span className="mt-1 inline-block">
                            <Badge tone="pd" dot={false}>
                              {t("En attente")}
                            </Badge>
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
          </div>
        ))}
        {isToday && (
          // Ligne « maintenant » : dans la journée à sa place ; avant l'ouverture en haut, après la fermeture en bas.
          <div
            ref={nowRef}
            className="pointer-events-none absolute -start-1.5 end-0 z-10 border-t-[1.5px] border-danger"
            style={{ top: top(Math.min(Math.max(now, startMin), endMin)) }}
          >
            <span className="absolute -start-1 -top-[0.3125rem] h-2 w-2 rounded-full bg-danger" />
            <span className="mono absolute end-0 -top-[1.125rem] rounded-full bg-danger px-2 py-0.5 text-[0.857rem] font-semibold text-white">
              {minutesToTime(now)}
              {now > endMin ? ` · ${t('journée terminée')}` : now < startMin ? ` · ${t("avant l'ouverture")}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Vue semaine : 7 colonnes de 09 h à 19 h, blocs par catégorie, jours fermés hachurés. */
function WeekGrid({
  week,
  byDay,
  closedDays,
  salonHours,
  toneOf,
  selected,
  onSelect,
}: {
  week: string[];
  byDay: Map<string, BookingWithStaff[]>;
  closedDays: number[];
  salonHours: { dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean }[];
  toneOf: (b: BookingWithStaff) => string;
  selected: string;
  onSelect: (d: string) => void;
}) {
  const open = salonHours.filter((h) => !h.isClosed);
  const startMin = Math.min(
    ...(open.length ? open.map((h) => timeToMinutes(h.opensAt)) : [9 * 60]),
  );
  const endMin = Math.max(
    ...(open.length ? open.map((h) => timeToMinutes(h.closesAt)) : [19 * 60]),
  );
  const H = 720;
  const px = H / (endMin - startMin);
  const liveOf = (d: string) => (byDay.get(d) ?? []).filter((b) => b.status !== 'cancelled');
  const total = week.reduce((a, d) => a + liveOf(d).length, 0);
  const revenue = week.reduce((a, d) => a + liveOf(d).reduce((x, b) => x + b.priceDa, 0), 0);
  const busyMin = week.reduce(
    (a, d) => a + liveOf(d).reduce((x, b) => x + b.durationMinutes, 0),
    0,
  );
  const openMin = week.reduce(
    (a, d) => a + (closedDays.includes(dayOfWeekFromKey(d)) ? 0 : endMin - startMin),
    0,
  );
  const occupancy = openMin ? Math.round((busyMin / openMin) * 100) : 0;
  const today = toLocalDateKey();
  const hours: number[] = [];
  for (let m = startMin; m <= endMin; m += 120) hours.push(m);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-[0.857rem]">
        <span className="pill soft !py-2 !font-semibold">{t('{n} rendez-vous', { n: total })}</span>
        <Badge tone="ok" md>
          {formatDA(revenue)}
        </Badge>
        <span className="text-muted">{occupancy} {t("% occupé")}</span>
      </div>
      <div className="flex gap-1.5">
        <div className="relative w-[1.625rem] flex-none" style={{ height: H + 56 }}>
          {hours.map((m) => (
            <span
              key={m}
              className="absolute start-0 text-[0.857rem] text-subtle"
              style={{ top: 56 + (m - startMin) * px - 8 }}
            >
              {String(Math.floor(m / 60)).padStart(2, '0')}
            </span>
          ))}
        </div>
        {week.map((d) => {
          const dow = dayOfWeekFromKey(d);
          const closed = closedDays.includes(dow);
          const list = byDay.get(d) ?? [];
          const on = d === selected;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              className="flex min-w-0 flex-1 flex-col items-center gap-2 text-start"
            >
              <span className={`text-[1rem] ${closed ? 'text-disabled' : 'text-muted'}`}>
                {t(DAY_LABELS_SHORT_FR[dow])}
              </span>
              <span
                className={`flex h-9 w-full items-center justify-center rounded-[var(--radius-card-sm)] text-[1rem] font-bold ${on ? 'bg-ink text-white' : closed ? 'text-disabled' : d === today ? 'text-ink' : ''}`}
              >
                {Number(d.slice(8, 10))}
              </span>
              <span
                className={`relative block w-full overflow-hidden rounded-[var(--radius-card-sm)] ${on ? 'border-[1.5px] border-ink bg-surface' : 'border border-line-soft bg-surface'}`}
                style={{
                  height: H,
                  background: closed
                    ? 'repeating-linear-gradient(135deg,#f4f5f6 0 6px,#eff0f1 6px 12px)'
                    : undefined,
                }}
              >
                {!closed &&
                  list.map((b) => {
                    const s = Math.max(startMin, localMinutes(b.startsAt));
                    const e = Math.min(endMin, localMinutes(b.endsAt));
                    return (
                      <span
                        key={b.id}
                        className={
                          b.status === 'cancelled'
                            ? 'absolute start-0.5 end-0.5 rounded-[var(--radius-card-sm)] border border-dashed border-line'
                            : `absolute start-0.5 end-0.5 rounded-[var(--radius-card-sm)] border-s-[3px] ${TONE[toneOf(b)]}`
                        }
                        style={{ top: (s - startMin) * px, height: Math.max(10, (e - s) * px) }}
                      />
                    );
                  })}
                {on && d === today && nowMinutes() >= startMin && nowMinutes() <= endMin && (
                  <span
                    className="absolute start-0 end-0 border-t border-danger"
                    style={{ top: (nowMinutes() - startMin) * px }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 text-[1rem] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-cat-nail-bg" /> {t("Réservé")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded border border-dashed border-line" /> {t("Libre")}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-5 rounded"
            style={{
              background: 'repeating-linear-gradient(135deg,#f4f5f6 0 3px,#e6e7e9 3px 6px)',
            }}
          />{' '}
          {t("Fermé")}
        </span>
      </div>
    </div>
  );
}

/** Vue mois : grille 6 × 7 (dimanche en premier), un point par rendez-vous, jour sélectionné détaillé. */
function MonthGrid({
  date,
  gridStart,
  byDay,
  closedDays,
  toneOf,
  selected,
  today,
  onSelect,
  onOpenDay,
  onOpen,
}: {
  date: string;
  gridStart: string;
  byDay: Map<string, BookingWithStaff[]>;
  closedDays: number[];
  toneOf: (b: BookingWithStaff) => string;
  selected: string;
  today: string;
  onSelect: (d: string) => void;
  onOpenDay: (d: string) => void;
  onOpen: (id: string) => void;
}) {
  const month = date.slice(0, 7);
  const cells = Array.from({ length: 42 }, (_, i) => addDaysToKey(gridStart, i));
  const list = (byDay.get(selected) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const revenue = list
    .filter((b) => b.status !== 'cancelled' && b.status !== 'no_show')
    .reduce((a, b) => a + b.priceDa, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-1.5">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((l, i) => (
          <span
            key={i}
            className={`py-1 text-center text-[1rem] ${closedDays.includes(i) ? 'text-disabled' : 'text-subtle'}`}
          >
            {l}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === month;
          const closed = closedDays.includes(dayOfWeekFromKey(d));
          const on = d === selected;
          const dots = (byDay.get(d) ?? []).slice(0, 4);
          return (
            <button
              key={d}
              type="button"
              onClick={() => (on ? onOpenDay(d) : onSelect(d))}
              className={`flex h-[4.625rem] flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card-sm)] border ${on ? 'border-ink bg-ink text-white' : inMonth ? 'border-line-soft bg-surface' : 'border-transparent'} ${!inMonth ? 'text-disabled' : closed ? 'text-disabled' : ''}`}
              style={
                closed && !on
                  ? {
                      background:
                        'repeating-linear-gradient(135deg,#f4f5f6 0 6px,#eff0f1 6px 12px)',
                    }
                  : undefined
              }
              aria-label={d}
            >
              <span
                className={`text-[1rem] ${on ? 'font-bold' : d === today ? 'font-bold' : ''}`}
              >
                {Number(d.slice(8, 10))}
              </span>
              <span className="flex h-1.5 gap-1">
                {dots.map((b) => (
                  <span
                    key={b.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: on ? '#fff' : DOT[toneOf(b)] }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 text-[1rem] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cat-nail-line" /> {t("1 point = 1 rendez-vous")}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-5 rounded"
            style={{
              background: 'repeating-linear-gradient(135deg,#f4f5f6 0 3px,#e6e7e9 3px 6px)',
            }}
          />{' '}
          {t("Fermé")}
        </span>
      </div>
      <div className="crd !gap-0 !py-1">
        <button
          type="button"
          className="li w-full text-start"
          onClick={() => onOpenDay(selected)}
        >
          <span>
            <span className="block text-[1.143rem] font-bold tracking-[-0.3px]">
              {t(DAY_LABELS_FR[dayOfWeekFromKey(selected)])} {Number(selected.slice(8, 10))}{' '}
              {t(MONTHS[Number(selected.slice(5, 7)) - 1]!)}
            </span>
            <span className="p block text-[0.857rem]">
              {list.length} {t("rendez-vous ·")}{' '}{formatDA(revenue)}
            </span>
          </span>
          <I icon={ChevronRight} size={18} className="text-disabled" />
        </button>
        {list.map((b) => (
          <button
            key={b.id}
            type="button"
            className="li w-full !py-3 text-start"
            onClick={() => onOpen(b.id)}
          >
            <span className="flex items-center gap-3">
              <span
                className="h-7 w-[0.1875rem] rounded-full"
                style={{ background: DOT[toneOf(b)] }}
              />
              <span>
                <span className="block text-[0.857rem]">
                  {b.clientName} · {b.serviceName}
                </span>
                <span className="mono block text-[1rem] text-muted">
                  {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)}
                </span>
              </span>
            </span>
            <StatusBadge
              status={b.status}
              cancelledBy={b.cancelledBy}
              kind={b.cancellationKind}
              viewer="pro"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
