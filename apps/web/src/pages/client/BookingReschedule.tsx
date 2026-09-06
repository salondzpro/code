/** C-F 16 — Reporter le rendez-vous : créneau actuel, semaine, créneaux du jour, « Demander le report ». */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Clock } from 'lucide-react';
import { useAvailability, useBooking, useRescheduleBooking, useSalon } from '@salondz/api-client';
import { DAY_LABELS_FR, addDaysToKey, dayOfWeekFromKey, formatDateLongDZ, formatTimeDZ, localDateTimeToISO, minutesToTime, timeToMinutes, toLocalDateKey } from '@salondz/constants';
import { BottomSheet, Button, I, InfoBox, Skeleton, Slot, TopBar } from '@/components/ui';
import { DayStrip, MonthNav, dayNumber } from '@/components/DaySelector';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';

export function BookingReschedule() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
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
  if (booking.isError) return <ErrorMessage error={booking.error} retry={() => booking.refetch()} />;
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
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo={`/rendez-vous/${b.id}`} right="Reporter" />
      <h1 className="h1">Nouveau créneau</h1>
      <div className="sf flex items-center gap-3 text-[17px] text-muted">
        <I icon={Clock} size={18} />
        <span>
          Actuel · {formatDateLongDZ(b.startsAt).replace(/^\w/, (c) => c.toLowerCase())}, {formatTimeDZ(b.startsAt)}
        </span>
      </div>
      <MonthNav weekOf={weekOf} onWeekChange={setWeekOf} minDate={today} maxDate={maxDate} />
      <DayStrip weekOf={weekOf} selected={date} onSelect={setDate} minDate={today} maxDate={maxDate} disabledDays={closedDays} />
      <span className="h3">
        Créneaux · {DAY_LABELS_FR[dow].toLowerCase()} {dayNumber(date)}
      </span>
      {closedDays.includes(dow) ? (
        <p className="p">Le salon est fermé ce jour-là.</p>
      ) : availability.isPending || availability.isFetching ? (
        <Skeleton className="h-[140px] w-full" />
      ) : availability.isError ? (
        <ErrorMessage error={availability.error} retry={() => availability.refetch()} />
      ) : grid.length === 0 ? (
        <p className="p">Plus de créneau disponible ce jour.</p>
      ) : (
        <div className="g3">
          {grid.map((g) => (
            <Slot key={g.iso} on={slot === g.iso} off={!g.free} onClick={() => g.free && setSlot(g.iso)} className="!py-[22px] !text-[20px]">
              {g.time}
            </Slot>
          ))}
        </div>
      )}
      <InfoBox>Le professionnel reçoit la demande sur WhatsApp et confirme le nouveau créneau.</InfoBox>
      <ErrorMessage error={reschedule.error} />
      <BottomSheet>
        <Button
          disabled={!slot || reschedule.isPending}
          onClick={async () => {
            await reschedule.mutateAsync({ id: b.id, startsAt: slot!, staffId: b.staffId });
            navigate(`/rendez-vous/${b.id}`, { replace: true });
          }}
        >
          {reschedule.isPending ? 'Envoi…' : 'Demander le report'}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
