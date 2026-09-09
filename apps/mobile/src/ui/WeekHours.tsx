/** Éditeur d'une semaine d'horaires avec une ou plusieurs pauses par jour (salon et membre) — même logique que le web. */
import React from 'react';
import { Pressable, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { DAY_LABELS_FR, MAX_BREAKS_PER_DAY, formatDayRanges, nextBreakSuggestion, rangesFromRows, rowError, type DayBreak, type DayHoursRow, type DayOfWeek } from '@salondz/constants';
import { Card, Grid, I, IconButton, Toggle, Tx } from './index';
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

export function WeekHoursEditor({ rows, onChange, closedLabel = 'Fermé' }: { rows: DayHoursRow[]; onChange: (rows: DayHoursRow[]) => void; closedLabel?: string }) {
  const patch = (d: DayOfWeek, p: Partial<DayHoursRow>) => onChange(rows.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  const patchBreak = (r: DayHoursRow, idx: number, b: Partial<DayBreak>) => patch(r.dayOfWeek, { breaks: r.breaks.map((x, k) => (k === idx ? { ...x, ...b } : x)) });
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
                {r.breaks.map((b, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Grid cols={2} gap={8}>
                        <TimeBox label={r.breaks.length > 1 ? `Pause ${idx + 1} · début` : 'Début de pause'} value={b.from} onChange={(v) => patchBreak(r, idx, { from: v })} ariaLabel={`Début de pause ${idx + 1} ${day}`} />
                        <TimeBox label={r.breaks.length > 1 ? `Pause ${idx + 1} · fin` : 'Fin de pause'} value={b.to} onChange={(v) => patchBreak(r, idx, { to: v })} ariaLabel={`Fin de pause ${idx + 1} ${day}`} />
                      </Grid>
                    </View>
                    <IconButton accessibilityLabel={`Supprimer la pause ${idx + 1} ${day}`} onPress={() => patch(r.dayOfWeek, { breaks: r.breaks.filter((_, k) => k !== idx) })}>
                      <I icon={X} size={13} />
                    </IconButton>
                  </View>
                ))}
                {r.breaks.length < MAX_BREAKS_PER_DAY && (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter une pause ${day}`} onPress={() => patch(r.dayOfWeek, { breaks: [...r.breaks, nextBreakSuggestion(r)] })} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 2 }}>
                    <I icon={Plus} size={13} />
                    <Tx size={12} weight={600} lh={16}>
                      {r.breaks.length ? 'Ajouter une autre pause' : 'Ajouter une pause'}
                    </Tx>
                  </Pressable>
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
