import React from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFavorites, useSalon, useSalonReviews, useToggleFavorite } from '@salondz/api-client';
import type { SalonPublic } from '@salondz/types';
import { categoryLabel, DAY_LABELS_FR, formatDA, formatDZPhone, GENDER_TARGET_LABELS_FR, WEEK_DAYS, wilayaName } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { Button, ErrorText, Loading, Screen, Section } from '@/components';
import { colors, font, radius, spacing } from '@/theme/tokens';

export default function SalonPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const salon = useSalon(slug ?? '');
  const favorites = useFavorites(!!session);
  const toggleFavorite = useToggleFavorite();

  if (salon.isLoading) return <Loading />;
  if (salon.isError || !salon.data) {
    return (
      <Screen>
        <ErrorText error={salon.error ?? new Error('Salon introuvable')} onRetry={() => void salon.refetch()} />
      </Screen>
    );
  }
  const s = salon.data;
  const isFav = favorites.data?.items.some((f) => f.id === s.id) ?? false;
  const shareUrl = `${env.webUrl}/s/${s.slug}`;

  const reserve = (serviceId?: string) =>
    router.push({ pathname: '/(client)/salon/[slug]/reserver', params: { slug: s.slug, ...(serviceId ? { serviceId } : {}) } } as never);

  return (
    <>
      <Stack.Screen
        options={{
          title: s.name,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Pressable hitSlop={8} onPress={() => void Share.share({ message: `${s.name} sur SalonDZ : ${shareUrl}`, url: shareUrl })}>
                <Ionicons name="share-outline" size={22} color={colors.text} />
              </Pressable>
              {session ? (
                <Pressable hitSlop={8} onPress={() => toggleFavorite.mutate({ salonId: s.id, on: !isFav })}>
                  <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? colors.danger : colors.text} />
                </Pressable>
              ) : null}
            </View>
          ),
        }}
      />
      <Screen scroll padded={false} edges={['left', 'right']}>
        <View style={styles.cover}>
          {s.coverUrl ? <Image source={{ uri: s.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : <Ionicons name="cut-outline" size={48} color={colors.primary} />}
        </View>
        <View style={styles.body}>
          <Text style={styles.name}>{s.name}</Text>
          <Text style={styles.meta}>
            {s.categoryIds.map((c) => categoryLabel(c)).join(' · ')} · {GENDER_TARGET_LABELS_FR[s.genderTarget]}
          </Text>
          <Text style={styles.meta}>
            {s.address ? `${s.address}, ` : ''}
            {s.city} · {wilayaName(s.wilayaCode)}
          </Text>
          {s.ratingCount > 0 ? (
            <Text style={styles.rating}>
              ★ {s.ratingAvg.toFixed(1)} · {s.ratingCount} avis
            </Text>
          ) : null}
          {s.description ? <Text style={styles.description}>{s.description}</Text> : null}
          <View style={styles.actions}>
            <Button title="Réserver" onPress={() => reserve()} style={{ flex: 1 }} />
            {s.phone ? <Button title="Appeler" variant="secondary" onPress={() => void Linking.openURL(`tel:${s.phone}`)} /> : null}
          </View>

          <Section title="Services">
            {s.services.map((sv) => (
              <Pressable key={sv.id} style={styles.service} onPress={() => reserve(sv.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{sv.name}</Text>
                  <Text style={styles.serviceMeta}>{sv.durationMinutes} min{sv.description ? ` · ${sv.description}` : ''}</Text>
                </View>
                <Text style={styles.price}>{formatDA(sv.priceDa)}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </Section>

          {s.staff.length > 1 ? (
            <Section title="L'équipe">
              <Text style={styles.meta}>{s.staff.map((m) => m.displayName).join(' · ')}</Text>
            </Section>
          ) : null}

          <Section title="Horaires">
            <OpeningHours salon={s} />
          </Section>

          {s.phone ? (
            <Section title="Contact">
              <Text style={styles.meta}>{formatDZPhone(s.phone)}</Text>
            </Section>
          ) : null}

          <Reviews salonId={s.id} />
        </View>
      </Screen>
    </>
  );
}

function OpeningHours({ salon }: { salon: SalonPublic }) {
  return (
    <View>
      {WEEK_DAYS.map((d) => {
        const ranges = salon.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed);
        return (
          <View key={d} style={styles.hoursRow}>
            <Text style={styles.hoursDay}>{DAY_LABELS_FR[d]}</Text>
            <Text style={[styles.hoursValue, ranges.length === 0 && { color: colors.danger }]}>
              {ranges.length ? ranges.map((r) => `${r.opensAt} – ${r.closesAt}`).join(', ') : 'Fermé'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Reviews({ salonId }: { salonId: string }) {
  const reviews = useSalonReviews(salonId);
  const items = reviews.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <Section title="Avis">
      {items.slice(0, 5).map((r) => (
        <View key={r.id} style={styles.review}>
          <Text style={styles.reviewHead}>
            {'★'.repeat(r.rating)}
            {'☆'.repeat(5 - r.rating)} · {r.authorName}
          </Text>
          {r.comment ? <Text style={styles.reviewBody}>{r.comment}</Text> : null}
        </View>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  cover: { height: 200, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg },
  name: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.text },
  meta: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
  rating: { color: colors.accent, fontWeight: font.weight.semibold, marginTop: spacing.xs },
  description: { color: colors.text, marginTop: spacing.md, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  service: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  serviceName: { fontSize: font.size.md, fontWeight: font.weight.medium, color: colors.text },
  serviceMeta: { fontSize: font.size.sm, color: colors.textMuted },
  price: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.primaryDark },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  hoursDay: { color: colors.text },
  hoursValue: { color: colors.textMuted },
  review: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.sm },
  reviewHead: { color: colors.accent, fontWeight: font.weight.semibold },
  reviewBody: { color: colors.text, marginTop: 4 },
});
