/**
 * Carte salon de la marketplace (design C-H 01 / C-F 01, présentation « à la Planity ») : grande version avec
 * couverture, version compacte avec vignette. Prestations phares, « ★ 4,9 (383 avis) », puis la grille
 * MATIN / APRÈS-MIDI / SOIR × 3 jours : une puce active ouvre la réservation au premier créneau libre du moment.
 */
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import type { PeriodDay, SalonSummary } from '@salondz/types';
import {
  categoryLabel,
  dayChipLabelDZ,
  formatDA,
  planPeriodDays,
  relativeDayLabelDZ,
} from '@salondz/constants';
import { formatKm, formatRating } from '@/lib/format';
import { C, R } from '@/theme/design';
import { Img, S, T3, Tx } from './index';

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

const PERIODS: { key: 'matin' | 'apresMidi'; label: string }[] = [
  { key: 'matin', label: 'Matin' },
  { key: 'apresMidi', label: 'Après-midi' },
];

/**
 * Grille « Matin / Après-midi » × 3 jours ouverts (Planity, simplifié) : puce active = premier créneau libre du
 * moment, puce grisée = rien de libre. Aujourd'hui plein, fermé ou terminé → statut au-dessus et la grille
 * commence au prochain jour ouvert (`planPeriodDays`). Rien sur 7 jours → prochaine disponibilité (`NextSlots`).
 */
export function PeriodGrid({
  salon,
}: {
  salon: Pick<SalonSummary, 'slug' | 'nextAvailable' | 'periods'>;
}) {
  const router = useRouter();
  const { status, days } = planPeriodDays<PeriodDay>(salon.periods ?? []);
  const any = days.some((d) => d.matin || d.apresMidi);
  const statusEl = status ? (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: C.fill,
        borderRadius: R.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
      accessibilityRole="text"
    >
      <Tx size={10} weight={600} color={C.muted} lh={13}>
        {status}
      </Tx>
    </View>
  ) : null;
  if (!any)
    return (
      <View style={{ gap: 6 }}>
        {statusEl}
        <NextSlots salon={salon} empty="Aucune disponibilité cette semaine" />
      </View>
    );
  return (
    <View style={{ gap: 6 }} accessibilityLabel="Disponibilités par moment de la journée">
      {statusEl}
      {PERIODS.map((p) => (
        <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Tx size={9.5} weight={700} ls={0.7} lh={13} style={{ width: 74 }}>
            {p.label.toUpperCase()}
          </Tx>
          {days.map((d) => {
            const t = d[p.key];
            const label = dayChipLabelDZ(d.date);
            return t ? (
              <Pressable
                key={d.date}
                accessibilityRole="button"
                accessibilityLabel={`Réserver ${label} ${p.label.toLowerCase()} à ${t}`}
                onPress={() =>
                  router.push({
                    pathname: `/s/${salon.slug}/prestations`,
                    params: { date: d.date, time: t },
                  } as never)
                }
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: C.ink,
                  borderRadius: R.pill,
                  paddingVertical: 8,
                  backgroundColor: pressed ? C.fill : C.surface,
                })}
              >
                <Tx size={10.5} weight={600} lh={14}>
                  {label}
                </Tx>
              </Pressable>
            ) : (
              <View
                key={d.date}
                accessibilityLabel={`${label} ${p.label.toLowerCase()} : complet`}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  borderRadius: R.pill,
                  paddingVertical: 8,
                  backgroundColor: C.fill,
                }}
              >
                <Tx size={10.5} color={C.subtle} lh={14}>
                  {label}
                </Tx>
              </View>
            );
          })}
        </View>
      ))}
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

/**
 * Prochaine disponibilité directement sur la carte : « Aujourd'hui » / « Demain » / « Jeu. 12 sept. » + heures.
 * Chaque heure ouvre la réservation avec la date et l'heure déjà choisies (il ne reste que les prestations à cocher).
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
            onPress={() =>
              router.push({
                pathname: `/s/${salon.slug}/prestations`,
                params: { date: next.date, time: t },
              } as never)
            }
            style={({ pressed }) => ({
              backgroundColor: pressed ? C.line : C.fill,
              borderRadius: R.pill,
              paddingHorizontal: 13,
              paddingVertical: 8,
            })}
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
            <PeriodGrid salon={s} />
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
      <PeriodGrid salon={s} />
    </Pressable>
  );
}
