/** Rangée de pastilles défilante (design .pills, débordant des marges de 20 px). */
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

export function PillRow({ children, gap = 7, bleed = 20 }: { children: ReactNode; gap?: number; bleed?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -bleed, flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: bleed, gap, flexDirection: 'row', alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}
