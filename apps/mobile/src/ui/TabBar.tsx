/** Barre d'onglets du design (.nvb / .nvi) : icônes 24 px, libellés 9,5 px, encre pour l'onglet actif. */
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { C } from '@/theme/design';
import { Tx } from './Text';

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(248,249,250,0.96)', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, paddingHorizontal: 10, paddingBottom: 14 + insets.bottom }}>
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key]!;
        if ((options as { href?: unknown }).href === null) return null;
        const focused = state.index === i;
        const label = typeof options.title === 'string' ? options.title : route.name;
        const color = focused ? C.ink : C.subtle;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 5 }}
          >
            {options.tabBarIcon?.({ focused, color, size: 24 })}
            <Tx size={9.5} weight={500} color={color} lh={12} numberOfLines={1}>
              {label}
            </Tx>
          </Pressable>
        );
      })}
    </View>
  );
}
