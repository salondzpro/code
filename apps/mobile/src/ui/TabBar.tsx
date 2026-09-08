/**
 * Barre d'onglets flottante « verre » (style Instagram iOS) : pilule détachée du bord, flou du contenu
 * derrière (expo-blur), liseré clair, ombre douce. Icônes seules ; l'onglet actif est sur une pastille encre.
 * Même rendu que `.nvb` / `.nvi` du web. Les écrans à onglets réservent NAV_PAD en bas (elle recouvre le contenu).
 */
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { C, R } from '@/theme/design';

const BAR_HEIGHT = 52;
const ITEM_HEIGHT = 42;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: 11 + insets.bottom }]}>
      <View style={styles.pill}>
        {/* Sur Android le flou natif est expérimental : on garde un fond translucide plus opaque. */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 90}
          tint="light"
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityRole="tablist" style={styles.row}>
          {state.routes.map((route, i) => {
            const { options } = descriptors[route.key]!;
            if ((options as { href?: unknown }).href === null) return null;
            const focused = state.index === i;
            const label = typeof options.title === 'string' ? options.title : route.name;
            const color = focused ? C.onInk : C.subtle;
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
                style={({ pressed }) => [styles.item, focused && styles.itemOn, pressed && { transform: [{ scale: 0.94 }] }]}
              >
                {options.tabBarIcon?.({ focused, color, size: 24 })}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 13, right: 13, alignItems: 'center' },
  pill: {
    width: '100%',
    maxWidth: 430 - 32,
    height: BAR_HEIGHT,
    borderRadius: R.pill,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.66)' : 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 5, gap: 2 },
  item: { flex: 1, minWidth: 0, height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center', borderRadius: R.pill },
  itemOn: {
    backgroundColor: C.ink,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
});
