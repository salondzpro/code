/**
 * Carte salon de la marketplace (design C-H 01 / C-F 01) : grande version avec couverture,
 * version compacte avec vignette. Prestations phares, note, prochains créneaux du jour.
 */
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import type { SalonSummary } from '@salondz/types';
import { categoryLabel, formatDA, relativeDayLabelDZ } from '@salondz/constants';
import { formatKm, formatRating } from '@/lib/format';
import { C, R } from '@/theme/design';
import { Img, S, T3, Tx } from './index';

export function RatingPill({ avg, count, style }: { avg: number; count?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: C.fill, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 }, style]}>
      <Tx size={12} weight={600} lh={15.5}>
        ★ {formatRating(avg)}
      </Tx>
      {count != null && (
        <Tx size={12} color={C.muted} lh={15.5}>
          ({count})
        </Tx>
      )}
    </View>
  );
}

export function SlotPills({ slots, empty = "Complet aujourd'hui" }: { slots: string[]; empty?: string }) {
  if (slots.length === 0) return <S>{empty}</S>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {slots.map((t) => (
        <View key={t} style={{ backgroundColor: C.fill, borderRadius: R.pill, paddingHorizontal: 13, paddingVertical: 8 }}>
          <Tx size={10.5} weight={500} lh={14} mono>
            {t}
          </Tx>
        </View>
      ))}
    </View>
  );
}

/**
 * Prochaine disponibilité directement sur la carte : « Aujourd'hui » / « Demain » / « Jeu. 12 sept. » + heures.
 * Chaque heure ouvre la réservation avec la date et l'heure déjà choisies (il ne reste que les prestations à cocher).
 */
export function NextSlots({ salon, empty = 'Aucune disponibilité cette semaine' }: { salon: Pick<SalonSummary, 'slug' | 'nextAvailable'>; empty?: string }) {
  const router = useRouter();
  const next = salon.nextAvailable;
  if (!next || next.slots.length === 0) return <S>{empty}</S>;
  const label = relativeDayLabelDZ(next.date);
  return (
    <View style={{ gap: 6 }} accessibilityLabel={`Prochaines disponibilités ${label}`}>
      <T3 weight={500}>{label}</T3>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {next.slots.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityLabel={`Réserver ${label} à ${t}`}
            onPress={() => router.push({ pathname: `/s/${salon.slug}/prestations`, params: { date: next.date, time: t } } as never)}
            style={({ pressed }) => ({ backgroundColor: pressed ? C.line : C.fill, borderRadius: R.pill, paddingHorizontal: 13, paddingVertical: 8 })}
          >
            <Tx size={10.5} weight={500} lh={14} mono>
              {t}
            </Tx>
          </Pressable>
        ))}
      </View>
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
        <Img src={s.coverUrl} radius={0} style={{ height: 187, width: '100%' }} />
        <View style={{ padding: 13, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <Tx size={14.5} weight={700} ls={-0.4} lh={18} style={{ flex: 1 }}>
              {s.name}
            </Tx>
            {s.ratingCount > 0 && <RatingPill avg={s.ratingAvg} />}
          </View>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            {[cats, place, km].filter(Boolean).join(' · ')}
          </Tx>
          {s.topServices.length > 0 && (
            <Tx size={12} color={C.subtle} lh={17}>
              {servicesLine(s)}
            </Tx>
          )}
          <View style={{ marginTop: 8 }}>
            <NextSlots salon={s} />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable accessibilityRole="link" accessibilityLabel={s.name} onPress={go} style={({ pressed }) => [base, { padding: 13, gap: 10, opacity: pressed ? 0.92 : 1 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
        <Img src={s.logoUrl ?? s.coverUrl} radius={13} style={{ width: 91, height: 91 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
            <Tx size={14} weight={700} ls={-0.4} lh={17} style={{ flex: 1 }}>
              {s.name}
            </Tx>
            {s.ratingCount > 0 && <RatingPill avg={s.ratingAvg} />}
          </View>
          <Tx size={10.5} color={C.muted} lh={15.5} style={{ marginTop: 3 }}>
            {[cats, place, km].filter(Boolean).join(' · ')}
          </Tx>
          {s.topServices.length > 0 && (
            <Tx size={12} color={C.subtle} lh={17} style={{ marginTop: 2 }}>
              {servicesLine(s)}
            </Tx>
          )}
        </View>
      </View>
      <NextSlots salon={s} />
    </Pressable>
  );
}
