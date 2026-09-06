/** C-F 16 — Reporter le rendez-vous : créneau actuel, semaine, créneaux du jour, « Demander le report ». */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useAvailability, useBooking, useRescheduleBooking, useSalon } from '@salondz/api-client';
import { DAY_LABELS_FR, addDaysToKey, dayOfWeekFromKey, formatDateLongDZ, formatTimeDZ, localDateTimeToISO, minutesToTime, timeToMinutes, toLocalDateKey } from '@salondz/constants';
import { dayNumber } from '@/lib/format';
import { BottomSheet, Button, ErrorText, Grid, H1, I, InfoBox, P, SectionLabel, Skeleton, Slot, Soft, TopBar, Tx } from '@/ui';
import { DayStrip, MonthNav } from '@/ui/DaySelector';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function BookingReschedule() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = useBooking(id);
  const b = booking.data;
  const salon = useSalon(b?.salon.slug ?? '');
  const reschedule = useRescheduleBooking();
  const today = toLocalDateKey();
  const [date, setDate] = useState(today);
  const [weekOf, setWeekOf] = useState(today);
  const [slot, setSlot] = useState<string | null>(null);
  const serviceIds = useMemo(() => (b ? (b.items?.length ? b.items.map((i) => i.serviceId).filter((x): x is string => !!x) : [b.serviceId]) : []), [b]);
  const availability = useAvailability(b?.salonId ?? '', { serviceIds: serviceIds.join(','), date, staffId: b?.staffId ?? undefined });

  useEffect(() => {
    if (b) {
      const d = toLocalDateKey(new Date(b.startsAt));
      setDate(d);
      setWeekOf(d);
    }
  }, [b]);
  useEffect(() => setSlot(null), [date]);

  if (booking.isPending || (b && salon.isPending)) return <Splash />;
  if (booking.isError)
    return (
      <Screen center>
        <ErrorText error={booking.error} retry={() => void booking.refetch()} />
      </Screen>
    );
  if (!b || !salon.data) return null;
  const s = salon.data;
  const maxDate = addDaysToKey(today, s.bookingHorizonDays);
  const closedDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.openingHours.some((h) => h.dayOfWeek === d && !h.isClosed));
  const dow = dayOfWeekFromKey(date);
  const hours = s.openingHours.filter((h) => h.dayOfWeek === dow && !h.isClosed);
  const free = new Set((availability.data?.slots ?? []).map((x) => formatTimeDZ(x.startsAt)));
  const grid: { time: string; iso: string; free: boolean }[] = [];
  if (availability.data) {
    for (const h of hours) for (let m = timeToMinutes(h.opensAt); m + b.durationMinutes <= timeToMinutes(h.closesAt); m += availability.data.slotIntervalMinutes) grid.push({ time: minutesToTime(m), iso: localDateTimeToISO(date, minutesToTime(m)), free: free.has(minutesToTime(m)) });
    if (grid.length === 0) for (const x of availability.data.slots) grid.push({ time: formatTimeDZ(x.startsAt), iso: x.startsAt, free: true });
  }

  return (
    <Screen
      gap={16}
      footer={
        <BottomSheet>
          <Button
            disabled={!slot || reschedule.isPending}
            loading={reschedule.isPending}
            onPress={async () => {
              await reschedule.mutateAsync({ id: b.id, startsAt: slot!, staffId: b.staffId });
              router.replace(`/rdv/${b.id}` as never);
            }}
          >
            Demander le report
          </Button>
        </BottomSheet>
      }
    >
      <TopBar backTo={`/rdv/${b.id}`} right="Reporter" />
      <H1>Nouveau créneau</H1>
      <Soft style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <I icon={Clock} size={18} color={C.muted} />
        <Tx size={17} color={C.muted} lh={23} style={{ flex: 1 }}>
          Actuel · {formatDateLongDZ(b.startsAt).replace(/^\p{L}/u, (c) => c.toLowerCase())}, {formatTimeDZ(b.startsAt)}
        </Tx>
      </Soft>
      <MonthNav weekOf={weekOf} onWeekChange={setWeekOf} minDate={today} maxDate={maxDate} />
      <DayStrip weekOf={weekOf} selected={date} onSelect={setDate} minDate={today} maxDate={maxDate} disabledDays={closedDays} />
      <SectionLabel>
        Créneaux · {DAY_LABELS_FR[dow].toLowerCase()} {dayNumber(date)}
      </SectionLabel>
      {closedDays.includes(dow) ? (
        <P>Le salon est fermé ce jour-là.</P>
      ) : availability.isPending || availability.isFetching ? (
        <Skeleton h={140} />
      ) : availability.isError ? (
        <ErrorText error={availability.error} retry={() => void availability.refetch()} />
      ) : grid.length === 0 ? (
        <P>Plus de créneau disponible ce jour.</P>
      ) : (
        <Grid cols={3}>
          {grid.map((g) => (
            <Slot key={g.iso} on={slot === g.iso} off={!g.free} onPress={() => g.free && setSlot(g.iso)} style={{ paddingVertical: 22 }}>
              <Tx size={20} weight={500} lh={24} mono color={slot === g.iso ? C.onInk : g.free ? C.text : C.disabled}>
                {g.time}
              </Tx>
            </Slot>
          ))}
        </Grid>
      )}
      <InfoBox>Le professionnel reçoit la demande sur WhatsApp et confirme le nouveau créneau.</InfoBox>
      <ErrorText error={reschedule.error} />
      <View />
    </Screen>
  );
}
