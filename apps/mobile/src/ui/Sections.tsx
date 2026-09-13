/**
 * Onglets de fiche et section repliable — équivalents mobiles de `Tabs` et `Accordion`
 * du web (apps/web/src/components/ui.tsx), pour que la page salon se lise pareil des
 * deux côtés.
 */
import { Pressable, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { C } from '@/theme/design';
import { I, Tx } from './index';

/** Onglets soulignés : ils commandent toute la page, pas un simple filtre. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        backgroundColor: C.surface,
        borderBottomWidth: 1,
        borderBottomColor: C.line,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 11,
              borderBottomWidth: 2,
              borderBottomColor: on ? C.ink : 'transparent',
            }}
          >
            <Tx size={13} weight={600} ls={-0.2} lh={17} color={on ? C.text : C.muted}>
              {o.label}
            </Tx>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Section repliable. Une liste de prestations tout ouverte oblige à défiler longtemps
 * avant de trouver sa catégorie : replié, le client voit d'abord la carte du salon.
 */
export function Accordion({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={14} weight={700} ls={-0.3} lh={18}>
            {title}
          </Tx>
          {!!hint && (
            <Tx size={11.5} color={C.muted} lh={15}>
              {hint}
            </Tx>
          )}
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <I icon={ChevronDown} size={18} color={C.muted} />
        </View>
      </Pressable>
      {open && (
        <View style={{ borderTopWidth: 1, borderTopColor: C.lineSoft, paddingHorizontal: 14 }}>
          {children}
        </View>
      )}
    </View>
  );
}
