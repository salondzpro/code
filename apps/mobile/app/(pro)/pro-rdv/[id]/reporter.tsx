/** Report par le pro : date, heure, membre (pas de délai minimum). */
import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProBooking, useProBookingMutations, useProSalon } from '@salondz/api-client';
import { formatDateShortDZ, formatTimeDZ, localDateTimeToISO, toLocalDateKey } from '@salondz/constants';
import { BottomSheet, Button, ErrorText, H1, ListCard, Soft, TopBar, Tx } from '@/ui';
import { DateSheet, PickerSheet, TimeSheet, ValueRow } from '@/ui/Pickers';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function ProBookingReschedule() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = useProBooking(id);
  const salon = useProSalon().data?.salon ?? null;
  const { reschedule } = useProBookingMutations();
  const b = booking.data;
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'date' | 'time' | 'staff' | null>(null);
  if (!b || !salon) return <Splash />;
  const d = date ?? toLocalDateKey(new Date(b.startsAt));
  const t = time ?? formatTimeDZ(b.startsAt);
  const staff = salon.staff.filter((s) => s.isActive);
  const sid = staffId ?? b.staffId;

  return (
    <Screen
      gap={16}
      footer={
        <BottomSheet>
          <Button
            disabled={reschedule.isPending}
            loading={reschedule.isPending}
            onPress={async () => {
              await reschedule.mutateAsync({ id: b.id, startsAt: localDateTimeToISO(d, t), staffId: sid });
              router.replace(`/pro-rdv/${b.id}` as never);
            }}
          >
            Valider le report
          </Button>
        </BottomSheet>
      }
    >
      <TopBar backTo={`/pro-rdv/${b.id}`} right="Reporter" />
      <H1>Nouveau créneau</H1>
      <Soft>
        <Tx size={17} color={C.muted} lh={23}>
          Actuel · {formatDateShortDZ(b.startsAt)}, {formatTimeDZ(b.startsAt)} · {b.clientName} · {b.serviceName}
        </Tx>
      </Soft>
      <ListCard>
        <ValueRow label="Date" value={formatDateShortDZ(localDateTimeToISO(d, '12:00'))} onPress={() => setSheet('date')} muted={false} />
        <ValueRow label="Heure" value={t} onPress={() => setSheet('time')} muted={false} />
        {staff.length > 1 && <ValueRow label="Membre" value={staff.find((m) => m.id === sid)?.displayName ?? '—'} onPress={() => setSheet('staff')} muted={false} />}
      </ListCard>
      <ErrorText error={reschedule.error} />
      <DateSheet open={sheet === 'date'} onClose={() => setSheet(null)} title="Nouvelle date" value={d} onChange={setDate} minDate={toLocalDateKey()} />
      <TimeSheet open={sheet === 'time'} onClose={() => setSheet(null)} title="Nouvelle heure" value={t} onChange={setTime} step={5} />
      <PickerSheet open={sheet === 'staff'} onClose={() => setSheet(null)} title="Membre" options={staff.map((m) => ({ value: m.id, label: m.displayName }))} value={sid} onChange={setStaffId} />
    </Screen>
  );
}
