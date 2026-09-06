/**
 * PRO-F 24 / 25 / 26 — Agenda : vue jour (ligne de temps, créneaux libres hachurés, pauses),
 * vue semaine (colonnes, blocs colorés par catégorie), vue mois (points = rendez-vous, jours fermés hachurés).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react-native';
import { useProBlocks, useProBookings, useProSalon } from '@salondz/api-client';
import { DAY_LABELS_FR, DAY_LABELS_SHORT_FR, addDaysToKey, categoryTone, dayOfWeekFromKey, formatDA, formatTimeDZ, timeToMinutes, toLocalDateKey, weekKeys } from '@salondz/constants';
import type { BookingWithStaff } from '@salondz/types';
import { useRealtimeBookings } from '@/lib/realtime';
import { MONTHS_FR, formatDuration } from '@/lib/format';
import { Badge, I, IconButton, ListCard, P, Row, Segmented, StatusBadge, Tx } from '@/ui';
import { DayStrip } from '@/ui/DaySelector';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, CAT, NAV_PAD, SHADOW } from '@/theme/design';

type View3 = 'day' | 'week' | 'month';
const HATCH: ViewStyle = { backgroundColor: C.fill, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line };
const localKey = (iso: string) => toLocalDateKey(new Date(iso));
const localMinutes = (iso: string) => timeToMinutes(formatTimeDZ(iso));
const nowMinutes = () => timeToMinutes(formatTimeDZ(new Date().toISOString()));
const tone = (key: string) => CAT[key] ?? CAT.nail!;
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export default function AgendaPro() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const [view, setView] = useState<View3>('day');
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
  const openBooking = (id: string) => router.push(`/pro-rdv/${id}` as never);
  const newBooking = () => router.push({ pathname: '/pro-rdv/nouveau', params: { date } });

  const header =
    view === 'day' ? (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View>
          <Tx size={19} color={C.muted} lh={24}>
            {DAY_LABELS_FR[dayOfWeekFromKey(date)]}
          </Tx>
          <Tx size={32} weight={700} ls={-0.8} lh={36}>
            {Number(date.slice(8, 10))} {MONTHS_FR[Number(date.slice(5, 7)) - 1]}
          </Tx>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <IconButton lg accessibilityLabel="Rechercher un rendez-vous" onPress={() => router.push('/(pro)/(tabs)/clients')}>
            <I icon={Search} size={20} />
          </IconButton>
          <IconButton lg ink accessibilityLabel="Nouveau rendez-vous" onPress={newBooking}>
            <I icon={Plus} size={22} color="#fff" />
          </IconButton>
          <IconButton lg accessibilityLabel="Aujourd'hui" onPress={() => setDate(today)}>
            <I icon={Calendar} size={20} />
          </IconButton>
        </View>
      </View>
    ) : (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Tx size={19} color={C.muted} lh={24}>
            {view === 'week' ? `Semaine ${isoWeek(date)} · ${MONTHS_FR[Number(week[0]!.slice(5, 7)) - 1]} ${week[0]!.slice(0, 4)}` : date.slice(0, 4)}
          </Tx>
          <Tx size={34} weight={700} ls={-0.8} lh={38}>
            {view === 'week' ? `${Number(week[0]!.slice(8, 10))} – ${Number(week[6]!.slice(8, 10))} ${MONTHS_FR[Number(week[6]!.slice(5, 7)) - 1]}` : MONTHS_FR[Number(date.slice(5, 7)) - 1]!.replace(/^\p{L}/u, (c) => c.toUpperCase())}
          </Tx>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <IconButton lg accessibilityLabel="Précédent" onPress={() => shift(-1)}>
            <I icon={ChevronLeft} size={20} />
          </IconButton>
          <IconButton lg accessibilityLabel="Suivant" onPress={() => shift(1)}>
            <I icon={ChevronRight} size={20} />
          </IconButton>
        </View>
      </View>
    );

  return (
    <Screen
      gap={16}
      bottom={NAV_PAD + 60}
      footer={
        view === 'day' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Nouveau rendez-vous" onPress={newBooking} style={[{ position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, SHADOW.fab]}>
            <I icon={Plus} size={28} color="#fff" />
          </Pressable>
        ) : undefined
      }
    >
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Tx size={19} lh={24}>
              <Tx size={19} weight={700} lh={24}>
                {dayItems.length} rendez-vous
              </Tx>{' '}
              <Tx size={19} color={C.muted} lh={24}>
                · {formatDA(dayRevenue)}
              </Tx>
            </Tx>
            {dayPending > 0 && (
              <Badge tone="pd" md>
                {dayPending} en attente
              </Badge>
            )}
          </View>
          <DayTimeline date={date} items={dayItems} blocks={dayBlocks} hours={dayHours(date)} toneOf={toneOf} onOpen={openBooking} />
        </>
      )}

      {view === 'week' && (
        <WeekGrid
          week={week}
          byDay={byDay}
          closedDays={closedDays}
          salonHours={salon.openingHours}
          toneOf={toneOf}
          selected={date}
          onSelect={(d) => {
            setDate(d);
            setView('day');
          }}
        />
      )}

      {view === 'month' && (
        <MonthGrid
          date={date}
          gridStart={monthGridStart}
          byDay={byDay}
          closedDays={closedDays}
          toneOf={toneOf}
          selected={date}
          today={today}
          onSelect={setDate}
          onOpenDay={(d) => {
            setDate(d);
            setView('day');
          }}
          onOpen={openBooking}
        />
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

/** Vue jour : ligne de temps de l'ouverture à la fermeture (92 px par heure, design). */
function DayTimeline({ date, items, blocks, hours, toneOf, onOpen }: { date: string; items: BookingWithStaff[]; blocks: { startsAt: string; endsAt: string; reason: string | null }[]; hours: { opensAt: string; closesAt: string }[]; toneOf: (b: BookingWithStaff) => string; onOpen: (id: string) => void }) {
  if (hours.length === 0 && items.length === 0)
    return (
      <View style={{ paddingVertical: 24 }}>
        <P center>Fermé ce jour.</P>
      </View>
    );
  const startMin = Math.min(...(hours.length ? hours.map((h) => timeToMinutes(h.opensAt)) : [8 * 60]), ...items.map((b) => localMinutes(b.startsAt)));
  const endMin = Math.max(...(hours.length ? hours.map((h) => timeToMinutes(h.closesAt)) : [19 * 60]), ...items.map((b) => localMinutes(b.endsAt)));
  const PX = 92 / 60;
  const top = (m: number) => (m - startMin) * PX;
  const height = (endMin - startMin) * PX + 24;
  const hourMarks: number[] = [];
  for (let m = Math.floor(startMin / 60) * 60; m <= endMin; m += 60) hourMarks.push(m);
  const isToday = date === toLocalDateKey();
  const now = nowMinutes();
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const gaps: { s: number; e: number }[] = [];
  let cursor = startMin;
  for (const b of sorted) {
    const s = localMinutes(b.startsAt);
    if (s - cursor >= 30) gaps.push({ s: cursor, e: s });
    cursor = Math.max(cursor, localMinutes(b.endsAt));
  }
  const closedRanges: { s: number; e: number; label: string }[] = [];
  const sortedHours = [...hours].sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  for (let i = 1; i < sortedHours.length; i++) closedRanges.push({ s: timeToMinutes(sortedHours[i - 1]!.closesAt), e: timeToMinutes(sortedHours[i]!.opensAt), label: 'Pause' });
  for (const t of blocks) closedRanges.push({ s: localMinutes(t.startsAt), e: Math.min(endMin, localMinutes(t.endsAt)), label: t.reason ?? 'Blocage' });

  return (
    <View style={{ height }}>
      {hourMarks.map((m) => (
        <View key={m} style={{ position: 'absolute', left: 0, right: 0, top: top(m) }}>
          <Tx size={15} color={C.subtle} lh={20} style={{ position: 'absolute', top: -10, left: 0 }}>
            {hm(m)}
          </Tx>
          <View style={{ marginLeft: 56, borderTopWidth: 1, borderTopColor: C.lineSoft }} />
        </View>
      ))}
      {gaps.map((g) => (
        <View key={`gap-${g.s}`} style={[{ position: 'absolute', left: 58, right: 0, top: top(g.s) + 2, height: (g.e - g.s) * PX - 4, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 16 }, HATCH]}>
          <Tx size={15} color={C.subtle} lh={20}>
            Libre · {formatDuration(g.e - g.s)}
          </Tx>
        </View>
      ))}
      {closedRanges.map((c) => (
        <View key={`c-${c.s}-${c.label}`} style={[{ position: 'absolute', left: 58, right: 0, top: top(c.s) + 2, height: Math.max(20, (c.e - c.s) * PX - 4), borderRadius: 12, justifyContent: 'center', paddingHorizontal: 16 }, HATCH]}>
          <Tx size={15} color={C.subtle} lh={20} numberOfLines={1}>
            {c.label} · {hm(c.s)} – {hm(c.e)}
          </Tx>
        </View>
      ))}
      {sorted.map((b) => {
        const s = localMinutes(b.startsAt);
        const e = localMinutes(b.endsAt);
        const t = tone(toneOf(b));
        return (
          <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`${b.clientName} · ${b.serviceName}`} onPress={() => onOpen(b.id)} style={{ position: 'absolute', left: 58, right: 0, top: top(s) + 2, height: Math.max(44, (e - s) * PX - 4), overflow: 'hidden', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: t.line, backgroundColor: t.bg, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Tx size={17} weight={600} lh={22} color={t.fg} numberOfLines={1}>
              {b.clientName} · {b.serviceName}
            </Tx>
            <Tx size={14} lh={18} color={t.fg} mono style={{ opacity: 0.8 }}>
              {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)} · {formatDA(b.priceDa)}
            </Tx>
            {b.status === 'pending' && (
              <View style={{ marginTop: 4 }}>
                <Badge tone="pd" dot={false}>
                  En attente
                </Badge>
              </View>
            )}
          </Pressable>
        );
      })}
      {isToday && now >= startMin && now <= endMin && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 46, right: 0, top: top(now), borderTopWidth: 1.5, borderTopColor: C.danger }}>
          <View style={{ position: 'absolute', left: -4, top: -5, width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger }} />
        </View>
      )}
    </View>
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
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <View style={{ backgroundColor: C.fill, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 }}>
          <Tx size={17} weight={600} lh={22}>
            {total} rendez-vous
          </Tx>
        </View>
        <Badge tone="ok" md>
          {formatDA(revenue)}
        </Badge>
        <Tx size={17} color={C.muted} lh={22}>
          {occupancy} % occupé
        </Tx>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <View style={{ width: 26, height: H + 56 }}>
          {hours.map((m) => (
            <Tx key={m} size={13} color={C.subtle} lh={16} style={{ position: 'absolute', left: 0, top: 56 + (m - startMin) * px - 8 }}>
              {String(Math.floor(m / 60)).padStart(2, '0')}
            </Tx>
          ))}
        </View>
        {week.map((d) => {
          const dow = dayOfWeekFromKey(d);
          const closed = closedDays.includes(dow);
          const list = byDay.get(d) ?? [];
          const on = d === selected;
          return (
            <Pressable key={d} accessibilityRole="button" accessibilityLabel={d} onPress={() => onSelect(d)} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 8 }}>
              <Tx size={15} color={closed ? C.disabled : C.muted} lh={20}>
                {DAY_LABELS_SHORT_FR[dow]}
              </Tx>
              <View style={{ height: 36, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: on ? C.ink : 'transparent' }}>
                <Tx size={19} weight={700} lh={24} color={on ? '#fff' : closed ? C.disabled : C.text}>
                  {Number(d.slice(8, 10))}
                </Tx>
              </View>
              <View style={[{ width: '100%', height: H, borderRadius: 12, overflow: 'hidden', backgroundColor: C.surface, borderWidth: on ? 1.5 : 1, borderColor: on ? C.ink : C.lineSoft }, closed ? HATCH : null]}>
                {!closed &&
                  list.map((b) => {
                    const s = Math.max(startMin, localMinutes(b.startsAt));
                    const e = Math.min(endMin, localMinutes(b.endsAt));
                    const t = tone(toneOf(b));
                    return <View key={b.id} style={{ position: 'absolute', left: 2, right: 2, top: (s - startMin) * px, height: Math.max(10, (e - s) * px), borderRadius: 8, borderLeftWidth: 3, borderLeftColor: t.line, backgroundColor: t.bg }} />;
                  })}
                {on && d === today && nowMinutes() >= startMin && nowMinutes() <= endMin && <View style={{ position: 'absolute', left: 0, right: 0, top: (nowMinutes() - startMin) * px, borderTopWidth: 1, borderTopColor: C.danger }} />}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Legend swatch={{ backgroundColor: CAT.nail!.bg }} label="Réservé" />
        <Legend swatch={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.line }} label="Libre" />
        <Legend swatch={HATCH} label="Fermé" />
      </View>
    </View>
  );
}

