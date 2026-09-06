/**
 * PRO-F 24 / 25 / 26 — Agenda : vue jour (ligne de temps, créneaux libres hachurés, pauses),
 * vue semaine (colonnes, blocs colorés par catégorie), vue mois (points = rendez-vous, jours fermés hachurés).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useProBlocks, useProBookings, useProSalon } from '@salondz/api-client';
import { DAY_LABELS_FR, DAY_LABELS_SHORT_FR, addDaysToKey, categoryTone, dayOfWeekFromKey, formatDA, formatTimeDZ, timeToMinutes, toLocalDateKey, weekKeys } from '@salondz/constants';
import { useRealtimeBookings } from '@/lib/realtime';
import { formatDuration } from '@/lib/format';
import { Badge, I, IconButton, Segmented, StatusBadge } from '@/components/ui';
import { DayStrip } from '@/components/DaySelector';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import type { BookingWithStaff } from '@salondz/types';

type View = 'day' | 'week' | 'month';
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const TONE: Record<string, string> = {
  hair: 'bg-cat-hair-bg border-cat-hair-line text-cat-hair-fg',
  barb: 'bg-cat-barb-bg border-cat-barb-line text-cat-barb-fg',
  nail: 'bg-cat-nail-bg border-cat-nail-line text-cat-nail-fg',
  lash: 'bg-cat-lash-bg border-cat-lash-line text-cat-lash-fg',
  skin: 'bg-cat-skin-bg border-cat-skin-line text-cat-skin-fg',
  lasr: 'bg-cat-lasr-bg border-cat-lasr-line text-cat-lasr-fg',
};
const DOT: Record<string, string> = { hair: '#38aeb5', barb: '#6d8fe8', nail: '#d97898', lash: '#8a63d8', skin: '#55a873', lasr: '#d88c52' };

const localKey = (iso: string) => toLocalDateKey(new Date(iso));
const localMinutes = (iso: string) => timeToMinutes(formatTimeDZ(iso));
const nowMinutes = () => timeToMinutes(formatTimeDZ(new Date().toISOString()));

export function AgendaPro() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState(today);
  const week = useMemo(() => weekKeys(date), [date]);
  const monthStart = `${date.slice(0, 7)}-01`;
  const monthGridStart = addDaysToKey(monthStart, -dayOfWeekFromKey(monthStart));
  const from = view === 'month' ? monthGridStart : week[0]!;
  const to = view === 'month' ? addDaysToKey(monthGridStart, 41) : week[6]!;
  const bookings = useProBookings({ from, to, limit: 200 }, !!salon);
  const blocks = useProBlocks(from, to);
  useRealtimeBookings(salon?.id);

  const toneOf = (b: BookingWithStaff) => categoryTone(salon?.services.find((s) => s.id === b.serviceId)?.categoryId);
  const items = useMemo(() => (bookings.data?.items ?? []).filter((b) => b.status !== 'cancelled'), [bookings.data]);
  const byDay = useMemo(() => {
    const m = new Map<string, BookingWithStaff[]>();
    for (const b of items) m.set(localKey(b.startsAt), [...(m.get(localKey(b.startsAt)) ?? []), b]);
    return m;
  }, [items]);

  if (!salon) return <Splash />;
  const closedDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !salon.openingHours.some((h) => h.dayOfWeek === d && !h.isClosed));
  const dayHours = (key: string) => salon.openingHours.filter((h) => h.dayOfWeek === dayOfWeekFromKey(key) && !h.isClosed);
  const dayItems = (byDay.get(date) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const dayRevenue = dayItems.filter((b) => b.status !== 'no_show').reduce((a, b) => a + b.priceDa, 0);
  const dayPending = dayItems.filter((b) => b.status === 'pending').length;
  const dayBlocks = (blocks.data?.items ?? []).filter((t) => localKey(t.startsAt) === date);

  const shift = (n: number) => setDate(view === 'month' ? addDaysToKey(monthStart, n > 0 ? 32 : -1).slice(0, 8) + '01' : addDaysToKey(date, n * (view === 'week' ? 7 : 1)));

  // ---- en-tête ----
  const header =
    view === 'day' ? (
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[19px] text-muted">{DAY_LABELS_FR[dayOfWeekFromKey(date)]}</div>
          <h1 className="h1 whitespace-nowrap !text-[32px]">
            {Number(date.slice(8, 10))} {MONTHS[Number(date.slice(5, 7)) - 1]}
          </h1>
        </div>
        <div className="flex gap-2.5">
          <IconButton lg aria-label="Rechercher un rendez-vous" onClick={() => navigate('/pro/clients')}>
            <I icon={Search} size={20} />
          </IconButton>
          <IconButton lg ink aria-label="Nouveau rendez-vous" onClick={() => navigate(`/pro/rendez-vous/nouveau?date=${date}`)}>
            <I icon={Plus} size={22} />
          </IconButton>
          <IconButton lg aria-label="Aujourd'hui" onClick={() => setDate(today)}>
            <I icon={Calendar} size={20} />
          </IconButton>
        </div>
      </div>
    ) : (
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[19px] text-muted">{view === 'week' ? `Semaine ${isoWeek(date)} · ${MONTHS[Number(week[0]!.slice(5, 7)) - 1]} ${week[0]!.slice(0, 4)}` : date.slice(0, 4)}</div>
          <h1 className="h1 !text-[34px]">{view === 'week' ? `${Number(week[0]!.slice(8, 10))} – ${Number(week[6]!.slice(8, 10))} ${MONTHS[Number(week[6]!.slice(5, 7)) - 1]}` : MONTHS[Number(date.slice(5, 7)) - 1]!.replace(/^\w/, (c) => c.toUpperCase())}</h1>
        </div>
        <div className="flex gap-2.5">
          <IconButton lg aria-label="Précédent" onClick={() => shift(-1)}>
            <I icon={ChevronLeft} size={20} />
          </IconButton>
          <IconButton lg aria-label="Suivant" onClick={() => shift(1)}>
            <I icon={ChevronRight} size={20} />
          </IconButton>
        </div>
      </div>
    );

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      {header}
      <Segmented
        label="Vue"
        value={view}
        onChange={setView}
        options={[
          { value: 'day', label: 'Jour' },
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
        ]}
      />

      {view === 'day' && (
        <>
          <DayStrip weekOf={date} selected={date} onSelect={setDate} disabledDays={closedDays} />
          <div className="flex items-center justify-between">
            <span className="text-[19px]">
              <b>{dayItems.length} rendez-vous</b> <span className="text-muted">· {formatDA(dayRevenue)}</span>
            </span>
            {dayPending > 0 && (
              <Badge tone="pd" md>
                {dayPending} en attente
              </Badge>
            )}
          </div>
          <DayTimeline date={date} items={dayItems} blocks={dayBlocks} hours={dayHours(date)} toneOf={toneOf} onOpen={(id) => navigate(`/pro/rendez-vous/${id}`)} />
          <button type="button" className="fab right-5" aria-label="Nouveau rendez-vous" onClick={() => navigate(`/pro/rendez-vous/nouveau?date=${date}`)} style={{ left: 'auto', right: 'max(20px, calc(50% - var(--app-max-width) / 2 + 20px))' }}>
            <I icon={Plus} size={28} />
          </button>
        </>
      )}

      {view === 'week' && (
        <WeekGrid week={week} byDay={byDay} closedDays={closedDays} salonHours={salon.openingHours} toneOf={toneOf} selected={date} onSelect={(d) => { setDate(d); setView('day'); }} />
      )}

      {view === 'month' && (
        <MonthGrid date={date} gridStart={monthGridStart} byDay={byDay} closedDays={closedDays} toneOf={toneOf} selected={date} today={today} onSelect={setDate} onOpenDay={(d) => { setDate(d); setView('day'); }} onOpen={(id) => navigate(`/pro/rendez-vous/${id}`)} />
      )}
    </Screen>
  );
}

function isoWeek(key: string): number {
  const d = new Date(`${key}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
}

/** Vue jour : ligne de temps de l'ouverture à la fermeture (pas d'une heure). */
function DayTimeline({ date, items, blocks, hours, toneOf, onOpen }: { date: string; items: BookingWithStaff[]; blocks: { startsAt: string; endsAt: string; reason: string | null }[]; hours: { opensAt: string; closesAt: string }[]; toneOf: (b: BookingWithStaff) => string; onOpen: (id: string) => void }) {
  if (hours.length === 0 && items.length === 0) return <p className="p py-6 text-center">Fermé ce jour.</p>;
  const startMin = Math.min(...(hours.length ? hours.map((h) => timeToMinutes(h.opensAt)) : [8 * 60]), ...items.map((b) => localMinutes(b.startsAt)));
  const endMin = Math.max(...(hours.length ? hours.map((h) => timeToMinutes(h.closesAt)) : [19 * 60]), ...items.map((b) => localMinutes(b.endsAt)));
  const PX = 92 / 60; // 92 px par heure (design)
  const top = (m: number) => (m - startMin) * PX;
  const height = (endMin - startMin) * PX + 24;
  const hourMarks: number[] = [];
  for (let m = Math.floor(startMin / 60) * 60; m <= endMin; m += 60) hourMarks.push(m);
  const isToday = date === toLocalDateKey();
  const now = nowMinutes();
  // Trous « Libre » entre deux rendez-vous
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const gaps: { s: number; e: number }[] = [];
  let cursor = startMin;
  for (const b of sorted) {
    const s = localMinutes(b.startsAt);
    if (s - cursor >= 30) gaps.push({ s: cursor, e: s });
    cursor = Math.max(cursor, localMinutes(b.endsAt));
  }
  // pauses (fermeture entre deux plages) + blocages
  const closedRanges: { s: number; e: number; label: string }[] = [];
  const sortedHours = [...hours].sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  for (let i = 1; i < sortedHours.length; i++) closedRanges.push({ s: timeToMinutes(sortedHours[i - 1]!.closesAt), e: timeToMinutes(sortedHours[i]!.opensAt), label: 'Pause' });
  for (const t of blocks) closedRanges.push({ s: localMinutes(t.startsAt), e: Math.min(endMin, localMinutes(t.endsAt)), label: t.reason ?? 'Blocage' });

  return (
    <div className="relative" style={{ height }}>
      {hourMarks.map((m) => (
        <div key={m} className="absolute left-0 right-0" style={{ top: top(m) }}>
          <span className="absolute -top-2.5 left-0 text-[15px] text-subtle">{String(Math.floor(m / 60)).padStart(2, '0')}:00</span>
          <div className="ml-[56px] border-t border-line-soft" />
        </div>
      ))}
      {gaps.map((g) => (
        <div key={`gap-${g.s}`} className="absolute left-[58px] right-0 flex items-center rounded-[12px] px-4 text-[15px] text-subtle" style={{ top: top(g.s) + 2, height: (g.e - g.s) * PX - 4, background: 'repeating-linear-gradient(135deg,#f4f5f6 0 6px,#eff0f1 6px 12px)' }}>
          Libre · {formatDuration(g.e - g.s)}
        </div>
      ))}
      {closedRanges.map((c) => (
        <div key={`c-${c.s}-${c.label}`} className="absolute left-[58px] right-0 flex items-center rounded-[12px] px-4 text-[15px] text-subtle" style={{ top: top(c.s) + 2, height: Math.max(20, (c.e - c.s) * PX - 4), background: 'repeating-linear-gradient(135deg,#f4f5f6 0 6px,#eff0f1 6px 12px)' }}>
          {c.label} · {String(Math.floor(c.s / 60)).padStart(2, '0')}:{String(c.s % 60).padStart(2, '0')} – {String(Math.floor(c.e / 60)).padStart(2, '0')}:{String(c.e % 60).padStart(2, '0')}
        </div>
      ))}
      {sorted.map((b) => {
        const s = localMinutes(b.startsAt);
        const e = localMinutes(b.endsAt);
        return (
          <button key={b.id} type="button" onClick={() => onOpen(b.id)} className={`absolute left-[58px] right-0 overflow-hidden rounded-[12px] border-l-[3px] px-3 py-2 text-left ${TONE[toneOf(b)]}`} style={{ top: top(s) + 2, height: Math.max(44, (e - s) * PX - 4) }}>
            <span className="block truncate text-[17px] font-semibold">
              {b.clientName} · {b.serviceName}
            </span>
            <span className="mono block text-[14px] opacity-80">
              {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)} · {formatDA(b.priceDa)}
            </span>
            {b.status === 'pending' && (
              <span className="mt-1 inline-block">
                <Badge tone="pd" dot={false}>
                  En attente
                </Badge>
              </span>
            )}
          </button>
        );
      })}
      {isToday && now >= startMin && now <= endMin && (
        <div className="pointer-events-none absolute left-[46px] right-0 border-t-[1.5px] border-danger" style={{ top: top(now) }}>
          <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-danger" />
        </div>
      )}
    </div>
  );
}

