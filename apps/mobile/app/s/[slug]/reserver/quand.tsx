/**
 * C-F 09 — Quand ? Semaine (dimanche → samedi), créneaux Matin / Après-midi / Soir,
 * créneaux grisés = déjà réservés, information sur la durée, « Continuer · 14:30 ».
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAvailability, useSalon } from '@salondz/api-client';
import { addDaysToKey, dayOfWeekFromKey, formatDA, formatTimeDZ, localDateTimeToISO, minutesToTime, timeToMinutes, toLocalDateKey } from '@salondz/constants';
import { readDraft, writeDraft } from '@/lib/bookingDraft';
import { formatDuration } from '@/lib/format';
import { Avatar, BottomSheet, Button, Card, ErrorText, Grid, H1, InfoBox, P, SectionLabel, Skeleton, Slot, TopBar, Tx } from '@/ui';
import { DayStrip, MonthNav } from '@/ui/DaySelector';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

type Period = 'Matin' | 'Après-midi' | 'Soir';
const periodOf = (hm: string): Period => (timeToMinutes(hm) < 12 * 60 ? 'Matin' : timeToMinutes(hm) < 17 * 60 ? 'Après-midi' : 'Soir');

export default function BookingWhen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const salon = useSalon(slug);
  const draft = readDraft(slug);
  const today = toLocalDateKey();
  const [date, setDate] = useState(draft.date ?? today);
  const [weekOf, setWeekOf] = useState(draft.date ?? today);
  const [slot, setSlot] = useState<string | null>(draft.startsAt ?? null);
  const serviceIds = draft.serviceIds;
  const s = salon.data;
  const availability = useAvailability(s?.id ?? '', { serviceIds: serviceIds.join(','), date });

  useEffect(() => {
    setSlot((cur) => (cur && cur.startsWith(date) ? cur : null));
  }, [date]);

  const chosen = useMemo(() => (s ? serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean) : []), [s, serviceIds]);
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);

  /** Grille complète du jour (pas du salon) : les créneaux absents des disponibilités sont grisés. */
  const grid = useMemo(() => {
    if (!s || !availability.data) return [] as { time: string; iso: string; free: boolean }[];
    const dow = dayOfWeekFromKey(date);
    const hours = s.openingHours.filter((h) => h.dayOfWeek === dow && !h.isClosed);
    const free = new Set(availability.data.slots.map((x) => formatTimeDZ(x.startsAt)));
    const out: { time: string; iso: string; free: boolean }[] = [];
    for (const h of hours) {
      for (let m = timeToMinutes(h.opensAt); m + minutes <= timeToMinutes(h.closesAt); m += availability.data.slotIntervalMinutes) {
        const t = minutesToTime(m);
        out.push({ time: t, iso: localDateTimeToISO(date, t), free: free.has(t) });
      }
    }
    if (out.length === 0) for (const x of availability.data.slots) out.push({ time: formatTimeDZ(x.startsAt), iso: x.startsAt, free: true });
    return out;
  }, [s, availability.data, date, minutes]);

  if (serviceIds.length === 0) return <Redirect href={`/s/${slug}/prestations` as never} />;
  if (salon.isPending) return <Splash />;
  if (salon.isError || !s)
    return (
      <Screen center>
        <ErrorText error={salon.error} retry={() => void salon.refetch()} />
      </Screen>
    );

  const maxDate = addDaysToKey(today, s.bookingHorizonDays);
  const closedDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.openingHours.some((h) => h.dayOfWeek === d && !h.isClosed));
  const groups = new Map<Period, typeof grid>();
  for (const g of grid) groups.set(periodOf(g.time), [...(groups.get(periodOf(g.time)) ?? []), g]);
  const chosenSlot = grid.find((g) => g.iso === slot);
  const endTime = chosenSlot ? minutesToTime(timeToMinutes(chosenSlot.time) + minutes) : null;

  return (
    <Screen
      gap={16}
      footer={
        <BottomSheet>
          <Button
            disabled={!slot}
            onPress={() => {
              writeDraft(slug, { date, startsAt: slot! });
              router.push(`/s/${s.slug}/reserver/coordonnees` as never);
            }}
          >
            {chosenSlot ? `Continuer · ${chosenSlot.time}` : 'Choisissez un créneau'}
          </Button>
        </BottomSheet>
      }
    >
      <TopBar backTo={`/s/${s.slug}/prestations`} right="Étape 3 sur 4" />
      <H1>Quand ?</H1>
      <Card row gap={14}>
        <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={64} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={20} weight={700} ls={-0.3} lh={25}>
            {s.name}
          </Tx>
          <Tx size={16} color={C.muted} lh={22}>
            {chosen.map((x) => x!.name).join(' + ')} · {formatDuration(minutes)} · {formatDA(price)}
          </Tx>
        </View>
      </Card>
      <MonthNav weekOf={weekOf} onWeekChange={setWeekOf} minDate={today} maxDate={maxDate} />
      <DayStrip weekOf={weekOf} selected={date} onSelect={setDate} minDate={today} maxDate={maxDate} disabledDays={closedDays} />

      {closedDays.includes(dayOfWeekFromKey(date)) ? (
        <P>Le salon est fermé ce jour-là.</P>
      ) : availability.isPending || availability.isFetching ? (
        <View style={{ gap: 12 }}>
          <Skeleton h={16} w={80} />
          <Skeleton h={64} />
          <Skeleton h={64} />
        </View>
      ) : availability.isError ? (
        <ErrorText error={availability.error} retry={() => void availability.refetch()} />
      ) : grid.length === 0 ? (
        <P>Plus de créneau disponible ce jour. Essayez un autre jour.</P>
      ) : (
        [...groups.entries()].map(([period, list]) => (
          <View key={period} style={{ gap: 12 }}>
            <SectionLabel>{period}</SectionLabel>
            <Grid cols={3}>
              {list.map((g) => (
                <Slot key={g.iso} on={slot === g.iso} off={!g.free} onPress={() => g.free && setSlot(g.iso)} style={{ paddingVertical: 22 }}>
                  <Tx size={20} weight={500} lh={24} mono color={slot === g.iso ? C.onInk : g.free ? C.text : C.disabled}>
                    {g.time}
                  </Tx>
                </Slot>
              ))}
            </Grid>
          </View>
        ))
      )}

      {grid.length > 0 && <InfoBox>{chosenSlot ? `Créneau de ${formatDuration(minutes)} : ${chosenSlot.time} → ${endTime}. Les créneaux grisés sont déjà réservés.` : `Durée totale ${formatDuration(minutes)}. Les créneaux grisés sont déjà réservés.`}</InfoBox>}
    </Screen>
  );
}