function Legend({ swatch, label }: { swatch: ViewStyle; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[{ width: 20, height: 12, borderRadius: 4 }, swatch]} />
      <Tx size={15} color={C.muted} lh={20}>
        {label}
      </Tx>
    </View>
  );
}

/** Vue mois : grille 6 × 7 (dimanche en premier), un point par rendez-vous, jour sélectionné détaillé. */
function MonthGrid({ date, gridStart, byDay, closedDays, toneOf, selected, today, onSelect, onOpenDay, onOpen }: { date: string; gridStart: string; byDay: Map<string, BookingWithStaff[]>; closedDays: number[]; toneOf: (b: BookingWithStaff) => string; selected: string; today: string; onSelect: (d: string) => void; onOpenDay: (d: string) => void; onOpen: (id: string) => void }) {
  const month = date.slice(0, 7);
  const cells = Array.from({ length: 42 }, (_, i) => addDaysToKey(gridStart, i));
  const rows = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  const list = (byDay.get(selected) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const revenue = list.reduce((a, b) => a + b.priceDa, 0);
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((l, i) => (
            <Tx key={i} size={15} lh={20} center color={closedDays.includes(i) ? C.disabled : C.subtle} style={{ flex: 1, paddingVertical: 4 }}>
              {l}
            </Tx>
          ))}
        </View>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 6 }}>
            {row.map((d) => {
              const inMonth = d.slice(0, 7) === month;
              const closed = closedDays.includes(dayOfWeekFromKey(d));
              const on = d === selected;
              const dots = (byDay.get(d) ?? []).slice(0, 4);
              return (
                <Pressable key={d} accessibilityRole="button" accessibilityLabel={d} onPress={() => (on ? onOpenDay(d) : onSelect(d))} style={[{ flex: 1, height: 74, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderColor: on ? C.ink : inMonth ? C.lineSoft : 'transparent', backgroundColor: on ? C.ink : inMonth ? C.surface : 'transparent' }, closed && !on ? HATCH : null]}>
                  <Tx size={19} weight={on || d === today ? 700 : 400} lh={24} color={on ? '#fff' : !inMonth || closed ? C.disabled : C.text}>
                    {Number(d.slice(8, 10))}
                  </Tx>
                  <View style={{ flexDirection: 'row', gap: 4, height: 6 }}>
                    {dots.map((b) => (
                      <View key={b.id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? '#fff' : tone(toneOf(b)).line }} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: CAT.nail!.line }} />
          <Tx size={15} color={C.muted} lh={20}>
            1 point = 1 rendez-vous
          </Tx>
        </View>
        <Legend swatch={HATCH} label="Fermé" />
      </View>
      <ListCard>
        <Row py={16} onPress={() => onOpenDay(selected)}>
          <Tx size={21} weight={700} ls={-0.3} lh={26}>
            {DAY_LABELS_FR[dayOfWeekFromKey(selected)]} {Number(selected.slice(8, 10))} {MONTHS_FR[Number(selected.slice(5, 7)) - 1]}
          </Tx>
          <Tx size={16} color={C.muted} lh={22}>
            {list.length} rendez-vous · {formatDA(revenue)}
          </Tx>
        </Row>
        {list.map((b) => (
          <Row key={b.id} py={12} chevron={false} onPress={() => onOpen(b.id)} right={<StatusBadge status={b.status} />}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 3, height: 28, borderRadius: 2, backgroundColor: tone(toneOf(b)).line }} />
              <View style={{ flex: 1 }}>
                <Tx size={17} lh={22}>
                  {b.clientName} · {b.serviceName}
                </Tx>
                <Tx size={14} color={C.muted} lh={18} mono>
                  {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)}
                </Tx>
              </View>
            </View>
          </Row>
        ))}
      </ListCard>
    </View>
  );
}
