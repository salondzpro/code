import React from 'react';
import { Alert, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { wilayaName } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { Button, Loading, Screen, Section, Title, errorMessage } from '@/components';
import { colors, font, radius, spacing } from '@/theme/tokens';

export default function MonSalon() {
  const router = useRouter();
  const { signOut } = useAuth();
  const query = useProSalon();
  const { updateSalon } = useProSalonMutations();
  const salon = query.data?.salon ?? null;
  if (!salon) return <Loading />;

  const shareUrl = `${env.webUrl}/s/${salon.slug}`;
  const activeServices = salon.services.filter((s) => s.isActive).length;
  const activeStaff = salon.staff.filter((s) => s.isActive).length;
  const openDays = new Set(salon.openingHours.filter((h) => !h.isClosed).map((h) => h.dayOfWeek)).size;

  const togglePublish = (on: boolean) =>
    updateSalon.mutate(
      { isPublished: on },
      {
        onError: (e) => {
          const details = e instanceof ApiError && Array.isArray(e.details) ? (e.details as string[]).join('\n') : '';
          Alert.alert('Publication impossible', details || errorMessage(e));
        },
      },
    );

  return (
    <Screen scroll refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Title>{salon.name}</Title>
      <Text style={styles.meta}>
        {salon.city} · {wilayaName(salon.wilayaCode)}
      </Text>

      <View style={[styles.publish, salon.isPublished ? styles.publishOn : styles.publishOff]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.publishTitle}>{salon.isPublished ? 'Page publiée' : 'Page non publiée'}</Text>
          <Text style={styles.publishHint}>
            {salon.isPublished ? 'Les clients peuvent réserver en ligne.' : 'Ajoutez un service et des horaires, puis activez pour recevoir des réservations.'}
          </Text>
        </View>
        <Switch value={salon.isPublished} onValueChange={togglePublish} disabled={updateSalon.isPending} trackColor={{ true: colors.success }} />
      </View>

      <Button title="Partager ma page" variant="secondary" onPress={() => void Share.share({ message: `Réservez chez ${salon.name} : ${shareUrl}`, url: shareUrl })} fullWidth />

      <Section title="Gérer">
        <Row icon="cut-outline" label="Services" value={`${activeServices} actif${activeServices > 1 ? 's' : ''}`} onPress={() => router.push('/(pro)/services' as never)} />
        <Row icon="people-outline" label="Équipe" value={`${activeStaff} membre${activeStaff > 1 ? 's' : ''}`} onPress={() => router.push('/(pro)/equipe' as never)} />
        <Row icon="time-outline" label="Horaires" value={`${openDays} j/7`} onPress={() => router.push('/(pro)/horaires' as never)} />
        <Row icon="airplane-outline" label="Congés & pauses" value="" onPress={() => router.push('/(pro)/blocages' as never)} />
        <Row icon="storefront-outline" label="Profil, photos & réglages" value="" onPress={() => router.push('/(pro)/profil' as never)} />
      </Section>

      <Section title="Compte">
        <Row icon="person-outline" label="Espace client" value="" onPress={() => router.push('/(client)/(tabs)' as never)} />
        <Button title="Se déconnecter" variant="danger" onPress={() => void signOut()} style={{ marginTop: spacing.md }} />
      </Section>
    </Screen>
  );
}

function Row({ icon, label, value, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.md },
  publish: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.md },
  publishOn: { backgroundColor: colors.successSoft },
  publishOff: { backgroundColor: colors.warningSoft },
  publishTitle: { fontWeight: font.weight.bold, color: colors.text },
  publishHint: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { flex: 1, color: colors.text, fontSize: font.size.md },
  rowValue: { color: colors.textMuted, fontSize: font.size.sm },
});
