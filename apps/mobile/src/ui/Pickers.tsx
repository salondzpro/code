/**
 * Sélecteurs au design (feuilles basses) remplaçant les <select> / <input type=time|date> du web :
 * choix dans une liste, heure (grille de créneaux), date (bande de jours).
 */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Check, ChevronDown, Plus } from 'lucide-react-native';
import { addDaysToKey, minutesToTime, timeToMinutes, weekKeys } from '@salondz/constants';
import { C } from '@/theme/design';
import { Button, Grid, I, ListCard, ModalSheet, P, Row, SectionLabel, Slot, Tx } from './index';
import { DayStrip, MonthNav } from './DaySelector';

/** Ligne « libellé … valeur ⌄ » (design .li avec select). */
export function ValueRow({ label, hint, value, onPress, py = 16, muted = true }: { label: string; hint?: string; value: ReactNode; onPress?: () => void; py?: number; muted?: boolean }) {
  return (
    <Row py={py} onPress={onPress} chevron={false} accessibilityLabel={label} right={
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '55%' }}>
        {typeof value === 'string' ? (
          <Tx size={12} lh={16} color={muted ? C.muted : C.text} numberOfLines={1} right>
            {value}
          </Tx>
        ) : (
          value
        )}
        {onPress && <I icon={ChevronDown} size={13} color={C.subtle} />}
      </View>
    }>
      <Tx size={12} lh={16}>
        {label}
      </Tx>
      {hint && (
        <Tx size={10.5} color={C.muted} lh={15.5}>
          {hint}
        </Tx>
      )}
    </Row>
  );
}

export function PickerSheet<T extends string | number>({ open, onClose, title, options, value, onChange, action }: { open: boolean; onClose: () => void; title: string; options: { value: T; label: string; hint?: string; group?: string }[]; value: T | null | undefined; onChange: (v: T) => void; /** Bouton distinct sous la liste (ex. « Créer une catégorie »). */ action?: { label: string; onPress: () => void } }) {
  let lastGroup: string | undefined;
  return (
    <ModalSheet open={open} onClose={onClose} scroll>
      <Tx size={14.5} weight={600} ls={-0.3} lh={18.5} center>
        {title}
      </Tx>
      <ListCard>
        {options.map((o, i) => {
          const header = o.group !== lastGroup ? o.group : undefined;
          lastGroup = o.group;
          return (
            <View key={String(o.value)}>
              {header && (
                <View style={{ paddingTop: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.lineSoft }}>
                  <SectionLabel>{header}</SectionLabel>
                </View>
              )}
              <View style={{ borderBottomWidth: i < options.length - 1 ? 1 : 0, borderBottomColor: C.lineSoft }}>
                <Row
                  chevron={false}
                  accessibilityLabel={o.label}
                  right={o.value === value ? <I icon={Check} size={16} /> : undefined}
                  onPress={() => {
                    onChange(o.value);
                    onClose();
                  }}
                >
                  <Tx size={12} lh={16} weight={o.value === value ? 600 : 400}>
                    {o.label}
                  </Tx>
                  {o.hint && <P>{o.hint}</P>}
                </Row>
              </View>
            </View>
          );
        })}
      </ListCard>
      {action && (
        <Button
          variant="g"
          onPress={() => {
            action.onPress();
            onClose();
          }}
        >
          <I icon={Plus} size={14} />
          <Tx size={12} weight={600} lh={16}>
            {action.label}
          </Tx>
        </Button>
      )}
    </ModalSheet>
  );
}

/** Heure : grille de créneaux (pas `step`) entre `from` et `to`. */
export function TimeSheet({ open, onClose, title = 'Heure', value, onChange, from = '06:00', to = '23:00', step = 15 }: { open: boolean; onClose: () => void; title?: string; value: string; onChange: (hm: string) => void; from?: string; to?: string; step?: number }) {
  const times: string[] = [];
  for (let m = timeToMinutes(from); m <= timeToMinutes(to); m += step) times.push(minutesToTime(m));
  return (
    <ModalSheet open={open} onClose={onClose} scroll>
      <Tx size={14.5} weight={600} ls={-0.3} lh={18.5} center>
        {title}
      </Tx>
      <Grid cols={4} gap={6}>
        {times.map((t) => (
          <Slot
            key={t}
            on={t === value}
            onPress={() => {
              onChange(t);
              onClose();
            }}
          >
            {t}
          </Slot>
        ))}
      </Grid>
    </ModalSheet>
  );
}

/** Date : navigation de semaine + bande de jours, validation par bouton. */
export function DateSheet({ open, onClose, title = 'Date', value, onChange, minDate, maxDate, disabledDays }: { open: boolean; onClose: () => void; title?: string; value: string; onChange: (key: string) => void; minDate?: string | null; maxDate?: string | null; disabledDays?: readonly number[] }) {
  const [weekOf, setWeekOf] = useState(value);
  const [sel, setSel] = useState(value);
  return (
    <ModalSheet open={open} onClose={onClose}>
      <Tx size={14.5} weight={600} ls={-0.3} lh={18.5} center>
        {title}
      </Tx>
      <MonthNav weekOf={weekOf} onWeekChange={setWeekOf} minDate={minDate ? addDaysToKey(weekKeys(minDate)[0]!, 0) : undefined} maxDate={maxDate} />
      <DayStrip weekOf={weekOf} selected={sel} onSelect={setSel} minDate={minDate} maxDate={maxDate} disabledDays={disabledDays} />
      <Button
        onPress={() => {
          onChange(sel);
          onClose();
        }}
      >
        Choisir ce jour
      </Button>
    </ModalSheet>
  );
}

/** Pressable inline « 09:00 » (design .tm) ouvrant une TimeSheet. */
export function TimeField({ value, onChange, label, color = C.muted, size = 19, from, to, step }: { value: string; onChange: (hm: string) => void; label: string; color?: string; size?: number; from?: string; to?: string; step?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} hitSlop={6}>
        <Tx size={size} lh={Math.round(size * 1.3)} color={color} mono>
          {value}
        </Tx>
      </Pressable>
      <TimeSheet open={open} onClose={() => setOpen(false)} title={label} value={value} onChange={onChange} from={from} to={to} step={step} />
    </>
  );
}
