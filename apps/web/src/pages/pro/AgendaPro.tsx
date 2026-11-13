/**
 * PRO-F 24 / 25 / 26 — Agenda, sur le modèle des outils du métier (Planity Pro) :
 * vue jour en COLONNES, une par membre de l'équipe, heures à gauche, blocs colorés par
 * catégorie, ligne « maintenant » ; un tap sur un vide crée un rendez-vous à cette heure
 * pour ce membre. Vue semaine (colonnes de jours) et vue mois (points) inchangées.
 *
 * Un rendez-vous s'ouvre en FENÊTRE (`BookingPeekSheet`) : l'agenda reste derrière, à sa
 * date et sa position.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarCheck, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  useProBlocks,
  useProBookings,
  useProSalon,
  useProUnseenBookings,
  useSeenOnDisplay,
  useMe,
} from '@salondz/api-client';
import {
  DAY_LABELS_FR,
  DAY_LABELS_SHORT_FR,
  addDaysToKey,
  categoryTone,
  dayOfWeekFromKey,
  formatDA,
  formatLocale,
  formatTimeDZ,
  timeToMinutes,
  toLocalDateKey,
  weekKeys,
  minutesToTime,
} from '@salondz/constants';
import { BookingPeekSheet } from '@/components/BookingPeekSheet';
import { readAgendaMemory, saveAgendaMemory, takeAgendaFlash } from '@/lib/agendaMemory';
import { BlockedSlotSheet, FreeSlotSheet, type BlockedSlot, type FreeSlot } from '@/components/FreeSlotSheet';
import { useShowCancelled, useStaffFilter } from '@/lib/proPrefs';
import { StaffFilter } from '@/components/StaffFilter';
import { formatDuration } from '@/lib/format';
import { useDesktop } from '@/lib/breakpoint';
import {
  Avatar,
  Badge,
  I,
  IconButton,
  Segmented,
  StatusBadge,
  cancelledLabel,
} from '@/components/ui';
import { DayCarousel, DayScroller } from '@/components/DayCarousel';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { PageLoading } from '@/components/PageLoading';
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

/**
 * Statuts d'un rendez-vous dans la grille du jour (11 nov. 2026) : une COULEUR vive chacun, la même
 * dans le bloc et dans la légende (`.agb.s-*` / `.ag9-lg i.s-*` dans `index.css`).
 */
const STATUTS = {
  's-pd': 'À valider',
  's-cf': 'Confirmé',
  's-cur': 'En cours',
  's-ns': 'Absent',
  's-done': 'Terminé',
} as const;
type StatutKey = keyof typeof STATUTS;

