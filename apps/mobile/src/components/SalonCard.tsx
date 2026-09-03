import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { SalonSummary } from '@salondz/types';
import { categoryLabel, formatFromPrice, GENDER_TARGET_LABELS_FR, wilayaName } from '@salondz/constants';
import { colors, font, radius, shadow, spacing } from '@/theme/tokens';

interface SalonCardProps {
  salon: SalonSummary;
  onPress: () => void;
}

export function SalonCard({ salon, onPress }: SalonCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.cover}>
        {salon.coverUrl ? (
          <Image source={{ uri: salon.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="cut-outline" size={32} color={colors.primary} />
          </View>
        )}
        <View style={styles.genderPill}>
          <Text style={styles.genderText}>{GENDER_TARGET_LABELS_FR[salon.genderTarget]}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {salon.name}
          </Text>
          {salon.ratingCount > 0 ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={14} color={colors.accent} />
              <Text style={styles.ratingText}>
                {salon.ratingAvg.toFixed(1)} ({salon.ratingCount})
              </Text>
            </View>
          ) : (
            <Text style={styles.newBadge}>Nouveau</Text>
          )}
        </View>
        <Text style={styles.location} numberOfLines={1}>
          {salon.city} · {wilayaName(salon.wilayaCode)}
          {salon.distanceKm != null ? ` · ${salon.distanceKm.toFixed(1)} km` : ''}
        </Text>
        <View style={styles.row}>
          <Text style={styles.categories} numberOfLines={1}>
            {salon.categoryIds.map((c) => categoryLabel(c)).join(' · ')}
          </Text>
          {salon.minPriceDa != null ? <Text style={styles.price}>{formatFromPrice(salon.minPriceDa)}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.lg, ...shadow.card },
  pressed: { opacity: 0.92 },
  cover: { height: 140, backgroundColor: colors.surfaceAlt },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  genderPill: { position: 'absolute', top: spacing.sm, left: spacing.sm, backgroundColor: colors.bg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  genderText: { fontSize: font.size.xs, color: colors.text, fontWeight: font.weight.medium },
  body: { padding: spacing.md, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: font.size.sm, color: colors.text, fontWeight: font.weight.medium },
  newBadge: { fontSize: font.size.xs, color: colors.primaryDark, backgroundColor: colors.primarySoft, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  location: { fontSize: font.size.sm, color: colors.textMuted },
  categories: { flex: 1, fontSize: font.size.sm, color: colors.textMuted },
  price: { fontSize: font.size.sm, color: colors.primaryDark, fontWeight: font.weight.semibold },
});
