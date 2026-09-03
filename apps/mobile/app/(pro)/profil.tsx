import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useProSalonMutations, useProSalon } from '@salondz/api-client';
import { SALON_MAX_PHOTOS, SLOT_INTERVALS, type CategoryId } from '@salondz/constants';
import { pickAndUploadSalonPhoto } from '@/lib/upload';
import { Button, Chip, Loading, SalonForm, Screen, Section, errorMessage } from '@/components';
import { colors, font, radius, spacing } from '@/theme/tokens';

/** Profil du salon : infos, photos, réglages de réservation. */
export default function Profil() {
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon, setPhotos } = useProSalonMutations();
  const [uploading, setUploading] = useState(false);
  if (!salon) return <Loading />;

  const onError = (e: unknown) => Alert.alert('Action impossible', errorMessage(e));

  const addPhoto = async () => {
    if (salon.photos.length >= SALON_MAX_PHOTOS) return Alert.alert(`Maximum ${SALON_MAX_PHOTOS} photos`);
    setUploading(true);
    try {
      const url = await pickAndUploadSalonPhoto(salon.id);
      if (url) setPhotos.mutate([...salon.photos.map((p) => ({ url: p.url })), { url }], { onError });
    } catch (e) {
      onError(e);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) =>
    Alert.alert('Retirer cette photo ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => setPhotos.mutate(salon.photos.filter((p) => p.url !== url).map((p) => ({ url: p.url })), { onError }) },
    ]);

  return (
    <Screen scroll>
      <Section title="Photos">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {salon.photos.map((p, i) => (
            <Pressable key={p.id} onLongPress={() => removePhoto(p.url)} style={styles.photo}>
              <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {i === 0 ? <Text style={styles.coverTag}>Couverture</Text> : null}
            </Pressable>
          ))}
          <Pressable onPress={() => void addPhoto()} style={[styles.photo, styles.addPhoto]} disabled={uploading}>
            <Ionicons name={uploading ? 'cloud-upload-outline' : 'add'} size={28} color={colors.primary} />
            <Text style={styles.addText}>{uploading ? 'Envoi…' : 'Ajouter'}</Text>
          </Pressable>
        </ScrollView>
        <Text style={styles.hint}>La première photo est la couverture. Appui long pour retirer. Les images sont compressées automatiquement.</Text>
      </Section>

      <Section title="Réservation en ligne">
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Confirmation automatique</Text>
            <Text style={styles.hint}>Sinon, chaque demande passe par l'onglet Demandes.</Text>
          </View>
          <Switch value={salon.autoConfirm} onValueChange={(v) => updateSalon.mutate({ autoConfirm: v }, { onError })} />
        </View>
        <Text style={styles.settingLabel}>Intervalle des créneaux</Text>
        <View style={styles.chips}>
          {SLOT_INTERVALS.map((n) => (
            <Chip key={n} label={`${n} min`} selected={salon.slotIntervalMinutes === n} onPress={() => updateSalon.mutate({ slotIntervalMinutes: n }, { onError })} />
          ))}
        </View>
        <Text style={styles.settingLabel}>Délai minimum avant un RDV</Text>
        <View style={styles.chips}>
          {[0, 30, 60, 120, 240].map((n) => (
            <Chip key={n} label={n === 0 ? 'Aucun' : n < 60 ? `${n} min` : `${n / 60} h`} selected={salon.bookingLeadTimeMinutes === n} onPress={() => updateSalon.mutate({ bookingLeadTimeMinutes: n }, { onError })} />
          ))}
        </View>
        <Text style={styles.settingLabel}>Réservation possible jusqu'à</Text>
        <View style={styles.chips}>
          {[7, 14, 30, 60].map((n) => (
            <Chip key={n} label={`${n} jours`} selected={salon.bookingHorizonDays === n} onPress={() => updateSalon.mutate({ bookingHorizonDays: n }, { onError })} />
          ))}
        </View>
      </Section>

      <Section title="Informations">
        <SalonForm
          initial={{
            name: salon.name,
            description: salon.description ?? '',
            phone: salon.phone ?? '',
            wilayaCode: salon.wilayaCode,
            city: salon.city,
            address: salon.address ?? '',
            genderTarget: salon.genderTarget,
            categoryIds: salon.categoryIds as CategoryId[],
          }}
          submitLabel="Enregistrer"
          submitting={updateSalon.isPending}
          onSubmit={(values) => updateSalon.mutate(values, { onSuccess: () => Alert.alert('Salon mis à jour'), onError })}
        />
      </Section>
      <Button title="Lien public" variant="ghost" onPress={() => Alert.alert('Votre lien', `/s/${salon.slug}`)} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: 120, height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, marginRight: spacing.sm, overflow: 'hidden', justifyContent: 'flex-end' },
  coverTag: { backgroundColor: colors.primary, color: colors.textOnPrimary, fontSize: font.size.xs, textAlign: 'center', paddingVertical: 2 },
  addPhoto: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: colors.bg },
  addText: { color: colors.primary, fontSize: font.size.sm, marginTop: 4 },
  hint: { color: colors.textMuted, fontSize: font.size.xs, marginTop: spacing.xs, marginBottom: spacing.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  settingLabel: { fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.text, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md, rowGap: spacing.sm },
});
