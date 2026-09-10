/**
 * Agenda mobile-first : le contenu du jour glisse librement avec le doigt (carrousel paginé à trois panneaux :
 * veille, jour, lendemain) et une bande de jours défilable horizontalement, jour choisi centré.
 */
import React, { useEffect, useRef, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  DAY_LABELS_SHORT_FR,
  addDaysToKey,
  dayOfWeekFromKey,
  toLocalDateKey,
} from '@salondz/constants';
import { dayNumber, monthLabel } from '@/lib/format';
import { C } from '@/theme/design';
import { Tx } from './Text';

const CELL = 46;
const GAP = 4;

export function DayScroller({
  selected,
  onSelect,
  disabledDays,
  minDate,
}: {
  selected: string;
  onSelect: (dateKey: string) => void;
  disabledDays?: readonly number[];
  /** Jours avant cette clé grisés et non sélectionnables (création : jamais le passé). */ minDate?:
    string | null;
}) {
  const today = toLocalDateKey();
  const ref = useRef<ScrollView>(null);
  const anchor = useRef(selected);
  if (selected < addDaysToKey(anchor.current, -14) || selected > addDaysToKey(anchor.current, 35))
    anchor.current = selected;
  const days: string[] = [];
  // Avec `minDate` (création de rendez-vous), le passé n'est pas seulement grisé : il n'est pas listé du tout.
  for (let i = -21; i <= 42; i++) {
    const d = addDaysToKey(anchor.current, i);
    if (minDate && d < minDate) continue;
    days.push(d);
  }
  const width = useRef(0);

  useEffect(() => {
    const idx = days.indexOf(selected);
    if (idx < 0 || !width.current) return;
    ref.current?.scrollTo({
      x: Math.max(0, idx * (CELL + GAP) - width.current / 2 + CELL / 2),
      animated: true,
    });
  }, [selected, days]);

  let lastMonth = '';
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CELL + GAP}
      decelerationRate="fast"
      onLayout={(e) => {
        width.current = e.nativeEvent.layout.width;
        const idx = days.indexOf(selected);
        if (idx >= 0)
          ref.current?.scrollTo({
            x: Math.max(0, idx * (CELL + GAP) - width.current / 2 + CELL / 2),
            animated: false,
          });
      }}
      contentContainerStyle={{ gap: GAP, paddingHorizontal: 16 }}
      style={{ marginHorizontal: -16 }}
      accessibilityRole="radiogroup"
      accessibilityLabel="Choisir un jour"
    >
      {days.map((d) => {
        const dow = dayOfWeekFromKey(d);
        const past = !!minDate && d < minDate;
        const out = !!disabledDays?.includes(dow) || past;
        const on = d === selected;
        const month = d.slice(0, 7);
        const showMonth = month !== lastMonth;
        lastMonth = month;
        return (
          <Pressable
            key={d}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: past }}
            disabled={past}
            accessibilityLabel={`${DAY_LABELS_SHORT_FR[dow]} ${dayNumber(d)}`}
            onPress={() => onSelect(d)}
            style={{
              width: CELL,
              alignItems: 'center',
              gap: 3,
              paddingVertical: 7,
              borderRadius: 12,
              backgroundColor: on ? C.ink : 'transparent',
            }}
          >
            <Tx size={8.5} lh={11} upper color={on ? 'rgba(255,255,255,0.7)' : C.subtle}>
              {showMonth ? monthLabel(d).split(' ')[0]!.slice(0, 4) : DAY_LABELS_SHORT_FR[dow]}
            </Tx>
            <Tx
              size={13}
              weight={600}
              lh={16}
              color={on ? '#fff' : out ? C.disabled : C.text}
              style={d === today && !on ? { textDecorationLine: 'underline' } : undefined}
            >
              {dayNumber(d)}
            </Tx>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Trois panneaux paginés : on glisse, la page retombe, le jour change et le carrousel se recale au centre. */
export function DayCarousel({
  date,
  onChange,
  render,
  width,
  prev,
  next,
}: {
  date: string;
  onChange: (dateKey: string) => void;
  render: (dateKey: string) => ReactNode;
  width: number;
  /** Clés des périodes voisines (défaut : veille / lendemain) — semaine ± 7 jours, mois ± 1 mois. */ prev?: string;
  next?: string;
}) {
  const ref = useRef<ScrollView>(null);
  const days = [prev ?? addDaysToKey(date, -1), date, next ?? addDaysToKey(date, 1)];

  useEffect(() => {
    ref.current?.scrollTo({ x: width, animated: false });
  }, [date, width]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index === 1) return;
    onChange(days[index]!);
  };

  return (
    <ScrollView
      ref={ref}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      contentOffset={{ x: width, y: 0 }}
      onMomentumScrollEnd={settle}
      onScrollEndDrag={(e) => {
        // Sur le web (Expo web) il n'y a pas toujours de momentum : on tranche à la fin du geste.
        if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) settle(e);
      }}
      style={{ width }}
      accessibilityLabel="Glisser pour changer de jour"
    >
      {days.map((d) => (
        <View key={d} style={{ width }}>
          {render(d)}
        </View>
      ))}
    </ScrollView>
  );
}