/** Hauteur d'une heure : 60 px (maquette 9), une journée de travail tient sur un écran de téléphone. */
const PX = 60 / 60;
/** Espace entre deux blocs qui se suivent. */
const GAP = 4;
/** Largeur de la gouttière des heures. */
const GUTTER = '40px';
/** Durée du clignotement d'un rendez-vous tout juste ajouté. */
const FLASH_MS = 3000;
/** Étendue de la frise des jours autour de son ancrage. */
const STRIP_DAYS_BEFORE = 12 * 7;
const STRIP_DAYS_AFTER = 26 * 7;
/** En dessous, un trou n'accueille aucune prestation utile : il n'est pas proposé comme créneau. */
const MIN_FREE_MINUTES = 30;

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
  // Retour depuis un formulaire : le jour, la vue et le défilement où l'on en était.
  const [memo] = useState(readAgendaMemory);
  const [added] = useState(takeAgendaFlash);
  const [view, setView] = useState<View>(added && added.date === memo?.date ? 'day' : (memo?.view ?? 'day'));
  const [date, setDate] = useState(memo?.date || today);
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
  const [freeSlot, setFreeSlot] = useState<FreeSlot | null>(null);
  const [blocked, setBlocked] = useState<BlockedSlot | null>(null);
  const meId = useMe().data?.profile?.id;
  const desktop = useDesktop();

  const toneOf = (b: BookingWithStaff) =>
    categoryTone(salon?.services.find((s) => s.id === b.serviceId)?.categoryId);
  const [staffId, setStaffId] = useStaffFilter();
  // Le rendez-vous ajouté clignote s'il est sur le jour affiché ; sinon, rien n'est à montrer.
  const [flash, setFlash] = useState(added && added.date === date ? added.id : null);
  useEffect(() => {
    if (flash && added?.staffId && staffId && staffId !== added.staffId) setStaffId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => saveAgendaMemory({ date, view }), [date, view]);
  useEffect(() => {
    const onScroll = () => saveAgendaMemory({ scrollY: window.scrollY });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // Après `ScrollToTop`, qui passe après cet écran : d'où le délai.
  const restored = useRef(false);
  const ready = !!bookings.data;
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    if (!memo?.scrollY || flash) return;
    const y = memo.scrollY;
    const timer = window.setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const flashShown = !!flash && (bookings.data?.items ?? []).some((b) => b.id === flash);
  useEffect(() => {
    if (!flashShown) return;
    const show = window.setTimeout(
      () => document.querySelector(`[data-bk="${flash}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      120,
    );
    const end = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashShown]);
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
  // Frise : la semaine qu'on fait défiler, hors de la fenêtre déjà chargée, se charge à la demande.
  const [stripDay, setStripDay] = useState<string | null>(null);
  const stripEnd = stripDay ? addDaysToKey(stripDay, 6) : null;
  const stripOutside = !!stripDay && !!stripEnd && (stripDay < from || stripEnd > to);
  const stripBookings = useProBookings(
    { from: stripDay ?? from, to: stripEnd ?? to, limit: 200 },
    !!salon && stripOutside,
  );
  const stripByDay = useMemo(() => {
    const m = new Map(byDay);
    const known = new Set(items.map((b) => b.id));
    for (const b of stripBookings.data?.items ?? []) {
      if (known.has(b.id) || (staffId && b.staffId !== staffId)) continue;
      m.set(localKey(b.startsAt), [...(m.get(localKey(b.startsAt)) ?? []), b]);
    }
    return m;
  }, [byDay, items, stripBookings.data, staffId]);
  /**
   * Ce que l'écran MONTRE est vu : le jour affiché, la semaine affichée, ou la journée touchée dans
   * le mois (sa liste s'ouvre sous la grille). Les pastilles « Agenda » et « Réservations » baissent
   * sans qu'il faille ouvrir chaque rendez-vous. Les annulations du jour comptent aussi, même
   * masquées : la pastille « N annulé(s) » les annonce, et elles n'ont rien à traiter.
   */
  const shownIds = useMemo(() => {
    const days = new Set(view === 'week' ? week : [date]);
    return (bookings.data?.items ?? [])
      .filter((b) => days.has(localKey(b.startsAt)) && (!staffId || b.staffId === staffId))
      .map((b) => b.id);
  }, [view, week, date, bookings.data, staffId]);
  useSeenOnDisplay(shownIds, !!salon && !bookings.isFetching);
  // Jours qui portent un rendez-vous pas encore vu : la frise des jours les signale.
  const unseenByDate = useProUnseenBookings(!!salon).data?.byDate;

  if (!salon) return <PageLoading />;
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
  const nameOf = (m: { userId: string | null; displayName: string }) =>
    m.userId && m.userId === meId ? t('Vous') : m.displayName;
  const columns: Column[] =
    team.length < 2
      ? [{ id: null, name: salon.name, avatarUrl: null }]
      : (picked ? [picked] : team).map((m) => ({
          id: m.id,
          name: nameOf(m),
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
        ? `${t(MONTHS[Number(week[0]!.slice(5, 7)) - 1]!)} ${week[0]!.slice(0, 4)}`
        : date.slice(0, 4);
  const title =
    view === 'day'
      ? `${Number(date.slice(8, 10))} ${t(MONTHS[Number(date.slice(5, 7)) - 1]!)}`
      : view === 'week'
        ? `${Number(week[0]!.slice(8, 10))} – ${Number(week[6]!.slice(8, 10))} ${t(MONTHS[Number(week[6]!.slice(5, 7)) - 1]!)}`
        : t(MONTHS[Number(date.slice(5, 7)) - 1]!).replace(/^\w/, (c) => c.toUpperCase());

  return (
    <Screen
      bottom={NAV_PAD}
      gap={12}
      className="agenda"
      // Largeur utile de l'agenda : celle de ses colonnes. Deux membres sur un écran de 1 920 px
      // ne doivent pas donner deux colonnes de 800 px — un agenda se lit en colonnes étroites.
      style={{ ['--ag-max' as string]: `${Math.max(46, columns.length * 20)}rem` }}
    >
      {loadError && <ErrorMessage error={loadError.error} retry={() => void loadError.refetch()} />}
      {/* En-tête de la maquette 9 : le jour en surtitre à l'accent, la date en grand, J / S / M. */}
      <div className="ag9-h">
        <div className="min-w-0 flex-1">
          <span className="ag9-k">
            {view === 'day'
              ? date === today
                ? t("Aujourd'hui")
                : date === addDaysToKey(today, 1)
                  ? t('Demain')
                  : null
              : sub}
            {date !== today && (
              <button type="button" className="ag9-today" onClick={() => setDate(today)}>
                <I icon={CalendarCheck} size={13} /> {t("Aujourd'hui")}
              </button>
            )}
          </span>
          <h1 className="ag9-t">
            {view === 'day'
              ? new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
                  .format(new Date(`${date}T12:00:00Z`))
                  .replace(/^\p{L}/u, (c) => c.toUpperCase())
              : title}
          </h1>
        </div>
        {/* Sur téléphone, la frise et la grille se font défiler au doigt ; à la souris, les flèches. */}
        {(view !== 'day' || desktop) && (
          <div className="flex flex-none items-center gap-1">
            <IconButton aria-label={t("Précédent")} onClick={() => shift(-1)}>
              <I icon={ChevronLeft} size={20} className="rtl:-scale-x-100" />
            </IconButton>
            <IconButton aria-label={t("Suivant")} onClick={() => shift(1)}>
              <I icon={ChevronRight} size={20} className="rtl:-scale-x-100" />
            </IconButton>
          </div>
        )}
        <div className="ag9-v" role="tablist" aria-label={t('Vue')}>
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              aria-label={v === 'day' ? t('Jour') : v === 'week' ? t('Semaine') : t('Mois')}
              className={view === v ? 'on' : ''}
              onClick={() => setView(v)}
            >
              {v === 'day' ? t('J') : v === 'week' ? t('S') : t('M')}
            </button>
          ))}
        </div>
      </div>

      {view === 'day' && (
        <>
          <WeekStrip
            selected={date}
            today={today}
            byDay={stripByDay}
            closedDays={closedDays}
            marks={unseenByDate}
            onSelect={setDate}
            onView={setStripDay}
          />
          {/* Le filtre par membre n'a plus sa rangée de puces : il EST l'en-tête des colonnes
              (`DayColumns`, `onStaff`) — toucher un nom ne garde que sa colonne. */}
          <DayCarousel
            date={date}
            onChange={setDate}
            render={(d) => {
              const all = (byDay.get(d) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
              const live = all.filter((b) => b.status !== 'cancelled');
              const cancelled = all.filter((b) => b.status === 'cancelled');
              // Un blocage de plusieurs jours compte sur chacun d'eux : le créneau n'y est pas libre.
              const dayBlk = (blocks.data?.items ?? []).filter(
                (x) => localKey(x.startsAt) <= d && localKey(x.endsAt) >= d,
              );
              const nCancelled = showCancelled ? cancelled.length : cancelledOn(d);
              return (
                <div className="flex flex-col gap-2.5">
                  <DayColumns
                    cancelledCount={nCancelled}
                    showCancelled={showCancelled}
                    onToggleCancelled={() => setShowCancelled(!showCancelled)}
                    date={d}
                    columns={columns}
                    items={live}
                    cancelled={cancelled}
                    blocks={dayBlk}
                    hours={dayHours(d)}
                    step={salon.slotIntervalMinutes || 15}
                    onOpen={setPeek}
                    followNow={!memo?.scrollY}
                    flash={flash}
                    picked={freeSlot}
                    onGap={setFreeSlot}
                    onBlock={setBlocked}
                    onFree={(t, sid) =>
                      navigate(
                        `/pro/rendez-vous/nouveau?date=${d}&time=${t}${sid ? `&staff=${sid}` : ''}`,
                      )
                    }
                    onStaff={team.length >= 2 ? (id) => setStaffId(id && id !== staffId ? id : null) : undefined}
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
              marks={unseenByDate}
            />
          )}
        />
      )}
      {peek && <BookingPeekSheet id={peek} onClose={() => setPeek(null)} />}
      {freeSlot && <FreeSlotSheet slot={freeSlot} salon={salon} onClose={() => setFreeSlot(null)} />}
      {blocked && <BlockedSlotSheet slot={blocked} onClose={() => setBlocked(null)} />}
      {/* « + » nouveau rendez-vous (maquette 9) : sur téléphone, il n'y a plus d'en-tête qui le portait. */}
      <Link to="/pro/rendez-vous/nouveau" className="fab fab-ag lg:!hidden" aria-label={t('Nouveau rendez-vous')}>
        <I icon={Plus} size={26} strokeWidth={2.4} />
      </Link>
    </Screen>
  );
}

/**
 * Frise des jours (maquette 9) : sept jours à l'écran, qu'on fait défiler au doigt vers le passé ou
 * l'avenir. Défiler ne change pas le jour affiché : on regarde, puis on touche. Sous chaque jour, un
 * point par rendez-vous (trois au plus ; à l'accent pour une demande ou du nouveau), le jour choisi
 * en encre pleine.
 */
function WeekStrip({
  selected,
  today,
  byDay,
  closedDays,
  marks,
  onSelect,
  onView,
}: {
  selected: string;
  today: string;
  byDay: Map<string, BookingWithStaff[]>;
  closedDays: number[];
  marks?: Record<string, number>;
  onSelect: (d: string) => void;
  /** Premier jour visible, une fois le défilement arrêté : ses rendez-vous se chargent à la demande. */
  onView: (firstDay: string) => void;
}) {
  const row = useRef<HTMLDivElement | null>(null);
  const anchor = useRef(weekKeys(selected)[0]!);
  // La frise s'étend autour d'un jour d'ancrage ; on la recentre quand le jour choisi approche d'un bord.
  if (
    selected < addDaysToKey(anchor.current, -STRIP_DAYS_BEFORE + 7) ||
    selected > addDaysToKey(anchor.current, STRIP_DAYS_AFTER - 7)
  )
    anchor.current = weekKeys(selected)[0]!;
  const first = addDaysToKey(anchor.current, -STRIP_DAYS_BEFORE);
  const days = Array.from({ length: STRIP_DAYS_BEFORE + STRIP_DAYS_AFTER }, (_, i) => addDaysToKey(first, i));

  /** Amène la semaine du jour choisi à l'écran, sauf s'il y est déjà. Mesures relatives : juste en arabe aussi. */
  const placed = useRef(false);
  useLayoutEffect(() => {
    const el = row.current;
    const day = el?.querySelector<HTMLElement>(`[data-day="${selected}"]`);
    const start = el?.querySelector<HTMLElement>(`[data-day="${weekKeys(selected)[0]}"]`);
    if (!el || !day || !start) return;
    const pad = parseFloat(getComputedStyle(el).paddingInlineStart) || 0;
    const box = el.getBoundingClientRect();
    const d = day.getBoundingClientRect();
    if (placed.current && d.left >= box.left + pad - 1 && d.right <= box.right - pad + 1) return;
    const a = start.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({
      left: rtl ? a.right - (box.right - pad) : a.left - (box.left + pad),
      behavior: placed.current ? 'smooth' : 'auto',
    });
    placed.current = true;
  }, [selected, first]);

  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onScroll = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = row.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      // Les jours sont dans l'ordre du temps, quel que soit le sens d'écriture : le premier visible.
      const shown = [...el.children].find((x) => {
        const r = x.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        return mid >= box.left && mid <= box.right;
      });
      if (shown instanceof HTMLElement && shown.dataset.day) onView(shown.dataset.day);
    }, 150);
  };

  return (
    <div ref={row} className="ag9-w bleed" onScroll={onScroll}>
      {days.map((d) => {
        const list = (byDay.get(d) ?? []).filter((b) => b.status !== 'cancelled');
        const on = d === selected;
        const closed = closedDays.includes(dayOfWeekFromKey(d));
        // UN POINT PAR RENDEZ-VOUS, dans la couleur de son statut (13 nov. 2026, demande du
        // propriétaire) — la même que les blocs et la légende : on lit d'un coup d'œil combien il y
        // en a et ce qui reste à valider. Quatre au plus ; une nouveauté non vue ajoute un point rouge.
        const passe = d < today;
        const dots: string[] = list
          .slice(0, 4)
          .map((b) =>
            b.status === 'no_show' ? 's-ns' : b.status === 'completed' || passe ? 's-done' : b.status === 'pending' ? 's-pd' : 's-cf',
          );
        if (marks?.[d]) dots.push('nv');
        return (
          <button
            key={d}
            type="button"
            data-day={d}
            className={`ag9-d${on ? ' on' : ''}${d === today ? ' td' : ''}${closed && !list.length ? ' off' : ''}`}
            aria-pressed={on}
            aria-label={`${t(DAY_LABELS_FR[dayOfWeekFromKey(d)])} ${Number(d.slice(8, 10))} ${t(MONTHS[Number(d.slice(5, 7)) - 1]!)}${list.length ? ` · ${t('{n} rendez-vous', { n: list.length })}` : ''}`}
            onClick={() => onSelect(d)}
          >
            <span className="ag9-dw">{t(DAY_LABELS_FR[dayOfWeekFromKey(d)]).slice(0, 3)}</span>
            <span className="ag9-dn">{Number(d.slice(8, 10))}</span>
            <span className="ag9-dd">
              {dots.map((c, i) => (
                <i key={i} className={c} />
              ))}
            </span>
          </button>
        );
      })}
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
  onOpen,
  followNow,
  flash,
  picked,
  onGap,
  onBlock,
  onFree,
  onStaff,
  cancelledCount = 0,
  showCancelled = false,
  onToggleCancelled,
}: {
  /** Annulés du jour : un mot à toucher, au bout de la légende des statuts, qui les montre ou les cache. */
  cancelledCount?: number;
  showCancelled?: boolean;
  onToggleCancelled?: () => void;
  /**
   * Équipe d'au moins deux personnes : l'en-tête des colonnes est le filtre. Toucher un nom ne garde
   * que sa colonne ; le retoucher (ou « Toute l'équipe ») les remet toutes.
   */
  onStaff?: (staffId: string | null) => void;
  date: string;
  columns: Column[];
  items: BookingWithStaff[];
  /** Rendez-vous annulés du jour (pointillés, avec qui a annulé). */
  cancelled?: BookingWithStaff[];
  blocks: { id: string; startsAt: string; endsAt: string; reason: string | null; staffId?: string | null }[];
  hours: { opensAt: string; closesAt: string }[];
  /** Pas des créneaux du salon : le tap sur un vide s'y aligne. */
  step: number;
  onOpen: (id: string) => void;
  /** Amener l'heure actuelle à l'écran ; faux quand on revient à une position gardée. */
  followNow: boolean;
  /** Rendez-vous tout juste ajouté. */
  flash: string | null;
  /** Créneau ouvert dans la fenêtre : son heure reste marquée dans la grille. */
  picked: FreeSlot | null;
  onGap: (slot: FreeSlot) => void;
  onBlock: (slot: BlockedSlot) => void;
  onFree: (timeHM: string, staffId: string | null) => void;
}) {
  const isToday = date === toLocalDateKey();
  const now = nowMinutes();
  // Aujourd'hui : on amène l'heure actuelle au centre de l'écran à l'ouverture (suivi de la journée en direct).
  const nowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isToday || !followNow) return;
    // Seulement si la ligne est hors de vue : la date, la frise et les puces restent à l'écran.
    const t = window.setTimeout(() => {
      const line = nowRef.current;
      if (!line) return;
      const y = line.getBoundingClientRect().top;
      if (y < 0 || y > window.innerHeight - 170) line.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 150);
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

  // Plages fermées : pauses (toutes colonnes) et blocages (tout le salon, ou un seul membre).
  const closed: { s: number; e: number; label: string; staffId: string | null; blockId?: string }[] = [];
  const sortedHours = [...hours].sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  for (let i = 1; i < sortedHours.length; i++)
    closed.push({
      s: timeToMinutes(sortedHours[i - 1]!.closesAt),
      e: timeToMinutes(sortedHours[i]!.opensAt),
      label: t("Pause"),
      staffId: null,
    });
  for (const bk of blocks) {
    const s = localKey(bk.startsAt) < date ? startMin : Math.max(startMin, localMinutes(bk.startsAt));
    const e = localKey(bk.endsAt) > date ? endMin : Math.min(endMin, localMinutes(bk.endsAt));
    if (e > s) closed.push({ s, e, label: bk.reason ?? t('Bloqué'), staffId: bk.staffId ?? null, blockId: bk.id });
  }
  const narrow = columns.length > 1;
  /**
   * État lu par la COULEUR (11 nov. 2026, `STATUTS`) : à valider orange, confirmé bleu, en cours vert,
   * absent rouge, terminé gris. La légende au-dessus de la grille donne la clé.
   */
  const state = (b: BookingWithStaff): StatutKey => {
    const s0 = localMinutes(b.startsAt), e0 = localMinutes(b.endsAt);
    if (b.status === 'no_show') return 's-ns';
    if (b.status === 'completed' || (isToday && e0 <= now) || date < toLocalDateKey()) return 's-done';
    if (b.status === 'pending') return 's-pd';
    if (isToday && s0 <= now && now < e0) return 's-cur';
    return 's-cf';
  };
  const inCol = (col: Column, staffId: string | null) => col.id === null || col.id === staffId;
  const closedIn = (col: Column) => closed.filter((c) => c.staffId === null || inCol(col, c.staffId));

  /** Créneaux libres d'une colonne : les horaires, moins le passé, les rendez-vous et les fermetures. */
  const gapsOf = (col: Column) => {
    if (date < toLocalDateKey()) return [];
    const from = isToday ? Math.ceil(now / step) * step : 0;
    const taken = [
      ...items
        .filter((b) => inCol(col, b.staffId))
        .map((b) => ({ s: localMinutes(b.startsAt), e: localMinutes(b.endsAt) })),
      ...closedIn(col),
    ].sort((a, b) => a.s - b.s);
    const gaps: { s: number; e: number }[] = [];
    for (const h of sortedHours) {
      const end = timeToMinutes(h.closesAt);
      let cur = Math.max(timeToMinutes(h.opensAt), from);
      for (const b of taken) {
        if (b.e <= cur) continue;
        if (b.s >= end) break;
        if (b.s > cur) gaps.push({ s: cur, e: b.s });
        cur = Math.max(cur, b.e);
      }
      if (cur < end) gaps.push({ s: cur, e: end });
    }
    return gaps.filter((g) => g.e - g.s >= MIN_FREE_MINUTES);
  };

  /**
   * L'heure sous le doigt, sur la grille des créneaux du salon (comptée depuis l'ouverture, comme le
   * formulaire de rendez-vous), sans sortir du créneau libre.
   */
  const snapIn = (g: { s: number; e: number }, offset: number) => {
    const h = sortedHours.find((x) => timeToMinutes(x.opensAt) <= g.s && g.s < timeToMinutes(x.closesAt));
    const base = h ? timeToMinutes(h.opensAt) : g.s;
    const first = base + Math.ceil((g.s - base) / step) * step;
    const last = base + Math.floor((g.e - step - base) / step) * step;
    if (last < first) return g.s;
    return Math.min(last, Math.max(first, base + Math.floor((g.s + offset - base) / step) * step));
  };

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
    if (closedIn(col).some((c) => c.s < m + step && c.e > m)) return;
    onFree(minutesToTime(m), col.id);
  };

  const nowShown = isToday && now >= startMin && now <= endMin;
  // La légende ne nomme que les statuts PRÉSENTS ce jour-là : rien à apprendre de plus.
  const present = (Object.keys(STATUTS) as StatutKey[]).filter((k) => items.some((b) => state(b) === k));
  return (
    <>
    {(present.length > 0 || cancelledCount > 0) && (
      <div className="ag9-lg">
        {present.map((k) => (
          <span key={k} aria-hidden>
            <i className={k} />
            {t(STATUTS[k])}
          </span>
        ))}
        {/* Sur la même ligne que les statuts : les annulés, cachés par défaut, à afficher d'un toucher. */}
        {cancelledCount > 0 && onToggleCancelled && (
          <button type="button" className={`ag9-lg-cn${showCancelled ? ' on' : ''}`} aria-pressed={showCancelled} onClick={onToggleCancelled}>
            <i />
            {t('{n} annulé(s)', { n: cancelledCount })}
          </button>
        )}
      </div>
    )}
    {/* Qui travaille dans quelle colonne : le nom en tête de SA colonne, et c'est aussi le filtre. */}
    {onStaff && (
      <div
        className="ag9-ch"
        role="group"
        aria-label={t('Filtrer par membre')}
        style={{ paddingInlineStart: GUTTER, gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((col) => (
          <button
            key={col.id ?? 'all'}
            type="button"
            className={`ag9-chc${narrow ? '' : ' on'}`}
            aria-pressed={!narrow}
            onClick={() => onStaff(col.id)}
          >
            <Avatar src={col.avatarUrl} name={col.name} size={24} />
            <b>{col.name}</b>
            <span>{items.filter((b) => inCol(col, b.staffId)).length}</span>
            {!narrow && <em>{t("Toute l'équipe")}</em>}
          </button>
        ))}
      </div>
    )}
    <div className="ag9-g" style={{ height, paddingInlineStart: GUTTER }}>
      {hourMarks.map((m) => (
        <div key={m} className="ag9-hr" style={{ top: top(m) }}>
          <span><bdi dir="ltr">{hm(m)}</bdi></span>
        </div>
      ))}
      <div className="ag9-cs" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((col) => (
          <div key={col.id ?? 'all'} className="agcol" onClick={(e) => tapFree(e, col)} role="presentation">
            {gapsOf(col).map((g) => (
              <FreeGap
                key={`g-${g.s}`}
                top={top(g.s)}
                height={(g.e - g.s) * PX - GAP}
                start={g.s}
                step={step}
                label={narrow ? null : t('Libre · {d}', { d: formatDuration(g.e - g.s) })}
                aria={`${t('Créneau libre')} ${hm(g.s)} – ${hm(g.e)}`}
                snap={(offset) => snapIn(g, offset)}
                picked={
                  picked && picked.date === date && picked.staffId === col.id && picked.start === g.s ? picked.at : null
                }
                onPick={(at) =>
                  onGap({ date, start: g.s, end: g.e, at, staffId: col.id, staffName: col.id ? col.name : null })
                }
              />
            ))}
            {closedIn(col).map((c) => {
              const style = { top: top(c.s), height: Math.max(22, (c.e - c.s) * PX - GAP) };
              const blockId = c.blockId;
              return blockId ? (
                <button
                  key={`c-${c.s}-${blockId}`}
                  type="button"
                  className="agoff"
                  style={style}
                  aria-label={`${c.label} · ${hm(c.s)} – ${hm(c.e)}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onBlock({ id: blockId, label: c.label, start: c.s, end: c.e, staffName: col.id ? col.name : null });
                  }}
                >
                  {c.label}
                </button>
              ) : (
                <div key={`c-${c.s}-${c.label}`} className="agoff" style={style} title={`${c.label} · ${hm(c.s)} – ${hm(c.e)}`}>
                  {c.label}
                </div>
              );
            })}
            {cancelled
              .filter((b) => inCol(col, b.staffId))
              .map((b) => {
                const s = localMinutes(b.startsAt);
                const e = localMinutes(b.endsAt);
                if (e <= startMin || s >= endMin) return null;
                const h = Math.max(22, (e - s) * PX - GAP);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpen(b.id);
                    }}
                    className="agb cn"
                    style={{ top: top(s), height: h }}
                    aria-label={`${b.clientName} · ${cancelledLabel(b.cancelledBy, 'pro', b.cancellationKind)}`}
                  >
                    <span className="agb-n line-through">
                      {b.clientName}
                      {!narrow && ` · ${b.serviceName}`}
                    </span>
                    {h >= 40 && <span className="agb-s">{cancelledLabel(b.cancelledBy, 'pro', b.cancellationKind)}</span>}
                  </button>
                );
              })}
            {items
              .filter((b) => inCol(col, b.staffId))
              .map((b) => {
                const s = localMinutes(b.startsAt);
                const e = localMinutes(b.endsAt);
                const h = Math.max(22, (e - s) * PX - GAP);
                const st = state(b);
                // L'ESSENTIEL seulement : l'heure et la cliente, puis la prestation si le bloc est
                // assez haut. L'état se lit à la couleur ; prix, fin, membre et le reste sont dans
                // la fenêtre du rendez-vous.
                const showService = h >= 44;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpen(b.id);
                    }}
                    data-bk={b.id}
                    className={`agb ${st}${h < 60 ? ' tight' : ''}${h < 42 ? ' one' : ''}${b.id === flash ? ' flash' : ''}`}
                    style={{ top: top(s), height: h }}
                    aria-label={`${formatTimeDZ(b.startsAt)} ${b.clientName} · ${b.serviceName} · ${t(STATUTS[st])}`}
                  >
                    <span className="agb-n">
                      <b className="agb-t" dir="ltr">
                        {formatTimeDZ(b.startsAt)}
                      </b>{' '}
                      {b.clientName}
                    </span>
                    {showService && <span className="agb-s">{b.serviceName}</span>}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
      {nowShown && (
        <div ref={nowRef} className="ag9-nw" style={{ top: top(now) }}>
          <span><bdi dir="ltr">{minutesToTime(now)}</bdi></span>
        </div>
      )}
    </div>
    </>
  );
}

