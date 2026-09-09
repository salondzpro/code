/** Espace pro — Horaires d'un membre (page dédiée) : horaires du salon ou personnalisés, pauses par jour. */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProSalon, useProStaffMutations, useStaffHours } from '@salondz/api-client';
import { DAY_LABELS_SHORT_FR, formatDayRanges, rangesFromRows, rowError, rowsFromRanges, type DayHoursRow } from '@salondz/constants';
import type { OpeningHour } from '@salondz/types';
import { errorText } from '@/lib/errors';
import { Alert, BottomSheet, Button, Card, H1, P, SectionLabel, Segmented, Skeleton, TopBar, Tx } from '@/ui';
import { WeekHoursEditor } from '@/ui/WeekHours';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

const salonRanges = (hours: OpeningHour[]) => hours.filter((h) => !h.isClosed).map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.opensAt, end: h.closesAt }));

export default function TeamMemberHours() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const member = salon?.staff.find((m) => m.id === id) ?? null;
  const hours = useStaffHours(id, !!member);
  const { setHours } = useProStaffMutations();
  const [custom, setCustom] = useState(false);
  const [rows, setRows] = useState<DayHoursRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);
  useEffect(() => {
    if (!salon || !hours.data || seeded.current) return;
    seeded.current = true;
    const base = rowsFromRanges([], salonRanges(salon.openingHours)).map((r) => ({ ...r, open: salon.openingHours.some((h) => h.dayOfWeek === r.dayOfWeek && !h.isClosed) }));
    if (hours.data.length === 0) {
      setCustom(false);
      setRows(base);
    } else {
      setCustom(true);
      setRows(rowsFromRanges(hours.data.map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.startsAt, end: h.endsAt })), salonRanges(salon.openingHours)));
    }
  }, [salon, hours.data]);
  if (!salon) return <Splash />;
  if (!member)
    return (
      <Screen gap={13}>
        <TopBar backTo="/(pro)/(tabs)/equipe" />
        <P>Membre introuvable.</P>
      </Screen>
    );
  const invalid = custom && rows.some((r) => rowError(r) !== null);
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/membre/${member.id}` as never));
  const save = async () => {
    setError(null);
    try {
      await setHours.mutateAsync({ id: member.id, hours: custom ? rangesFromRows(rows).map((r) => ({ dayOfWeek: r.dayOfWeek, startsAt: r.start, endsAt: r.end })) : [] });
      back();
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <Screen
      gap={13}
      footer={
        <BottomSheet grab={false}>
          <Button onPress={() => void save()} disabled={setHours.isPending || invalid || hours.isPending} loading={setHours.isPending}>
            Enregistrer
          </Button>
        </BottomSheet>
      }
    >
      <TopBar backTo={`/membre/${member.id}`} right={member.displayName} />
      <H1>Horaires</H1>
      <Segmented
        label="Horaires"
        value={custom ? 'custom' : 'salon'}
        onChange={(v) => setCustom(v === 'custom')}
        options={[
          { value: 'salon', label: 'Horaires du salon' },
          { value: 'custom', label: 'Horaires personnalisés' },
        ]}
      />
      {hours.isPending || rows.length === 0 ? <Skeleton h={98} /> : custom ? <WeekHoursEditor rows={rows} onChange={setRows} closedLabel="Repos" /> : <P>Ce membre est réservable sur tous les horaires d'ouverture du salon.</P>}
      {!custom && (
        <Card gap={4}>
          <SectionLabel>Horaires du salon</SectionLabel>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const ranges = salon.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed).map((h) => ({ start: h.opensAt, end: h.closesAt }));
            return (
              <View key={d} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Tx size={11.5} lh={15} color={ranges.length ? C.text : C.subtle}>
                  {DAY_LABELS_SHORT_FR[d as 0]}
                </Tx>
                <Tx size={11.5} lh={15} color={C.muted}>
                  {formatDayRanges(ranges)}
                </Tx>
              </View>
            );
          })}
        </Card>
      )}
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
