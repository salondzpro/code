/** Éditeur d'une semaine d'horaires avec pause facultative par jour (salon et membre) — même logique que le web. */
import React from 'react';
import { View } from 'react-native';
import { DAY_LABELS_FR, formatDayRanges, rangesFromRows, rowError, type DayHoursRow, type DayOfWeek } from '@salondz/constants';
import { ListCard, Toggle, Tx } from './index';
import { TimeField } from './Pickers';
import { C } from '@/theme/design';

export function WeekHoursEditor({ rows, onChange, closedLabel = 'Fermé', breakLabel = 'Pause' }: { rows: DayHoursRow[]; onChange: (rows: DayHoursRow[]) => void; closedLabel?: string; breakLabel?: string }) {
  const patch = (d: DayOfWeek, p: Partial<DayHoursRow>) => onChange(rows.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  return (
    <ListCard>
      {rows.map((r, i) => {
        const day = DAY_LABELS_FR[r.dayOfWeek];
        const err = rowError(r);
        return (
          <View key={r.dayOfWeek} style={{ paddingVertical: 10, gap: 6, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: C.lineSoft }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Tx size={12} lh={16} weight={r.open ? 600 : 400} color={r.open ? C.text : C.subtle} style={{ width: 70 }}>
                {day}
              </Tx>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                {r.open ? (
                  <>
                    <TimeField size={14} value={r.opensAt} onChange={(v) => patch(r.dayOfWeek, { opensAt: v })} label={`Ouverture ${day}`} step={15} />
                    <Tx size={12} color={C.muted} lh={16}>
                      {' '}
                      –{' '}
                    </Tx>
                    <TimeField size={14} value={r.closesAt} onChange={(v) => patch(r.dayOfWeek, { closesAt: v })} label={`Fermeture ${day}`} step={15} />
                  </>
                ) : (
                  <Tx size={12} color={C.disabled} lh={16}>
                    {closedLabel}
                  </Tx>
                )}
              </View>
              <Toggle on={r.open} onChange={(v) => patch(r.dayOfWeek, { open: v })} label={day} />
            </View>
            {r.open && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 78 }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Tx size={11} color={C.muted} lh={15} style={{ marginRight: 4 }}>
                    {breakLabel}
                  </Tx>
                  {r.hasBreak ? (
                    <>
                      <TimeField size={13} value={r.breakFrom} onChange={(v) => patch(r.dayOfWeek, { breakFrom: v })} label={`Début de pause ${day}`} step={15} />
                      <Tx size={11} color={C.muted} lh={15}>
                        {' '}
                        –{' '}
                      </Tx>
                      <TimeField size={13} value={r.breakTo} onChange={(v) => patch(r.dayOfWeek, { breakTo: v })} label={`Fin de pause ${day}`} step={15} />
                    </>
                  ) : (
                    <Tx size={11} color={C.disabled} lh={15}>
                      aucune
                    </Tx>
                  )}
                </View>
                <Toggle on={r.hasBreak} onChange={(v) => patch(r.dayOfWeek, { hasBreak: v })} label={`${breakLabel} ${day}`} />
              </View>
            )}
            {r.open && (
              <Tx size={10} color={C.subtle} lh={13} style={{ paddingLeft: 78 }}>
                {formatDayRanges(rangesFromRows([r]))}
              </Tx>
            )}
            {err && (
              <Tx size={10.5} color={C.danger} lh={14} style={{ paddingLeft: 78 }}>
                {err}
              </Tx>
            )}
          </View>
        );
      })}
    </ListCard>
  );
}
