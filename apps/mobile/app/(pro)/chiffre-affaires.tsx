/** PRO-F 23 — Chiffre d'affaires : jour / semaine / mois, barres par jour, encaissé / reste, par prestation. */
import React, { useState } from 'react';
import { Share, View } from 'react-native';
import { Download } from 'lucide-react-native';
import { useProStatsRange } from '@salondz/api-client';
import { DAY_LABELS_SHORT_FR, addDaysToKey, dayOfWeekFromKey, formatDA, toLocalDateKey, weekKeys } from '@salondz/constants';
import { MONTHS_FR } from '@/lib/format';
import { Badge, Card, ErrorText, H1, I, IconButton, ListCard, P, Row, SectionLabel, Segmented, Skeleton, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C } from '@/theme/design';

type Period = 'day' | 'week' | 'month';

function range(period: Period, today: string): { from: string; to: string; label: string } {
  if (period === 'day') return { from: today, to: today, label: `${Number(today.slice(8, 10))} ${MONTHS_FR[Number(today.slice(5, 7)) - 1]}` };
  if (period === 'week') {
    const days = weekKeys(today);
    const from = days[0]!;
    const to = days[6]!;
    const sameMonth = from.slice(0, 7) === to.slice(0, 7);
    return { from, to, label: `${Number(from.slice(8, 10))}${sameMonth ? '' : ` ${MONTHS_FR[Number(from.slice(5, 7)) - 1]}`} – ${Number(to.slice(8, 10))} ${MONTHS_FR[Number(to.slice(5, 7)) - 1]}` };
  }
  const from = `${today.slice(0, 7)}-01`;
  const next = Number(today.slice(5, 7)) === 12 ? `${Number(today.slice(0, 4)) + 1}-01-01` : `${today.slice(0, 4)}-${String(Number(today.slice(5, 7)) + 1).padStart(2, '0')}-01`;
  return { from, to: addDaysToKey(next, -1), label: `${MONTHS_FR[Number(today.slice(5, 7)) - 1]} ${today.slice(0, 4)}` };
}

export default function Revenue() {
  const today = toLocalDateKey();
  const [period, setPeriod] = useState<Period>('week');
  const r = range(period, today);
  const stats = useProStatsRange(r.from, r.to);
  const prev = range(period, addDaysToKey(r.from, -1));
  const prevStats = useProStatsRange(prev.from, prev.to);
  const s = stats.data;
  const delta = s && prevStats.data && prevStats.data.revenueDa > 0 ? Math.round(((s.revenueDa - prevStats.data.revenueDa) / prevStats.data.revenueDa) * 100) : null;
  const max = Math.max(1, ...(s?.byDay.map((d) => d.revenueDa) ?? [1]));
  const exportCsv = () => {
    if (!s) return;
    const rows = [['date', 'rendez-vous', 'chiffre_affaires_da'], ...s.byDay.map((d) => [d.date, String(d.bookings), String(d.revenueDa)])];
    void Share.share({ title: `chiffre-affaires-${r.from}-${r.to}.csv`, message: rows.map((x) => x.join(';')).join('\n') }).catch(() => undefined);
  };

  return (
    <Screen gap={16}>
      <TopBar
        backTo="/(pro)/(tabs)"
        right={
          <IconButton lg accessibilityLabel="Exporter" onPress={exportCsv}>
            <I icon={Download} size={20} />
          </IconButton>
        }
      />
      <H1 size={34} lh={38} ls={-0.8}>
        Chiffre d'affaires
      </H1>
      <Segmented
        label="Période"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'day', label: 'Jour' },
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
        ]}
      />
      {stats.isPending ? (
        <Skeleton h={300} radius={20} />
      ) : stats.isError ? (
        <ErrorText error={stats.error} retry={() => void stats.refetch()} />
      ) : (
        <>
          <Card gap={20}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Tx size={38} weight={700} ls={-1} lh={40}>
                  {formatDA(s!.revenueDa)}
                </Tx>
                <P style={{ marginTop: 8 }}>
                  {r.label} · {s!.bookings} rendez-vous
                </P>
              </View>
              {delta != null && (
                <Badge tone={delta >= 0 ? 'ok' : 'cn'} md>
                  {delta >= 0 ? '+' : ''}
                  {delta} %
                </Badge>
              )}
            </View>
            {period !== 'day' && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 210 }}>
                {s!.byDay.map((d) => {
                  const isToday = d.date === today;
                  const h = Math.max(6, Math.round((d.revenueDa / max) * 170));
                  const dayNum = Number(d.date.slice(8, 10));
                  const showLabel = period === 'week' || dayNum % 5 === 1 || isToday;
                  return (
                    <View key={d.date} style={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <View style={{ width: '100%', height: h, borderRadius: 10, backgroundColor: isToday ? C.ink : C.line }} accessibilityLabel={`${formatDA(d.revenueDa)} · ${d.bookings} RDV`} />
                      {showLabel ? (
                        <Tx size={period === 'week' ? 15 : 12} weight={isToday ? 700 : 400} color={isToday ? C.text : C.muted} lh={period === 'week' ? 20 : 16}>
                          {period === 'week' ? DAY_LABELS_SHORT_FR[dayOfWeekFromKey(d.date)] : String(dayNum)}
                        </Tx>
                      ) : (
                        <View style={{ height: 16 }} />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
          <ListCard>
            <Row py={20} chevron={false} right={<Tx size={24} weight={700} lh={29}>{formatDA(s!.collectedDa)}</Tx>}>
              <Tx size={20} lh={25}>
                Encaissé
              </Tx>
            </Row>
            <Row py={20} chevron={false} right={<Tx size={24} weight={700} lh={29}>{formatDA(s!.remainingDa)}</Tx>}>
              <Tx size={20} lh={25}>
                Reste à encaisser
              </Tx>
              <Tx size={16} color={C.muted} lh={22}>
                {s!.remainingCount} rendez-vous confirmé{s!.remainingCount > 1 ? 's' : ''}
              </Tx>
            </Row>
          </ListCard>
          <SectionLabel>Par prestation</SectionLabel>
          <ListCard>
            {s!.byService.length === 0 && (
              <View style={{ paddingVertical: 12 }}>
                <P>Aucune prestation sur la période.</P>
              </View>
            )}
            {s!.byService.map((x) => (
              <Row key={x.name} py={20} chevron={false} right={<Tx size={22} weight={700} lh={27}>{formatDA(x.revenueDa)}</Tx>}>
                <Tx size={21} weight={700} ls={-0.3} lh={26}>
                  {x.name}
                </Tx>
                <Tx size={16} color={C.muted} lh={22}>
                  {x.bookings} réservation{x.bookings > 1 ? 's' : ''}
                </Tx>
              </Row>
            ))}
          </ListCard>
        </>
      )}
    </Screen>
  );
}
