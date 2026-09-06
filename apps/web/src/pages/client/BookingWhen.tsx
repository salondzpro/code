/**
 * C-F 09 — Quand ? Semaine (dimanche → samedi), créneaux Matin / Après-midi / Soir,
 * créneaux grisés = déjà réservés, information sur la durée, « Continuer · 14:30 ».
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useAvailability, useSalon } from '@salondz/api-client';
import { addDaysToKey, dayOfWeekFromKey, formatDA, formatTimeDZ, localDateTimeToISO, minutesToTime, timeToMinutes, toLocalDateKey } from '@salondz/constants';
import { readDraft, writeDraft } from '@/lib/bookingDraft';
import { formatDuration } from '@/lib/format';
import { Avatar, BottomSheet, Button, InfoBox, Skeleton, Slot, TopBar } from '@/components/ui';
import { DayStrip, MonthNav } from '@/components/DaySelector';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';

type Period = 'Matin' | 'Après-midi' | 'Soir';
const periodOf = (hm: string): Period => (timeToMinutes(hm) < 12 * 60 ? 'Matin' : timeToMinutes(hm) < 17 * 60 ? 'Après-midi' : 'Soir');

export function BookingWhen() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
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
    // si le salon n'a pas d'horaires ce jour mais des créneaux (horaires membre), on affiche les dispos
    if (out.length === 0) for (const x of availability.data.slots) out.push({ time: formatTimeDZ(x.startsAt), iso: x.startsAt, free: true });
    return out;
  }, [s, availability.data, date, minutes]);

  if (serviceIds.length === 0) return <Navigate to={`/s/${slug}/prestations`} replace />;
  if (salon.isPending) return <Splash />;
  if (salon.isError || !s) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;

  const maxDate = addDaysToKey(today, s.bookingHorizonDays);
  const closedDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.openingHours.some((h) => h.dayOfWeek === d && !h.isClosed));
  const groups = new Map<Period, typeof grid>();
  for (const g of grid) groups.set(periodOf(g.time), [...(groups.get(periodOf(g.time)) ?? []), g]);
  const chosenSlot = grid.find((g) => g.iso === slot);
  const endTime = chosenSlot ? minutesToTime(timeToMinutes(chosenSlot.time) + minutes) : null;

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo={`/s/${s.slug}/prestations`} right="Étape 3 sur 4" />
      <h1 className="h1">Quand ?</h1>
      <div className="crd !flex-row items-center gap-3.5">
        <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={64} />
        <span className="min-w-0">
          <span className="block text-[20px] font-bold tracking-[-0.3px]">{s.name}</span>
          <span className="block text-[16px] text-muted">
            {chosen.map((x) => x!.name).join(' + ')} · {formatDuration(minutes)} · {formatDA(price)}
          </span>
        </span>
      </div>
      <MonthNav weekOf={weekOf} onWeekChange={setWeekOf} minDate={today} maxDate={maxDate} />
      <DayStrip weekOf={weekOf} selected={date} onSelect={setDate} minDate={today} maxDate={maxDate} disabledDays={closedDays} />

      {closedDays.includes(dayOfWeekFromKey(date)) ? (
        <p className="p">Le salon est fermé ce jour-là.</p>
      ) : availability.isPending || availability.isFetching ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-[64px] w-full" />
          <Skeleton className="h-[64px] w-full" />
        </div>
      ) : availability.isError ? (
        <ErrorMessage error={availability.error} retry={() => availability.refetch()} />
      ) : grid.length === 0 ? (
        <p className="p">Plus de créneau disponible ce jour. Essayez un autre jour.</p>
      ) : (
        [...groups.entries()].map(([period, list]) => (
          <div key={period} className="flex flex-col gap-3">
            <span className="h3">{period}</span>
            <div className="g3">
              {list.map((g) => (
                <Slot key={g.iso} on={slot === g.iso} off={!g.free} onClick={() => g.free && setSlot(g.iso)} className="!py-[22px] !text-[20px]">
                  {g.time}
                </Slot>
              ))}
            </div>
          </div>
        ))
      )}

      {grid.length > 0 && (
        <InfoBox>
          {chosenSlot ? (
            <>
              Créneau de {formatDuration(minutes)} : {chosenSlot.time} → {endTime}. Les créneaux grisés sont déjà réservés.
            </>
          ) : (
            <>Durée totale {formatDuration(minutes)}. Les créneaux grisés sont déjà réservés.</>
          )}
        </InfoBox>
      )}

      <BottomSheet>
        <Button
          disabled={!slot}
          onClick={() => {
            writeDraft(slug, { date, startsAt: slot! });
            navigate(`/s/${s.slug}/reserver/coordonnees`);
          }}
        >
          {chosenSlot ? `Continuer · ${chosenSlot.time}` : 'Choisissez un créneau'}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
