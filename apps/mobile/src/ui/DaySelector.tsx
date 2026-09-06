/**
 * Bande de 7 jours (dimanche → samedi) et navigation de mois, reprises du design
 * (.dsel / .dcel + en-tête « AOÛT 2026 ‹ › »).
 */
import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { DAY_LABELS_SHORT_FR, addDaysToKey, dayOfWeekFromKey, weekKeys } from '@salondz/constants';
import { dayNumber, monthLabel } from '@/lib/format';
import { C, R } from '@/theme/design';
import { I, IconButton, Tx } from './index';

/** Cellule de jour (design .dcel) : libellé court + numéro, encre quand sélectionnée, grisée si indisponible. */
export function DayCell({ dateKey, on, out, onPress }: { dateKey: string; on?: boolean; out?: boolean; onPress?: () => void }) {
  const dow = dayOfWeekFromKey(dateKey);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on, disabled: !!out }} accessibilityLabel={`${DAY_LABELS_SHORT_FR[dow]} ${dayNumber(dateKey)}`} disabled={out} onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 9, borderRadius: R.slot, backgroundColor: on ? C.ink : 'transparent' }}>
      <Tx size={11} lh={14} color={on ? 'rgba(255,255,255,0.65)' : out ? C.disabled : C.subtle}>
        {DAY_LABELS_SHORT_FR[dow]}
      </Tx>
      <Tx size={17} weight={600} ls={-0.3} lh={21} color={on ? '#fff' : out ? C.disabled : C.text}>
        {dayNumber(dateKey)}
      </Tx>
    </Pressable>
  );
}

/** « Dim 23 · Lun 24 … » — jours hors plage ou fermés en gris clair. */
export function DayStrip({ weekOf, selected, onSelect, minDate, maxDate, disabledDays }: { weekOf: string; selected: string; onSelect: (dateKey: string) => void; minDate?: string | null; maxDate?: string | null; disabledDays?: readonly number[] }) {
  const days = weekKeys(weekOf);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Choisir un jour" style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
      {days.map((d) => {
        const dow = dayOfWeekFromKey(d);
        const out = (!!minDate && d < minDate) || (!!maxDate && d > maxDate) || !!disabledDays?.includes(dow);
        return <DayCell key={d} dateKey={d} on={d === selected} out={out} onPress={() => onSelect(d)} />;
      })}
    </View>
  );
}

/** En-tête « AOÛT 2026 » + boutons ronds ‹ › (semaine précédente / suivante). */
export function MonthNav({ weekOf, onWeekChange, minDate, maxDate }: { weekOf: string; onWeekChange: (weekOf: string) => void; minDate?: string | null; maxDate?: string | null }) {
  const days = weekKeys(weekOf);
  const first = days[0]!;
  const last = days[6]!;
  const canPrev = !minDate || first > minDate;
  const canNext = !maxDate || last < maxDate;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Tx size={12} weight={600} color={C.subtle} ls={0.96} lh={16} upper>
        {monthLabel(weekOf)}
      </Tx>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <IconButton accessibilityLabel="Semaine précédente" disabled={!canPrev} style={{ opacity: canPrev ? 1 : 0.35 }} onPress={() => onWeekChange(addDaysToKey(first, -7))}>
          <I icon={ChevronLeft} size={18} />
        </IconButton>
        <IconButton accessibilityLabel="Semaine suivante" disabled={!canNext} style={{ opacity: canNext ? 1 : 0.35 }} onPress={() => onWeekChange(addDaysToKey(first, 7))}>
          <I icon={ChevronRight} size={18} />
        </IconButton>
      </View>
    </View>
  );
}
