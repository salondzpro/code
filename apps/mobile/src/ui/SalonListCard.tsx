/**
 * Carte salon de la marketplace (design C-H 01 / C-F 01) : grande version avec couverture,
 * version compacte avec vignette. Prestations phares, note, prochains créneaux du jour.
 */
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import type { SalonSummary } from '@salondz/types';
import { categoryLabel, formatDA } from '@salondz/constants';
import { formatKm, formatRating } from '@/lib/format';
import { C, R } from '@/theme/design';
import { Img, S, Tx } from './index';

export function RatingPill({ avg, count, style }: { avg: number; count?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: C.fill, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6 }, style]}>
      <Tx size={15} weight={600} lh={19}>
        ★ {formatRating(avg)}
      </Tx>
      {count != null && (
        <Tx size={15} color={C.muted} lh={19}>
          ({count})
        </Tx>
      )}
    </View>
  );
}

export function SlotPills({ slots, empty = "Complet aujourd'hui" }: { slots: string[]; empty?: string }) {
  if (slots.length === 0) return <S>{empty}</S>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {slots.map((t) => (
        <View key={t} style={{ backgroundColor: C.fill, borderRadius: R.pill, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Tx size={16} weight={500} lh={20} mono>
            {t}
          </Tx>
        </View>
      ))}
    </View>
  );
}

function servicesLine(s: SalonSummary): string {
  return s.topServices.map((t) => `${t.name} ${formatDA(t.priceDa)}`).join(' · ');
}

export function SalonListCard({ salon, large, to }: { salon: SalonSummary; large?: boolean; to?: string }) {
  const router = useRouter();
  const s = salon;
  const km = formatKm(s.distanceKm);
  const place = s.zone ?? s.city;
  const cats = s.categoryIds
    .slice(0, 2)
    .map((c) => categoryLabel(c))
    .join(' · ');
  const href = to ?? `/s/${s.slug}`;
  const go = () => router.push(href as never);
  const base: ViewStyle = { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' };

  if (large) {
    return (
      <Pressable accessibilityRole="link" accessibilityLabel={s.name} onPress={go} style={({ pressed }) => [base, { opacity: pressed ? 0.92 : 1 }]}>
        <Img src={s.coverUrl} radius={0} style={{ height: 230, width: '100%' }} />
        <View style={{ padding: 16, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <Tx size={22} weight={700} ls={-0.4} lh={26} style={{ flex: 1 }}>
              {s.name}
            </Tx>
            {s.ratingCount > 0 && <RatingPill avg={s.ratingAvg} />}
          </View>
          <Tx size={16} color={C.muted} lh={22}>
            {[cats, place, km].filter(Boolean).join(' · ')}
          </Tx>
          {s.topServices.length > 0 && (
            <Tx size={15} color={C.subtle} lh={21}>
              {servicesLine(s)}
            </Tx>
          )}
          <View style={{ marginTop: 10 }}>
            <SlotPills slots={s.nextSlots} />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable accessibilityRole="link" accessibilityLabel={s.name} onPress={go} style={({ pressed }) => [base, { padding: 16, gap: 12, opacity: pressed ? 0.92 : 1 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
        <Img src={s.logoUrl ?? s.coverUrl} radius={16} style={{ width: 112, height: 112 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <Tx size={21} weight={700} ls={-0.4} lh={25} style={{ flex: 1 }}>
              {s.name}
            </Tx>
            {s.ratingCount > 0 && <RatingPill avg={s.ratingAvg} />}
          </View>
          <Tx size={16} color={C.muted} lh={22} style={{ marginTop: 4 }}>
            {[cats, place, km].filter(Boolean).join(' · ')}
          </Tx>
          {s.topServices.length > 0 && (
            <Tx size={15} color={C.subtle} lh={21} style={{ marginTop: 2 }}>
              {servicesLine(s)}
            </Tx>
          )}
        </View>
      </View>
      <SlotPills slots={s.nextSlots} />
    </Pressable>
  );
}
