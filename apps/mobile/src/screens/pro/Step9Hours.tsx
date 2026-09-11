/**
 * PRO-F 11 — Étape 9 : horaires par jour (interrupteur + plage) et pause facultative PAR JOUR
 * (ex. vendredi 12:00–14:00 uniquement). Une journée avec pause = deux plages en base. Semaine commençant dimanche.
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { rangesFromRows, rowError, rowsFromRanges, type DayHoursRow } from '@salondz/constants';
import { errorText } from '@/lib/errors';
import { stepPath } from '@/lib/proDraft';
import { Alert, H1, ListCard, P, Row, Tx } from '@/ui';
import { WeekHoursEditor } from '@/ui/WeekHours';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C } from '@/theme/design';

export function Step9Hours({ settings }: { settings?: boolean }) {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { setHours } = useProSalonMutations();
  const [rows, setRows] = useState<DayHoursRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salon) return;
    setRows(rowsFromRanges(salon.openingHours.filter((h) => !h.isClosed).map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.opensAt, end: h.closesAt }))));
  }, [salon]);

  if (!salon || rows.length === 0) return <Splash />;
  const invalid = rows.some((r) => rowError(r) !== null);

  const save = async () => {
    setError(null);
    const open = rangesFromRows(rows).map((r) => ({ dayOfWeek: r.dayOfWeek, opensAt: r.start, closesAt: r.end, isClosed: false }));
    const closed = rows.filter((r) => !r.open).map((r) => ({ dayOfWeek: r.dayOfWeek, opensAt: r.opensAt, closesAt: r.closesAt, isClosed: true }));
    try {
      await setHours.mutateAsync({ hours: [...open, ...closed] });
      if (settings) router.replace('/(pro)/(tabs)/profil-pro');
      else router.push(stepPath(10) as never);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen gap={13} footer={<StepSheet label={settings ? 'Enregistrer' : 'Continuer'} onPress={() => void save()} disabled={invalid} busy={setHours.isPending} />}>
      <StepBar step={9} backTo={settings ? '/(pro)/(tabs)/profil-pro' : stepPath(8)} right={settings ? 'Horaires' : undefined} />
      <H1>Horaires</H1>
      <P>Ajoutez une pause sur les jours concernés, par exemple 12:00 – 14:00.</P>
      <WeekHoursEditor rows={rows} onChange={setRows} />
      <ListCard>
        <Row py={13} chevron={false} right={<Tx size={12} color={C.muted} lh={16}>Dimanche</Tx>}>
          <Tx size={12} lh={16}>
            Semaine commençant
          </Tx>
        </Row>
      </ListCard>
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
