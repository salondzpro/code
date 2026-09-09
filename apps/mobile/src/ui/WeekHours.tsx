/** Éditeur d'une semaine d'horaires avec pause facultative par jour (salon et membre) — même logique que le web. */
import React from 'react';
import { View } from 'react-native';
import { DAY_LABELS_FR, formatDayRanges, rangesFromRows, rowError, type DayHoursRow, type DayOfWeek } from '@salondz/constants';
import { Card, Grid, Toggle, Tx } from './index';
import { TimeField } from './Pickers';
import { C, R } from '@/theme/design';

/** Case horaire : petit libellé + heure en grand ; toute la case ouvre le sélecteur. */
function TimeBox({ label, value, onChange, ariaLabel }: { label: string; value: string; onChange: (v: string) => void; ariaLabel: string }) {
  return (
    <View style={{ backgroundColor: C.fill, borderRadius: R.input, paddingHorizontal: 12, paddingVertical: 8, gap: 1 }}>
      <Tx size={10} color={C.muted} lh={13}>
        {label}
      </Tx>
      <TimeField size={17} color={C.text} value={value} onChange={onChange} label={ariaLabel} step={15} />
    </View>
  );
}

export function WeekHoursEditor({ rows, onChange, closedLabel = 'Fermé', breakLabel = 'Pause' }: { rows: DayHoursRow[]; onChange: (rows: DayHoursRow[]) => void; closedLabel?: string; breakLabel?: string }) {
  const patch = (d: DayOfWeek, p: Partial<DayHoursRow>) => onChange(rows.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => {
        const day = DAY_LABELS_FR[r.dayOfWeek];
        const err = rowError(r);
        return (
          <Card key={r.dayOfWeek} gap={10} style={r.open ? undefined : { backgroundColor: C.fill }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Tx size={13} weight={600} lh={17} color={r.open ? C.text : C.subtle}>
                {day}
              </Tx>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Tx size={10.5} color={C.muted} lh={14}>
                  {r.open ? formatDayRanges(rangesFromRows([r])) : closedLabel}
                </Tx>
                <Toggle on={r.open} onChange={(v) => patch(r.dayOfWeek, { open: v })} label={day} />
              </View>
            </View>
            {r.open && (
              <>
                <Grid cols={2} gap={8}>
                  <TimeBox label="Ouvre" value={r.opensAt} onChange={(v) => patch(r.dayOfWeek, { opensAt: v })} ariaLabel={`Ouverture ${day}`} />
                  <TimeBox label="Ferme" value={r.closesAt} onChange={(v) => patch(r.dayOfWeek, { closesAt: v })} ariaLabel={`Fermeture ${day}`} />
                </Grid>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <Tx size={12} lh={16}>
                    {breakLabel}
                  </Tx>
                  <Toggle on={r.hasBreak} onChange={(v) => patch(r.dayOfWeek, { hasBreak: v })} label={`${breakLabel} ${day}`} />
                </View>
                {r.hasBreak && (
                  <Grid cols={2} gap={8}>
                    <TimeBox label="Début de pause" value={r.breakFrom} onChange={(v) => patch(r.dayOfWeek, { breakFrom: v })} ariaLabel={`Début de pause ${day}`} />
                    <TimeBox label="Fin de pause" value={r.breakTo} onChange={(v) => patch(r.dayOfWeek, { breakTo: v })} ariaLabel={`Fin de pause ${day}`} />
                  </Grid>
                )}
              </>
            )}
            {err && (
              <Tx size={10.5} color={C.danger} lh={14}>
                {err}
              </Tx>
            )}
          </Card>
        );
      })}
    </View>
  );
}
