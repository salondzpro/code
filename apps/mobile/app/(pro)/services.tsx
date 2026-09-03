import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import type { Service } from '@salondz/types';
import { CATEGORIES, formatDA, type CategoryId } from '@salondz/constants';
import { createServiceSchema } from '@salondz/validation';
import { Button, Chip, EmptyState, Loading, Screen, Sheet, TextField, errorMessage } from '@/components';
import { colors, font, radius, spacing } from '@/theme/tokens';

export default function Services() {
  const salon = useProSalon().data?.salon ?? null;
  const { create, update, remove } = useProServiceMutations();
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  if (!salon) return <Loading />;

  const onError = (e: unknown) => Alert.alert('Action impossible', errorMessage(e));

  const confirmDelete = (s: Service) =>
    Alert.alert(`Supprimer « ${s.name} » ?`, 'S\'il a déjà été réservé, il sera seulement désactivé.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => remove.mutate(s.id, { onError }) },
    ]);

  return (
    <Screen scroll>
      <Button title="+ Ajouter un service" onPress={() => setEditing('new')} fullWidth />
      <View style={{ height: spacing.md }} />
      {salon.services.length === 0 ? (
        <EmptyState icon="cut-outline" title="Aucun service" description="Ajoutez vos prestations avec leur durée et leur prix en DA. C'est indispensable pour publier votre page." />
      ) : (
        salon.services.map((s) => (
          <Pressable key={s.id} onPress={() => setEditing(s)} style={[styles.item, !s.isActive && { opacity: 0.55 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.meta}>
                {s.durationMinutes} min · {formatDA(s.priceDa)}
                {s.categoryId ? ` · ${CATEGORIES.find((c) => c.id === s.categoryId)?.labelFr ?? ''}` : ''}
              </Text>
            </View>
            <Switch value={s.isActive} onValueChange={(v) => update.mutate({ id: s.id, isActive: v }, { onError })} />
            <Pressable onPress={() => confirmDelete(s)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
              <Text style={styles.delete}>✕</Text>
            </Pressable>
          </Pressable>
        ))
      )}
      <ServiceSheet
        service={editing}
        onClose={() => setEditing(null)}
        submitting={create.isPending || update.isPending}
        onSubmit={(values) => {
          const done = { onSuccess: () => setEditing(null), onError };
          if (editing === 'new') create.mutate(values, done);
          else if (editing) update.mutate({ id: editing.id, ...values }, done);
        }}
      />
    </Screen>
  );
}

interface ServiceSheetProps {
  service: Service | 'new' | null;
  onClose: () => void;
  submitting: boolean;
  onSubmit: (values: { name: string; description?: string; durationMinutes: number; priceDa: number; categoryId?: CategoryId | null; isActive: boolean }) => void;
}

function ServiceSheet({ service, onClose, submitting, onSubmit }: ServiceSheetProps) {
  const existing = service && service !== 'new' ? service : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [duration, setDuration] = useState(String(existing?.durationMinutes ?? 30));
  const [price, setPrice] = useState(String(existing?.priceDa ?? ''));
  const [categoryId, setCategoryId] = useState<CategoryId | null>((existing?.categoryId as CategoryId | null) ?? null);
  const [error, setError] = useState<string | null>(null);

  // Réinitialise le formulaire à chaque ouverture
  const key = existing?.id ?? (service === 'new' ? 'new' : 'closed');
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
    setDuration(String(existing?.durationMinutes ?? 30));
    setPrice(String(existing?.priceDa ?? ''));
    setCategoryId((existing?.categoryId as CategoryId | null) ?? null);
    setError(null);
  }

  const submit = () => {
    const parsed = createServiceSchema.safeParse({
      name,
      description: description.trim() || undefined,
      durationMinutes: Number(duration),
      priceDa: Number(price.replace(/\s/g, '')),
      categoryId,
      isActive: existing?.isActive ?? true,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Données invalides');
    setError(null);
    onSubmit(parsed.data);
  };

  return (
    <Sheet visible={service !== null} onClose={onClose} title={existing ? 'Modifier le service' : 'Nouveau service'}>
      <TextField label="Nom" value={name} onChangeText={setName} placeholder="Ex : Coupe + barbe" />
      <View style={styles.twoCols}>
        <TextField label="Durée (min)" value={duration} onChangeText={setDuration} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
        <TextField label="Prix (DA)" value={price} onChangeText={setPrice} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
      </View>
      <Text style={styles.label}>Catégorie (facultatif)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
        <Chip label="Aucune" selected={!categoryId} onPress={() => setCategoryId(null)} />
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.labelFr} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </ScrollView>
      <TextField label="Description (facultatif)" value={description} onChangeText={setDescription} multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={existing ? 'Enregistrer' : 'Ajouter'} onPress={submit} loading={submitting} fullWidth />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm },
  name: { fontSize: font.size.md, fontWeight: font.weight.medium, color: colors.text },
  meta: { fontSize: font.size.sm, color: colors.textMuted },
  delete: { color: colors.danger, fontSize: font.size.md, fontWeight: font.weight.bold },
  twoCols: { flexDirection: 'row', gap: spacing.md },
  label: { fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.text, marginBottom: spacing.xs },
  error: { color: colors.danger, fontSize: font.size.sm, marginBottom: spacing.sm },
});
