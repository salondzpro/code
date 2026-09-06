/** PRO-F 11 — Étape 9 : horaires par jour (interrupteur + plage), pause déjeuner, semaine commençant dimanche. */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { DAY_LABELS_FR, DEFAULT_OPENING_HOURS, WEEK_DAYS, type DayOfWeek } from '@salondz/constants';
import { errorText } from '@/lib/errors';
import { stepPath } from '@/lib/proDraft';
import { Alert, H1, ListCard, Row, Toggle, Tx } from '@/ui';
import { TimeField } from '@/ui/Pickers';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C } from '@/theme/design';

interface RowT {
  dayOfWeek: DayOfWeek;
  open: boolean;
  opensAt: string;
  closesAt: string;
}

export function Step9Hours({ settings }: { settings?: boolean }) {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { setHours } = useProSalonMutations();
  const [rows, setRows] = useState<RowT[]>([]);
  const [lunch, setLunch] = useState(false);
  const [lunchFrom, setLunchFrom] = useState('12:00');
  const [lunchTo, setLunchTo] = useState('13:00');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salon) return;
    const next: RowT[] = WEEK_DAYS.map((d) => {
      const ranges = salon.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed).sort((a, b) => a.opensAt.localeCompare(b.opensAt));
      const def = DEFAULT_OPENING_HOURS[d]!;
      if (ranges.length === 0) return { dayOfWeek: d, open: false, opensAt: def.opensAt, closesAt: def.closesAt };
      return { dayOfWeek: d, open: true, opensAt: ranges[0]!.opensAt, closesAt: ranges[ranges.length - 1]!.closesAt };
    });
    setRows(next);
    const split = WEEK_DAYS.map((d) => salon.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed).sort((a, b) => a.opensAt.localeCompare(b.opensAt))).find((r) => r.length === 2);
    if (split) {
      setLunch(true);
      setLunchFrom(split[0]!.closesAt);
      setLunchTo(split[1]!.opensAt);
    }
  }, [salon]);

  if (!salon || rows.length === 0) return <Splash />;
  const patch = (d: DayOfWeek, p: Partial<RowT>) => setRows((prev) => prev.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  const invalid = rows.some((r) => r.open && r.opensAt >= r.closesAt) || (lunch && lunchFrom >= lunchTo);

  const save = async () => {
    setError(null);
    const hours = rows.flatMap((r) => {
      if (!r.open) return [{ dayOfWeek: r.dayOfWeek, opensAt: r.opensAt, closesAt: r.closesAt, isClosed: true }];
      if (lunch && lunchFrom > r.opensAt && lunchTo < r.closesAt) {
        return [
          { dayOfWeek: r.dayOfWeek, opensAt: r.opensAt, closesAt: lunchFrom, isClosed: false },
          { dayOfWeek: r.dayOfWeek, opensAt: lunchTo, closesAt: r.closesAt, isClosed: false },
        ];
      }
      return [{ dayOfWeek: r.dayOfWeek, opensAt: r.opensAt, closesAt: r.closesAt, isClosed: false }];
    });
    try {
      await setHours.mutateAsync({ hours });
      if (settings) router.replace('/(pro)/(tabs)/profil-pro');
      else router.push(stepPath(10) as never);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen gap={16} footer={<StepSheet label={settings ? 'Enregistrer' : 'Continuer'} onPress={() => void save()} disabled={invalid} busy={setHours.isPending} />}>
      <StepBar step={9} backTo={settings ? '/(pro)/(tabs)/profil-pro' : stepPath(8)} right={settings ? 'Horaires' : undefined} />
      <H1>Horaires</H1>
      <ListCard>
        {rows.map((r) => (
          <Row key={r.dayOfWeek} py={16} chevron={false} right={<Toggle on={r.open} onChange={(v) => patch(r.dayOfWeek, { open: v })} label={DAY_LABELS_FR[r.dayOfWeek]} />}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Tx size={19} lh={24} color={r.open ? C.text : C.subtle} style={{ width: 104 }}>
                {DAY_LABELS_FR[r.dayOfWeek]}
              </Tx>
              {r.open ? (
                <>
                  <TimeField value={r.opensAt} onChange={(v) => patch(r.dayOfWeek, { opensAt: v })} label={`Ouverture ${DAY_LABELS_FR[r.dayOfWeek]}`} step={30} />
                  <Tx size={19} color={C.muted} lh={24}>
                    {' '}
                    –{' '}
                  </Tx>
                  <TimeField value={r.closesAt} onChange={(v) => patch(r.dayOfWeek, { closesAt: v })} label={`Fermeture ${DAY_LABELS_FR[r.dayOfWeek]}`} step={30} />
                </>
              ) : (
                <Tx size={19} color={C.disabled} lh={24}>
                  Fermé
                </Tx>
              )}
            </View>
          </Row>
        ))}
      </ListCard>
      <ListCard>
        <Row
          py={16}
          chevron={false}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {lunch && (
                <>
                  <TimeField value={lunchFrom} onChange={setLunchFrom} label="Début de pause" step={15} />
                  <Tx size={19} color={C.muted} lh={24}>
                    –
                  </Tx>
                  <TimeField value={lunchTo} onChange={setLunchTo} label="Fin de pause" step={15} />
                </>
              )}
              <Toggle on={lunch} onChange={setLunch} label="Pause déjeuner" />
            </View>
          }
        >
          <Tx size={19} lh={24}>
            Pause déjeuner
          </Tx>
        </Row>
        <Row py={16} chevron={false} right={<Tx size={19} color={C.muted} lh={24}>Dimanche</Tx>}>
          <Tx size={19} lh={24}>
            Semaine commençant
          </Tx>
        </Row>
      </ListCard>
      {invalid && <Alert>L'heure d'ouverture doit précéder la fermeture.</Alert>}
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
