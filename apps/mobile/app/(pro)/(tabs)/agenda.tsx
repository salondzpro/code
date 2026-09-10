/**
 * PRO-F 24 / 25 / 26 — Agenda : vue jour (ligne de temps, créneaux libres hachurés, pauses),
 * vue semaine (colonnes, blocs colorés par catégorie), vue mois (points = rendez-vous, jours fermés hachurés).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react-native';
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
} from '@salondz/constants';
import type { BookingWithStaff } from '@salondz/types';
import { useRealtimeBookings } from '@/lib/realtime';
import { useStaffFilter } from '@/lib/prefs';
import { StaffFilter } from '@/ui/StaffFilter';
import { MONTHS_FR, formatDuration } from '@/lib/format';
import { Badge, I, IconButton, ListCard, P, Row, Segmented, StatusBadge, Tx } from '@/ui';
import { DayCarousel, DayScroller } from '@/ui/DayCarousel';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, CAT, NAV_PAD, SHADOW } from '@/theme/design';

type View3 = 'day' | 'week' | 'month';
const HATCH: ViewStyle = {
  backgroundColor: C.fill,
  borderWidth: 1,
  borderStyle: 'dashed',
  borderColor: C.line,
};
const localKey = (iso: string) => toLocalDateKey(new Date(iso));
const localMinutes = (iso: string) => timeToMinutes(formatTimeDZ(iso));
const nowMinutes = () => timeToMinutes(formatTimeDZ(new Date().toISOString()));
const tone = (key: string) => CAT[key] ?? CAT.nail!;
const hm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export default function AgendaPro() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const [view, setView] = useState<View3>('day');
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
  useRealtimeBookings(salon?.id);

  const toneOf = (b: BookingWithStaff) =>
    categoryTone(salon?.services.find((s) => s.id === b.serviceId)?.categoryId);
  const [staffId, setStaffId] = useStaffFilter();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const carouselY = useRef(0);
  const timelineY = useRef(0);
  const scrolledToNow = useRef<string | null>(null);
  const items = useMemo(
    () =>
      (bookings.data?.items ?? []).filter(
        (b) => b.status !== 'cancelled' && (!staffId || b.staffId === staffId),
      ),
    [bookings.data, staffId],
  );
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
  const shift = (n: number) =>
    setDate(
      view === 'month'
        ? addDaysToKey(monthStart, n > 0 ? 32 : -1).slice(0, 8) + '01'
        : addDaysToKey(date, n * (view === 'week' ? 7 : 1)),
    );
  const openBooking = (id: string) => router.push(`/pro-rdv/${id}` as never);
  const newBooking = () => router.push({ pathname: '/pro-rdv/nouveau', params: { date } });

  const header =
    view === 'day' ? (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View>
          <Tx size={12} color={C.muted} lh={16}>
            {date === today ? "Aujourd'hui · " : ''}
            {DAY_LABELS_FR[dayOfWeekFromKey(date)]}
          </Tx>
          <Tx size={23} weight={700} ls={-0.8} lh={26}>
            {Number(date.slice(8, 10))} {MONTHS_FR[Number(date.slice(5, 7)) - 1]}
          </Tx>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton
            lg
            accessibilityLabel="Rechercher un rendez-vous"
            onPress={() => router.push('/(pro)/(tabs)/clients')}
          >
            <I icon={Search} size={16} />
          </IconButton>
          <IconButton lg accessibilityLabel="Aujourd'hui" onPress={() => setDate(today)}>
            <I icon={Calendar} size={16} />
          </IconButton>
        </View>
      </View>
    ) : (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Tx size={12} color={C.muted} lh={16}>
            {view === 'week'
              ? `Semaine ${isoWeek(date)} · ${MONTHS_FR[Number(week[0]!.slice(5, 7)) - 1]} ${week[0]!.slice(0, 4)}`
              : date.slice(0, 4)}
          </Tx>
          <Tx size={23} weight={700} ls={-0.8} lh={26}>
            {view === 'week'
              ? `${Number(week[0]!.slice(8, 10))} – ${Number(week[6]!.slice(8, 10))} ${MONTHS_FR[Number(week[6]!.slice(5, 7)) - 1]}`
              : MONTHS_FR[Number(date.slice(5, 7)) - 1]!.replace(/^\p{L}/u, (c) => c.toUpperCase())}
          </Tx>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton lg accessibilityLabel="Précédent" onPress={() => shift(-1)}>
            <I icon={ChevronLeft} size={16} />
          </IconButton>
          <IconButton lg accessibilityLabel="Suivant" onPress={() => shift(1)}>
            <I icon={ChevronRight} size={16} />
          </IconButton>
        </View>
      </View>
    );

  return (
    <Screen
      scrollRef={scrollRef}
      gap={13}
      bottom={NAV_PAD + 60}
      footer={
        view === 'day' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nouveau rendez-vous"
            onPress={newBooking}
            style={[
              {
                position: 'absolute',
                right: 16,
                bottom: NAV_PAD - 8,
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: C.ink,
                alignItems: 'center',
                justifyContent: 'center',
              },
              SHADOW.fab,
            ]}
          >
            <I icon={Plus} size={23} color="#fff" />
          </Pressable>
        ) : undefined
      }
    >
      {header}
      <StaffFilter staff={salon.staff} value={staffId} onChange={setStaffId} />
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
          <DayScroller selected={date} onSelect={setDate} disabledDays={closedDays} />
          <View onLayout={(e) => (carouselY.current = e.nativeEvent.layout.y)}>
            <DayCarousel
              date={date}
              onChange={setDate}
              width={Math.max(0, winWidth - 32)}
              render={(d) => {
                const items = (byDay.get(d) ?? []).sort((a, b) =>
                  a.startsAt.localeCompare(b.startsAt),
                );
                const revenue = items
                  .filter((b) => b.status !== 'no_show')
                  .reduce((a, b) => a + b.priceDa, 0);
                const pending = items.filter((b) => b.status === 'pending').length;
                const dayBlk = (blocks.data?.items ?? []).filter((t) => localKey(t.startsAt) === d);
                return (
                  <View style={{ gap: 13 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Tx size={12} lh={16}>
                        <Tx size={12} weight={700} lh={16}>
                          {items.length} rendez-vous
                        </Tx>{' '}
                        <Tx size={12} color={C.muted} lh={16}>
                          · {formatDA(revenue)}
                        </Tx>
                      </Tx>
                      {pending > 0 && (
                        <Badge tone="pd" md>
                          {pending} en attente
                        </Badge>
                      )}
                    </View>
                    <View
                      onLayout={(e) => {
                        if (d === today) timelineY.current = e.nativeEvent.layout.y;
                      }}
                    >
                      <DayTimeline
                        date={d}
                        items={items}
                        blocks={dayBlk}
                        hours={dayHours(d)}
                        toneOf={toneOf}
                        onOpen={openBooking}
                        onFree={(t) =>
                          router.push({
                            pathname: '/pro-rdv/nouveau',
                            params: { date: d, time: t, ...(staffId ? { staff: staffId } : {}) },
                          } as never)
                        }
                        onNowLayout={(y) => {
                          // Aujourd'hui : l'heure actuelle est amenée au centre de l'écran (suivi de la journée en direct).
                          if (d !== today || scrolledToNow.current === date) return;
                          scrolledToNow.current = date;
                          setTimeout(
                            () =>
                              scrollRef.current?.scrollTo({
                                y: Math.max(
                                  0,
                                  carouselY.current + timelineY.current + y - winHeight / 2,
                                ),
                                animated: true,
                              }),
                            150,
                          );
                        }}
                      />
                    </View>
                  </View>
                );
              }}
            />
          </View>
        </>
      )}

      {view === 'week' && (
        <DayCarousel
          date={date}
          prev={addDaysToKey(date, -7)}
          next={addDaysToKey(date, 7)}
          onChange={setDate}
          width={Math.max(0, winWidth - 32)}
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
          width={Math.max(0, winWidth - 32)}
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
              onOpen={openBooking}
            />
          )}
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
  return (
    1 +
    Math.round(((d.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
  );
}

/** Vue jour : ligne de temps de l'ouverture à la fermeture (92 px par heure, design). */
function DayTimeline({
  date,
  items,
  blocks,
  hours,
  toneOf,
  onOpen,
  onFree,
  onNowLayout,
}: {
  date: string;
  items: BookingWithStaff[];
  blocks: { startsAt: string; endsAt: string; reason: string | null }[];
  hours: { opensAt: string; closesAt: string }[];
  toneOf: (b: BookingWithStaff) => string;
  onOpen: (id: string) => void;
  onFree: (timeHM: string) => void;
  onNowLayout?: (y: number) => void;
}) {
  if (hours.length === 0 && items.length === 0)
    return (
      <View style={{ paddingVertical: 20 }}>
        <P center>Fermé ce jour.</P>
      </View>
    );
  const startMin = Math.min(
    ...(hours.length ? hours.map((h) => timeToMinutes(h.opensAt)) : [8 * 60]),
    ...items.map((b) => localMinutes(b.startsAt)),
  );
  const endMin = Math.max(
    ...(hours.length ? hours.map((h) => timeToMinutes(h.closesAt)) : [19 * 60]),
    ...items.map((b) => localMinutes(b.endsAt)),
  );
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
  // Fin de journée libre (et journée entière libre sans rendez-vous) : cliquable pour ajouter un rendez-vous.
  if (endMin - cursor >= 30) gaps.push({ s: cursor, e: endMin });
  // Aujourd'hui : le passé n'est pas « libre » — les trous commencent au prochain quart d'heure après maintenant.
  if (isToday) {
    const from = Math.ceil(now / 15) * 15;
    for (const g of gaps) g.s = Math.max(g.s, from);
    for (let i = gaps.length - 1; i >= 0; i--) if (gaps[i]!.e - gaps[i]!.s < 15) gaps.splice(i, 1);
  }
  const closedRanges: { s: number; e: number; label: string }[] = [];
  const sortedHours = [...hours].sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  for (let i = 1; i < sortedHours.length; i++)
    closedRanges.push({
      s: timeToMinutes(sortedHours[i - 1]!.closesAt),
      e: timeToMinutes(sortedHours[i]!.opensAt),
      label: 'Pause',
    });
  for (const t of blocks)
    closedRanges.push({
      s: localMinutes(t.startsAt),
      e: Math.min(endMin, localMinutes(t.endsAt)),
      label: t.reason ?? 'Blocage',
    });

  return (
    <View style={{ height }}>
      {hourMarks.map((m) => (
        <View key={m} style={{ position: 'absolute', left: 0, right: 0, top: top(m) }}>
          <Tx size={12} color={C.subtle} lh={16} style={{ position: 'absolute', top: -8, left: 0 }}>
            {hm(m)}
          </Tx>
          <View style={{ marginLeft: 46, borderTopWidth: 1, borderTopColor: C.lineSoft }} />
        </View>
      ))}
      {gaps.map((g) => (
        <Pressable
          key={`gap-${g.s}`}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter un rendez-vous à ${hm(g.s)}`}
          onPress={() => onFree(hm(g.s))}
          style={[
            {
              position: 'absolute',
              left: 47,
              right: 0,
              top: top(g.s) + 2,
              height: (g.e - g.s) * PX - 4,
              borderRadius: 10,
              justifyContent: 'center',
              paddingHorizontal: 13,
              flexDirection: 'row',
              alignItems: 'center',
            },
            HATCH,
          ]}
        >
          <Tx size={12} color={C.subtle} lh={16} style={{ flex: 1 }}>
            Libre · {formatDuration(g.e - g.s)}
          </Tx>
          <Tx size={9.5} color={C.subtle} lh={13}>
            toucher pour réserver
          </Tx>
        </Pressable>
      ))}
      {closedRanges.map((c) => (
        <View
          key={`c-${c.s}-${c.label}`}
          style={[
            {
              position: 'absolute',
              left: 47,
              right: 0,
              top: top(c.s) + 2,
              height: Math.max(20, (c.e - c.s) * PX - 4),
              borderRadius: 10,
              justifyContent: 'center',
              paddingHorizontal: 13,
            },
            HATCH,
          ]}
        >
          <Tx size={12} color={C.subtle} lh={16} numberOfLines={1}>
            {c.label} · {hm(c.s)} – {hm(c.e)}
          </Tx>
        </View>
      ))}
      {sorted.map((b) => {
        const s = localMinutes(b.startsAt);
        const e = localMinutes(b.endsAt);
        const t = tone(toneOf(b));
        return (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={`${b.clientName} · ${b.serviceName}`}
            onPress={() => onOpen(b.id)}
            style={{
              position: 'absolute',
              left: 47,
              right: 0,
              top: top(s) + 2,
              height: Math.max(44, (e - s) * PX - 4),
              overflow: 'hidden',
              borderRadius: 10,
              borderLeftWidth: 3,
              borderLeftColor: t.line,
              backgroundColor: t.bg,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Tx size={10.5} weight={600} lh={14.5} color={t.fg} numberOfLines={1}>
              {b.clientName} · {b.serviceName}
            </Tx>
            <Tx size={11.5} lh={14.5} color={t.fg} mono style={{ opacity: 0.8 }}>
              {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)} · {formatDA(b.priceDa)}
            </Tx>
            {b.status === 'pending' && (
              <View style={{ marginTop: 3 }}>
                <Badge tone="pd" dot={false}>
                  En attente
                </Badge>
              </View>
            )}
          </Pressable>
        );
      })}
      {isToday && (
        <View
          pointerEvents="none"
          onLayout={(e) => onNowLayout?.(e.nativeEvent.layout.y)}
          style={{
            position: 'absolute',
            left: 37,
            right: 0,
            top: top(Math.min(Math.max(now, startMin), endMin)),
            borderTopWidth: 1.5,
            borderTopColor: C.danger,
            zIndex: 10,
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: -3,
              top: -4,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: C.danger,
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: -15,
              backgroundColor: C.danger,
              borderRadius: 999,
              paddingHorizontal: 6,
              paddingVertical: 1,
            }}
          >
            <Tx size={9} weight={600} color="#fff" lh={12}>
              {hm(now)}
              {now > endMin ? ' · journée terminée' : now < startMin ? " · avant l'ouverture" : ''}
            </Tx>
          </View>
        </View>
      )}
    </View>
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
  const total = week.reduce((a, d) => a + (byDay.get(d)?.length ?? 0), 0);
  const revenue = week.reduce(
    (a, d) => a + (byDay.get(d) ?? []).reduce((x, b) => x + b.priceDa, 0),
    0,
  );
  const busyMin = week.reduce(
    (a, d) => a + (byDay.get(d) ?? []).reduce((x, b) => x + b.durationMinutes, 0),
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
    <View style={{ gap: 13 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            backgroundColor: C.fill,
            borderRadius: 812,
            paddingHorizontal: 11,
            paddingVertical: 6,
          }}
        >
          <Tx size={10.5} weight={600} lh={14.5}>
            {total} rendez-vous
          </Tx>
        </View>
        <Badge tone="ok" md>
          {formatDA(revenue)}
        </Badge>
        <Tx size={10.5} color={C.muted} lh={14.5}>
          {occupancy} % occupé
        </Tx>
      </View>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        <View style={{ width: 21, height: H + 56 }}>
          {hours.map((m) => (
            <Tx
              key={m}
              size={10.5}
              color={C.subtle}
              lh={13}
              style={{ position: 'absolute', left: 0, top: 46 + (m - startMin) * px - 8 }}
            >
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
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={d}
              onPress={() => onSelect(d)}
              style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 6 }}
            >
              <Tx size={12} color={closed ? C.disabled : C.muted} lh={16}>
                {DAY_LABELS_SHORT_FR[dow]}
              </Tx>
              <View
                style={{
                  height: 29,
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  backgroundColor: on ? C.ink : 'transparent',
                }}
              >
                <Tx
                  size={12}
                  weight={700}
                  lh={16}
                  color={on ? '#fff' : closed ? C.disabled : C.text}
                >
                  {Number(d.slice(8, 10))}
                </Tx>
              </View>
              <View
                style={[
                  {
                    width: '100%',
                    height: H,
                    borderRadius: 10,
                    overflow: 'hidden',
                    backgroundColor: C.surface,
                    borderWidth: on ? 1.5 : 1,
                    borderColor: on ? C.ink : C.lineSoft,
                  },
                  closed ? HATCH : null,
                ]}
              >
                {!closed &&
                  list.map((b) => {
                    const s = Math.max(startMin, localMinutes(b.startsAt));
                    const e = Math.min(endMin, localMinutes(b.endsAt));
                    const t = tone(toneOf(b));
                    return (
                      <View
                        key={b.id}
                        style={{
                          position: 'absolute',
                          left: 2,
                          right: 2,
                          top: (s - startMin) * px,
                          height: Math.max(10, (e - s) * px),
                          borderRadius: 6,
                          borderLeftWidth: 3,
                          borderLeftColor: t.line,
                          backgroundColor: t.bg,
                        }}
                      />
                    );
                  })}
                {on && d === today && nowMinutes() >= startMin && nowMinutes() <= endMin && (
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: (nowMinutes() - startMin) * px,
                      borderTopWidth: 1,
                      borderTopColor: C.danger,
                    }}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 13 }}>
        <Legend swatch={{ backgroundColor: CAT.nail!.bg }} label="Réservé" />
        <Legend
          swatch={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.line }}
          label="Libre"
        />
        <Legend swatch={HATCH} label="Fermé" />
      </View>
    </View>
  );
}

function Legend({ swatch, label }: { swatch: ViewStyle; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={[{ width: 16, height: 10, borderRadius: 3 }, swatch]} />
      <Tx size={12} color={C.muted} lh={16}>
        {label}
      </Tx>
    </View>
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
  const rows = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  const list = (byDay.get(selected) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const revenue = list.reduce((a, b) => a + b.priceDa, 0);
  return (
    <View style={{ gap: 13 }}>
      <View style={{ gap: 5 }}>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((l, i) => (
            <Tx
              key={i}
              size={12}
              lh={16}
              center
              color={closedDays.includes(i) ? C.disabled : C.subtle}
              style={{ flex: 1, paddingVertical: 3 }}
            >
              {l}
            </Tx>
          ))}
        </View>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 5 }}>
            {row.map((d) => {
              const inMonth = d.slice(0, 7) === month;
              const closed = closedDays.includes(dayOfWeekFromKey(d));
              const on = d === selected;
              const dots = (byDay.get(d) ?? []).slice(0, 4);
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityLabel={d}
                  onPress={() => (on ? onOpenDay(d) : onSelect(d))}
                  style={[
                    {
                      flex: 1,
                      height: 60,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      borderRadius: 11,
                      borderWidth: 1,
                      borderColor: on ? C.ink : inMonth ? C.lineSoft : 'transparent',
                      backgroundColor: on ? C.ink : inMonth ? C.surface : 'transparent',
                    },
                    closed && !on ? HATCH : null,
                  ]}
                >
                  <Tx
                    size={12}
                    weight={on || d === today ? 700 : 400}
                    lh={16}
                    color={on ? '#fff' : !inMonth || closed ? C.disabled : C.text}
                  >
                    {Number(d.slice(8, 10))}
                  </Tx>
                  <View style={{ flexDirection: 'row', gap: 3, height: 5 }}>
                    {dots.map((b) => (
                      <View
                        key={b.id}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 2,
                          backgroundColor: on ? '#fff' : tone(toneOf(b)).line,
                        }}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 5, height: 5, borderRadius: 2, backgroundColor: CAT.nail!.line }} />
          <Tx size={12} color={C.muted} lh={16}>
            1 point = 1 rendez-vous
          </Tx>
        </View>
        <Legend swatch={HATCH} label="Fermé" />
      </View>
      <ListCard>
        <Row py={13} onPress={() => onOpenDay(selected)}>
          <Tx size={14} weight={700} ls={-0.3} lh={18}>
            {DAY_LABELS_FR[dayOfWeekFromKey(selected)]} {Number(selected.slice(8, 10))}{' '}
            {MONTHS_FR[Number(selected.slice(5, 7)) - 1]}
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            {list.length} rendez-vous · {formatDA(revenue)}
          </Tx>
        </Row>
        {list.map((b) => (
          <Row
            key={b.id}
            py={10}
            chevron={false}
            onPress={() => onOpen(b.id)}
            right={<StatusBadge status={b.status} />}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 2,
                  height: 23,
                  borderRadius: 2,
                  backgroundColor: tone(toneOf(b)).line,
                }}
              />
              <View style={{ flex: 1 }}>
                <Tx size={10.5} lh={14.5}>
                  {b.clientName} · {b.serviceName}
                </Tx>
                <Tx size={11.5} color={C.muted} lh={14.5} mono>
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