/**
 * Créneau libre. L'heure visée s'affiche dès que le doigt se pose (et au survol de la souris), à
 * l'endroit exact : on voit où le rendez-vous va se placer avant de lâcher.
 */
function FreeGap({
  top,
  height,
  start,
  step,
  label,
  aria,
  snap,
  picked,
  onPick,
}: {
  top: number;
  height: number;
  start: number;
  step: number;
  label: string | null;
  aria: string;
  snap: (offsetMinutes: number) => number;
  picked: number | null;
  onPick: (at: number) => void;
}) {
  const [mark, setMark] = useState<number | null>(null);
  const read = (e: { clientY: number; currentTarget: HTMLElement }) =>
    snap((e.clientY - e.currentTarget.getBoundingClientRect().top) / PX);
  const shown = mark ?? picked;
  return (
    <button
      type="button"
      className="ag9-f"
      style={{ top, height }}
      aria-label={aria}
      onPointerDown={(e) => setMark(read(e))}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') setMark(read(e));
      }}
      onPointerLeave={() => setMark(null)}
      onPointerCancel={() => setMark(null)}
      onClick={(e) => {
        e.stopPropagation();
        setMark(null);
        // Au clavier, le clic n'a pas de position : le début du créneau.
        onPick(e.detail === 0 ? snap(0) : read(e));
      }}
    >
      {shown === null && (
        <>
          <I icon={Plus} size={14} strokeWidth={2.4} />
          {label && <span>{label}</span>}
        </>
      )}
      {shown !== null && (
        <span className="ag9-tap" style={{ top: (shown - start) * PX - 1.5, height: Math.max(22, step * PX) }} dir="ltr">
          {hm(shown)}
        </span>
      )}
    </button>
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
      <div className="ags">
        <span className="ags-c">
          <b className="mono">{total}</b> {t('rendez-vous')}
        </span>
        <span className="ags-c">
          <b className="mono" dir="ltr">{formatDA(revenue)}</b>
        </span>
        <span className="ags-c">
          <b className="mono">{occupancy}</b> {t("% occupé")}
        </span>
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
                className={`flex h-9 w-full items-center justify-center rounded-[var(--radius-card-sm)] text-[1rem] font-semibold ${on ? 'bg-ink text-white' : closed ? 'text-disabled' : d === today ? 'text-ink' : ''}`}
              >
                {Number(d.slice(8, 10))}
              </span>
              <span
                className={`relative block w-full overflow-hidden rounded-[var(--radius-card-sm)] ${on ? 'border-[1.5px] border-ink bg-surface' : 'border border-line-soft bg-surface'}`}
                style={{
                  height: H,
                  background: closed
                    ? 'repeating-linear-gradient(135deg,#f4f4f9 0 6px,#efeef4 6px 12px)'
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
              background: 'repeating-linear-gradient(135deg,#f4f4f9 0 3px,#e6e5ee 3px 6px)',
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
  marks,
}: {
  date: string;
  gridStart: string;
  /** Jours qui portent un rendez-vous pas encore vu (pastille rouge). */
  marks?: Record<string, number>;
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
              className={`relative flex h-[4.625rem] flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card-sm)] border ${on ? 'border-ink bg-ink text-white' : inMonth ? 'border-line-soft bg-surface' : 'border-transparent'} ${!inMonth ? 'text-disabled' : closed ? 'text-disabled' : ''}`}
              style={
                closed && !on
                  ? {
                      background:
                        'repeating-linear-gradient(135deg,#f4f4f9 0 6px,#efeef4 6px 12px)',
                    }
                  : undefined
              }
              data-day={d}
              aria-pressed={on}
              aria-label={`${Number(d.slice(8, 10))} ${t(MONTHS[Number(d.slice(5, 7)) - 1]!)} · ${t('{n} rendez-vous', { n: (byDay.get(d) ?? []).length })}${marks?.[d] ? ` · ${t('{n} nouveau(x)', { n: marks[d] })}` : ''}`}
            >
              {!!marks?.[d] && (
                <span aria-hidden className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-[var(--color-surface)]" />
              )}
              <span
                className={`text-[1rem] ${on ? 'font-semibold' : d === today ? 'font-semibold' : ''}`}
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
              background: 'repeating-linear-gradient(135deg,#f4f4f9 0 3px,#e6e5ee 3px 6px)',
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
            <span className="block text-[1.143rem] font-semibold tracking-[-0.3px]">
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
