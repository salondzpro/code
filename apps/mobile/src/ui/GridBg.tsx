/** Quadrillage gris clair (fond de carte schématique du design). */
import { View } from 'react-native';
import { C } from '@/theme/design';

export function GridBg({ step = 90, stepY }: { step?: number; stepY?: number }) {
  const sy = stepY ?? Math.round(step * 0.78);
  const cols = Math.ceil(430 / step);
  const rows = Math.ceil(900 / sy);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.6 }} pointerEvents="none">
      {Array.from({ length: cols }, (_, i) => (
        <View key={`c${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: i * step, width: 2, backgroundColor: C.line }} />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View key={`r${i}`} style={{ position: 'absolute', left: 0, right: 0, top: i * sy, height: 2, backgroundColor: C.line }} />
      ))}
    </View>
  );
}
