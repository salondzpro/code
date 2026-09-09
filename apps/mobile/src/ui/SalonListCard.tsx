/**
 * Carte salon de la marketplace (design C-H 01 / C-F 01) : grande version avec couverture, version compacte
 * avec vignette. Nom, « ★ 4,9 (383 avis) · quartier », prestations phares, puis « Prochaines disponibilités » :
 * les 5 premiers créneaux libres du premier jour disponible, chacun ouvre la réservation avec la date et l'heure
 * déjà choisies (il ne reste que les prestations). « Voir plus » ouvre la fiche du salon.
 */
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import type { SalonSummary } from '@salondz/types';
import {
  addDaysToKey,
  categoryLabel,
  dayChipLabelDZ,
  formatDA,
  toLocalDateKey,
} from '@salondz/constants';
import { formatKm, formatRating } from '@/lib/format';
import { C, R } from '@/theme/design';
import { Img, S, Tx } from './index';

export function RatingPill({
  avg,
  count,
  style,
}: {
  avg: number;
  count?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          alignSelf: 'flex-start',
          backgroundColor: C.fill,
          borderRadius: R.pill,
          paddingHorizontal: 10,
          paddingVertical: 5,
        },
        style,
      ]}
    >
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

/** Ligne d'avis des cartes (Planity : « ☆ 4,9 (383 avis) ») ; sans avis : « Nouveau sur Salon DZ ». */
export function RatingLine({ avg, count }: { avg: number; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Tx size={11.5} lh={15}>
        ★
      </Tx>
      {count > 0 ? (
        <>
          <Tx size={11.5} weight={700} lh={15}>
            {formatRating(avg)}
          </Tx>
          <Tx size={11.5} color={C.muted} lh={15}>
            ({count} avis)
          </Tx>
        </>
      ) : (
        <Tx size={11.5} color={C.muted} lh={15}>
          Nouveau sur Salon DZ
        </Tx>
      )}
    </View>
  );
}

export function SlotPills({
  slots,
  empty = "Complet aujourd'hui",
}: {
  slots: string[];
  empty?: string;
}) {
  if (slots.length === 0) return <S>{empty}</S>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {slots.map((t) => (
        <View
          key={t}
          style={{
            backgroundColor: C.fill,
            borderRadius: R.pill,
            paddingHorizontal: 13,
            paddingVertical: 8,
          }}
        >
          <Tx size={10.5} weight={500} lh={14} mono>
            {t}
          </Tx>
        </View>
      ))}
    </View>
  );
}

/** Libellé du jour des prochaines disponibilités : « Aujourd'hui », « Demain », sinon « Jeu. 10 ». */
export function nextDayLabel(date: string, today: string = toLocalDateKey()): string {
  if (date === today) return "Aujourd'hui";
  if (date === addDaysToKey(today, 1)) return 'Demain';
  return dayChipLabelDZ(date);
}

/**
 * « Prochaines disponibilités » directement sur la carte (Planity, en plus compact) : pour le premier jour
 * disponible, une ligne MATIN et une ligne APRÈS-MIDI avec au plus 3 heures réellement libres chacune ; une
 * période vide n'est pas affichée. Chaque heure ouvre la réservation avec la date et l'heure déjà choisies.
 */
export function NextSlots({
  salon,
  empty = 'Aucune disponibilité cette semaine',
}: {
  salon: Pick<SalonSummary, 'slug' | 'nextAvailable'>;
  empty?: string;
}) {
  const router = useRouter();
  const next = salon.nextAvailable;
  const rows = next
    ? [
        {
          key: 'matin',
          label: 'MATIN',
          slots: next.morning ?? next.slots.filter((t) => t < '12:00').slice(0, 3),
        },
        {
          key: 'aprem',
          label: 'APRÈS-MIDI',
          slots: next.afternoon ?? next.slots.filter((t) => t >= '12:00').slice(0, 3),
        },
      ].filter((r) => r.slots.length > 0)
    : [];
  if (!next || rows.length === 0) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <S>{empty}</S>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/s/${salon.slug}` as never)}
        >
          <Tx size={10.5} weight={600} color={C.muted} lh={14}>
            Voir le salon →
          </Tx>
        </Pressable>
      </View>
    );
  }
  const day = nextDayLabel(next.date);
  return (
    <View style={{ gap: 6 }} accessibilityLabel={`Prochaines disponibilités ${day}`}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Tx size={9.5} weight={700} ls={0.7} color={C.muted} lh={13}>
          PROCHAINES DISPONIBILITÉS
        </Tx>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voir plus de créneaux"
          onPress={() => router.push(`/s/${salon.slug}` as never)}
        >
          <Tx size={10.5} weight={600} color={C.muted} lh={14}>
            Voir plus →
          </Tx>
        </Pressable>
      </View>
      {rows.map((r) => (
        <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 88 }}>
            <Tx size={9.5} weight={700} ls={0.5} lh={13}>
              {r.label}
            </Tx>
            <Tx size={9.5} weight={600} color={C.muted} lh={13}>
              {day}
            </Tx>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {r.slots.map((t) => (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityLabel={`Réserver ${day} ${r.label.toLowerCase()} à ${t}`}
                onPress={() =>
                  router.push({
                    pathname: `/s/${salon.slug}/prestations`,
                    params: { date: next.date, time: t },
                  } as never)
                }
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: C.ink,
                  borderRadius: R.pill,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  backgroundColor: pressed ? C.fill : C.surface,
                })}
              >
                <Tx size={11.5} weight={600} lh={14} mono>
                  {t}
                </Tx>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function servicesLine(s: SalonSummary): string {
  return s.topServices.map((t) => `${t.name} ${formatDA(t.priceDa)}`).join(' · ');
}

export function SalonListCard({
  salon,
  large,
  to,
}: {
  salon: SalonSummary;
  large?: boolean;
  to?: string;
}) {
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
  const base: ViewStyle = {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    overflow: 'hidden',
  };

  if (large) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={s.name}
        onPress={go}
        style={({ pressed }) => [base, { opacity: pressed ? 0.92 : 1 }]}
      >
        <Img src={s.coverUrl} radius={0} style={{ height: 187, width: '100%' }} />
        <View style={{ padding: 13, gap: 3 }}>
          <Tx size={14.5} weight={700} ls={-0.4} lh={18}>
            {s.name}
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            {[cats, place, km].filter(Boolean).join(' · ')}
          </Tx>
          <RatingLine avg={s.ratingAvg} count={s.ratingCount} />
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
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={s.name}
      onPress={go}
      style={({ pressed }) => [base, { padding: 13, gap: 10, opacity: pressed ? 0.92 : 1 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
        <Img src={s.logoUrl ?? s.coverUrl} radius={13} style={{ width: 91, height: 91 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={14} weight={700} ls={-0.4} lh={17}>
            {s.name}
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5} style={{ marginTop: 3 }}>
            {[cats, place, km].filter(Boolean).join(' · ')}
          </Tx>
          <View style={{ marginTop: 3 }}>
            <RatingLine avg={s.ratingAvg} count={s.ratingCount} />
          </View>
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