/** Vue semaine : 7 colonnes de 09 h à 19 h, blocs par catégorie, jours fermés hachurés. */
function WeekGrid({ week, byDay, closedDays, salonHours, toneOf, selected, onSelect }: { week: string[]; byDay: Map<string, BookingWithStaff[]>; closedDays: number[]; salonHours: { dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean }[]; toneOf: (b: BookingWithStaff) => string; selected: string; onSelect: (d: string) => void }) {
  const open = salonHours.filter((h) => !h.isClosed);
  const startMin = Math.min(...(open.length ? open.map((h) => timeToMinutes(h.opensAt)) : [9 * 60]));
  const endMin = Math.max(...(open.length ? open.map((h) => timeToMinutes(h.closesAt)) : [19 * 60]));
  const H = 720;
  const px = H / (endMin - startMin);
  const total = week.reduce((a, d) => a + (byDay.get(d)?.length ?? 0), 0);
  const revenue = week.reduce((a, d) => a + (byDay.get(d) ?? []).reduce((x, b) => x + b.priceDa, 0), 0);
  const busyMin = week.reduce((a, d) => a + (byDay.get(d) ?? []).reduce((x, b) => x + b.durationMinutes, 0), 0);
  const openMin = week.reduce((a, d) => a + (closedDays.includes(dayOfWeekFromKey(d)) ? 0 : endMin - startMin), 0);
  const occupancy = openMin ? Math.round((busyMin / openMin) * 100) : 0;
  const today = toLocalDateKey();
  const hours: number[] = [];
  for (let m = startMin; m <= endMin; m += 120) hours.push(m);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-[17px]">
        <span className="pill soft !py-2 !font-semibold">{total} rendez-vous</span>
        <Badge tone="ok" md>
          {formatDA(revenue)}
        </Badge>
        <span className="text-muted">{occupancy} % occupé</span>
      </div>
      <div className="flex gap-1.5">
        <div className="relative w-[26px] flex-none" style={{ height: H + 56 }}>
          {hours.map((m) => (
            <span key={m} className="absolute left-0 text-[13px] text-subtle" style={{ top: 56 + (m - startMin) * px - 8 }}>
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
            <button key={d} type="button" onClick={() => onSelect(d)} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-left">
              <span className={`text-[15px] ${closed ? 'text-disabled' : 'text-muted'}`}>{DAY_LABELS_SHORT_FR[dow]}</span>
              <span className={`flex h-9 w-full items-center justify-center rounded-[12px] text-[19px] font-bold ${on ? 'bg-ink text-white' : closed ? 'text-disabled' : d === today ? 'text-ink' : ''}`}>{Number(d.slice(8, 10))}</span>
              <span className={`relative block w-full overflow-hidden rounded-[12px] ${on ? 'border-[1.5px] border-ink bg-surface' : 'border border-line-soft bg-surface'}`} style={{ height: H, background: closed ? 'repeating-linear-gradient(135deg,#f4f5f6 0 6px,#eff0f1 6px 12px)' : undefined }}>
                {!closed &&
                  list.map((b) => {
                    const s = Math.max(startMin, localMinutes(b.startsAt));
                    const e = Math.min(endMin, localMinutes(b.endsAt));
                    return <span key={b.id} className={`absolute left-0.5 right-0.5 rounded-[8px] border-l-[3px] ${TONE[toneOf(b)]}`} style={{ top: (s - startMin) * px, height: Math.max(10, (e - s) * px) }} />;
                  })}
                {on && d === today && nowMinutes() >= startMin && nowMinutes() <= endMin && <span className="absolute left-0 right-0 border-t border-danger" style={{ top: (nowMinutes() - startMin) * px }} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 text-[15px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-cat-nail-bg" /> Réservé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded border border-dashed border-line" /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded" style={{ background: 'repeating-linear-gradient(135deg,#f4f5f6 0 3px,#e6e7e9 3px 6px)' }} /> Fermé
        </span>
      </div>
    </div>
  );
}

/** Vue mois : grille 6 × 7 (dimanche en premier), un point par rendez-vous, jour sélectionné détaillé. */
function MonthGrid({ date, gridStart, byDay, closedDays, toneOf, selected, today, onSelect, onOpenDay, onOpen }: { date: string; gridStart: string; byDay: Map<string, BookingWithStaff[]>; closedDays: number[]; toneOf: (b: BookingWithStaff) => string; selected: string; today: string; onSelect: (d: string) => void; onOpenDay: (d: string) => void; onOpen: (id: string) => void }) {
  const month = date.slice(0, 7);
  const cells = Array.from({ length: 42 }, (_, i) => addDaysToKey(gridStart, i));
  const list = (byDay.get(selected) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const revenue = list.reduce((a, b) => a + b.priceDa, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-1.5">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((l, i) => (
          <span key={i} className={`py-1 text-center text-[15px] ${closedDays.includes(i) ? 'text-disabled' : 'text-subtle'}`}>
            {l}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === month;
          const closed = closedDays.includes(dayOfWeekFromKey(d));
          const on = d === selected;
          const dots = (byDay.get(d) ?? []).slice(0, 4);
          return (
            <button key={d} type="button" onClick={() => (on ? onOpenDay(d) : onSelect(d))} className={`flex h-[74px] flex-col items-center justify-center gap-1.5 rounded-[14px] border ${on ? 'border-ink bg-ink text-white' : inMonth ? 'border-line-soft bg-surface' : 'border-transparent'} ${!inMonth ? 'text-disabled' : closed ? 'text-disabled' : ''}`} style={closed && !on ? { background: 'repeating-linear-gradient(135deg,#f4f5f6 0 6px,#eff0f1 6px 12px)' } : undefined} aria-label={d}>
              <span className={`text-[19px] ${on ? 'font-bold' : d === today ? 'font-bold' : ''}`}>{Number(d.slice(8, 10))}</span>
              <span className="flex h-1.5 gap-1">
                {dots.map((b) => (
                  <span key={b.id} className="h-1.5 w-1.5 rounded-full" style={{ background: on ? '#fff' : DOT[toneOf(b)] }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 text-[15px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cat-nail-line" /> 1 point = 1 rendez-vous
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded" style={{ background: 'repeating-linear-gradient(135deg,#f4f5f6 0 3px,#e6e7e9 3px 6px)' }} /> Fermé
        </span>
      </div>
      <div className="crd !gap-0 !py-1">
        <button type="button" className="li w-full !py-4 text-left" onClick={() => onOpenDay(selected)}>
          <span>
            <span className="block text-[21px] font-bold tracking-[-0.3px]">
              {DAY_LABELS_FR[dayOfWeekFromKey(selected)]} {Number(selected.slice(8, 10))} {MONTHS[Number(selected.slice(5, 7)) - 1]}
            </span>
            <span className="p block text-[16px]">
              {list.length} rendez-vous · {formatDA(revenue)}
            </span>
          </span>
          <I icon={ChevronRight} size={18} className="text-disabled" />
        </button>
        {list.map((b) => (
          <button key={b.id} type="button" className="li w-full !py-3 text-left" onClick={() => onOpen(b.id)}>
            <span className="flex items-center gap-3">
              <span className="h-7 w-[3px] rounded-full" style={{ background: DOT[toneOf(b)] }} />
              <span>
                <span className="block text-[17px]">
                  {b.clientName} · {b.serviceName}
                </span>
                <span className="mono block text-[14px] text-muted">
                  {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)}
                </span>
              </span>
            </span>
            <StatusBadge status={b.status} />
          </button>
        ))}
      </div>
    </div>
  );
}
