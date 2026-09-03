import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES, GENDER_TARGETS, GENDER_TARGET_LABELS_FR, type CategoryId, type GenderTarget } from '@salondz/constants';
import { createSalonSchema, type CreateSalonInput } from '@salondz/validation';
import { colors, font, spacing } from '@/theme/tokens';
import { Button } from './Button';
import { Chip } from './Chip';
import { TextField } from './TextField';
import { WilayaPicker } from './WilayaPicker';

export interface SalonFormValues {
  name: string;
  description: string;
  phone: string;
  wilayaCode: number | undefined;
  city: string;
  address: string;
  genderTarget: GenderTarget;
  categoryIds: CategoryId[];
}

interface SalonFormProps {
  initial?: Partial<SalonFormValues>;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: CreateSalonInput) => void;
}

/** Formulaire salon partagé (onboarding + édition). Validé avec le schéma Zod partagé. */
export function SalonForm({ initial, submitLabel, submitting, onSubmit }: SalonFormProps) {
  const [v, setV] = useState<SalonFormValues>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    phone: initial?.phone ?? '',
    wilayaCode: initial?.wilayaCode,
    city: initial?.city ?? '',
    address: initial?.address ?? '',
    genderTarget: initial?.genderTarget ?? 'unisex',
    categoryIds: initial?.categoryIds ?? [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof SalonFormValues>(k: K, val: SalonFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const toggleCategory = (id: CategoryId) =>
    set('categoryIds', v.categoryIds.includes(id) ? v.categoryIds.filter((c) => c !== id) : [...v.categoryIds, id].slice(0, 4));

  const submit = () => {
    const parsed = createSalonSchema.safeParse({
      name: v.name,
      description: v.description.trim() || undefined,
      phone: v.phone.trim() || undefined,
      wilayaCode: v.wilayaCode,
      city: v.city,
      address: v.address.trim() || undefined,
      genderTarget: v.genderTarget,
      categoryIds: v.categoryIds,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
      if (next.wilayaCode) next.wilayaCode = 'Choisissez une wilaya';
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <View>
      <TextField label="Nom du salon" value={v.name} onChangeText={(t) => set('name', t)} placeholder="Ex : Barber Élégance" error={errors.name} />
      <Text style={styles.label}>Catégories (1 à 4)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.labelFr} selected={v.categoryIds.includes(c.id)} onPress={() => toggleCategory(c.id)} />
        ))}
      </ScrollView>
      {errors.categoryIds ? <Text style={styles.error}>{errors.categoryIds}</Text> : null}

      <Text style={styles.label}>Clientèle</Text>
      <View style={styles.row}>
        {GENDER_TARGETS.map((g) => (
          <Chip key={g} label={GENDER_TARGET_LABELS_FR[g]} selected={v.genderTarget === g} onPress={() => set('genderTarget', g)} />
        ))}
      </View>

      <WilayaPicker label="Wilaya" value={v.wilayaCode} onChange={(c) => set('wilayaCode', c)} />
      {errors.wilayaCode ? <Text style={styles.error}>{errors.wilayaCode}</Text> : null}
      <TextField label="Commune / quartier" value={v.city} onChangeText={(t) => set('city', t)} placeholder="Ex : Bab Ezzouar" error={errors.city} />
      <TextField label="Adresse" value={v.address} onChangeText={(t) => set('address', t)} placeholder="Ex : 12 rue Didouche Mourad" error={errors.address} />
      <TextField label="Téléphone du salon" value={v.phone} onChangeText={(t) => set('phone', t)} placeholder="05 51 23 45 67" keyboardType="phone-pad" error={errors.phone} />
      <TextField label="Description" value={v.description} onChangeText={(t) => set('description', t)} placeholder="Présentez votre salon en quelques lignes…" multiline error={errors.description} />
      <Button title={submitLabel} onPress={submit} loading={submitting} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.text, marginBottom: spacing.xs },
  chips: { marginBottom: spacing.md },
  row: { flexDirection: 'row', marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: font.size.xs, marginTop: -spacing.sm, marginBottom: spacing.sm },
});
