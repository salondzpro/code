import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useProSalon, useProStaffMutations } from '@salondz/api-client';
import type { Staff } from '@salondz/types';
import { createStaffSchema } from '@salondz/validation';
import { Button, Loading, Muted, Screen, Sheet, TextField, errorMessage } from '@/components';
import { colors, font, radius, spacing } from '@/theme/tokens';

export default function Equipe() {
  const salon = useProSalon().data?.salon ?? null;
  const { create, update, remove } = useProStaffMutations();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Loading />;

  const onError = (e: unknown) => Alert.alert('Action impossible', errorMessage(e));

  const add = () => {
    const parsed = createStaffSchema.safeParse({ displayName: name });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Nom invalide');
    setError(null);
    create.mutate(parsed.data, {
      onSuccess: () => {
        setName('');
        setOpen(false);
      },
      onError,
    });
  };

  const confirmDelete = (m: Staff) =>
    Alert.alert(`Retirer ${m.displayName} ?`, 'Ses rendez-vous passés restent dans l\'historique.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => remove.mutate(m.id, { onError }) },
    ]);

  return (
    <Screen scroll>
      <Muted>Chaque membre a son propre agenda. Un client peut choisir un membre ou « sans préférence ».</Muted>
      <View style={{ height: spacing.md }} />
      <Button title="+ Ajouter un membre" onPress={() => setOpen(true)} fullWidth />
      <View style={{ height: spacing.md }} />
      {salon.staff.map((m) => (
        <View key={m.id} style={[styles.item, !m.isActive && { opacity: 0.55 }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{m.displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{m.displayName}</Text>
            <Text style={styles.meta}>{m.userId === salon.ownerId ? 'Propriétaire' : m.isActive ? 'Actif' : 'Inactif'}</Text>
          </View>
          <Switch value={m.isActive} onValueChange={(v) => update.mutate({ id: m.id, isActive: v }, { onError })} />
          <Pressable onPress={() => confirmDelete(m)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
            <Text style={styles.delete}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Sheet visible={open} onClose={() => setOpen(false)} title="Nouveau membre">
        <TextField label="Nom affiché" value={name} onChangeText={setName} placeholder="Ex : Sofiane" autoFocus error={error} />
        <Button title="Ajouter" onPress={add} loading={create.isPending} fullWidth />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontWeight: font.weight.bold, fontSize: font.size.md },
  name: { fontSize: font.size.md, fontWeight: font.weight.medium, color: colors.text },
  meta: { fontSize: font.size.sm, color: colors.textMuted },
  delete: { color: colors.danger, fontSize: font.size.md, fontWeight: font.weight.bold },
});
