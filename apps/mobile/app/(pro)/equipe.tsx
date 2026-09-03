import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useProSalon, useProStaffMutations, useStaffHours } from '@salondz/api-client';
import type { OpeningHour, Staff } from '@salondz/types';
import { DAY_LABELS_FR, WEEK_DAYS, type DayOfWeek } from '@salondz/constants';
import { createStaffSchema, setStaffHoursSchema } from '@salondz/validation';
import { Button, Chip, Loading, Muted, Screen, Sheet, TextField, errorMessage } from '@/components';
import { colors, font, radius, spacing } from '@/theme/tokens';

export default function Equipe() {
  const salon = useProSalon().data?.salon ?? null;
  const { create, update, remove } = useProStaffMutations();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hoursFor, setHoursFor] = useState<Staff | null>(null);
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
    Alert.alert(`Retirer ${m.displayName} ?`, "Ses rendez-vous passés restent dans l'historique.", [
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
          <View style={styles.itemHead}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{m.displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{m.displayName}</Text>
              <Text style={styles.meta}>{m.userId === salon.ownerId ? 'Propriétaire' : m.isActive ? 'Actif' : 'Inactif'}</Text>
            </View>
            <Switch value={m.isActive} onValueChange={(v) => update.mutate({ id: m.id, isActive: v }, { onError })} />
            <Pressable onPress={() => confirmDelete(m)} hitSlop={8} style={{ marginLeft: spacing.sm }} accessibilityLabel={`Retirer ${m.displayName}`}>
              <Text style={styles.delete}>✕</Text>
            </Pressable>
          </View>
          <Button title="Horaires du membre" variant="ghost" size="sm" onPress={() => setHoursFor(m)} style={{ alignSelf: 'flex-start' }} />
        </View>
      ))}
      <Sheet visible={open} onClose={() => setOpen(false)} title="Nouveau membre">
        <TextField label="Nom affiché" value={name} onChangeText={setName} placeholder="Ex : Sofiane" autoFocus error={error} />
        <Button title="Ajouter" onPress={add} loading={create.isPending} fullWidth />
      </Sheet>
      {hoursFor ? <StaffHoursSheet member={hoursFor} salonHours={salon.openingHours} onClose={() => setHoursFor(null)} /> : null}
    </Screen>
  );
}

interface Row {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
}

function rowsFromSalon(salonHours: OpeningHour[]): Row[] {
  return WEEK_DAYS.map((d) => {
    const h = salonHours.find((x) => x.dayOfWeek === d && !x.isClosed);
    return { dayOfWeek: d, enabled: !!h, startsAt: h?.opensAt ?? '09:00', endsAt: h?.closesAt ?? '19:00' };
  });
}

/**
 * Horaires propres d'un membre. Liste vide côté API = « suit les horaires du salon ».
 * Les créneaux réservables = salon ∩ membre (calcul en SQL).
 */
function StaffHoursSheet({ member, salonHours, onClose }: { member: Staff; salonHours: OpeningHour[]; onClose: () => void }) {
  const hours = useStaffHours(member.id);
  const { setHours } = useProStaffMutations();
  const [custom, setCustom] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => rowsFromSalon(salonHours));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hours.data) return;
    if (hours.data.length === 0) {
      setCustom(false);
      setRows(rowsFromSalon(salonHours));
      return;
    }
    setCustom(true);
    const base = rowsFromSalon(salonHours);
    setRows(
      WEEK_DAYS.map((d) => {
        const h = hours.data.find((x) => x.dayOfWeek === d);
        const def = base.find((r) => r.dayOfWeek === d)!;
        return h ? { dayOfWeek: d, enabled: true, startsAt: h.startsAt, endsAt: h.endsAt } : { ...def, enabled: false };
      }),
    );
  }, [hours.data, salonHours]);

  const patch = (d: DayOfWeek, p: Partial<Row>) => setRows((r) => r.map((x) => (x.dayOfWeek === d ? { ...x, ...p } : x)));

  const save = () => {
    const payload = { hours: custom ? rows.filter((r) => r.enabled).map(({ dayOfWeek, startsAt, endsAt }) => ({ dayOfWeek, startsAt, endsAt })) : [] };
    const parsed = setStaffHoursSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const idx = typeof issue?.path[1] === 'number' ? issue.path[1] : null;
      const day = idx !== null ? DAY_LABELS_FR[payload.hours[idx]!.dayOfWeek] + ' : ' : '';
      return setError(`${day}${issue?.message ?? 'Horaires invalides'}`);
    }
    setError(null);
    setHours.mutate(
      { id: member.id, hours: parsed.data.hours },
      {
        onSuccess: () => {
          Alert.alert('Horaires enregistrés');
          onClose();
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };

  return (
    <Sheet visible onClose={onClose} title={`Horaires de ${member.displayName}`}>
      <View style={styles.chips}>
        <Chip label="Suit les horaires du salon" selected={!custom} onPress={() => setCustom(false)} />
        <Chip label="Personnalisés" selected={custom} onPress={() => setCustom(true)} />
      </View>
      {hours.isLoading ? (
        <Loading inline />
      ) : custom ? (
        rows.map((r) => (
          <View key={r.dayOfWeek} style={[styles.dayRow, !r.enabled && { opacity: 0.7 }]}>
            <View style={styles.dayHead}>
              <Text style={styles.day}>{DAY_LABELS_FR[r.dayOfWeek]}</Text>
              <View style={styles.switchRow}>
                <Text style={styles.meta}>{r.enabled ? 'Travaille' : 'Repos'}</Text>
                <Switch value={r.enabled} onValueChange={(v) => patch(r.dayOfWeek, { enabled: v })} trackColor={{ true: colors.success }} />
              </View>
            </View>
            {r.enabled ? (
              <View style={styles.times}>
                <TextField value={r.startsAt} onChangeText={(t) => patch(r.dayOfWeek, { startsAt: t })} placeholder="09:00" keyboardType="numbers-and-punctuation" containerStyle={styles.time} />
                <Text style={styles.dash}>–</Text>
                <TextField value={r.endsAt} onChangeText={(t) => patch(r.dayOfWeek, { endsAt: t })} placeholder="19:00" keyboardType="numbers-and-punctuation" containerStyle={styles.time} />
              </View>
            ) : null}
          </View>
        ))
      ) : (
        <Muted>Le membre est disponible aux mêmes heures que le salon.</Muted>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ height: spacing.md }} />
      <Button title="Enregistrer" onPress={save} loading={setHours.isPending} fullWidth />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  item: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm, gap: spacing.xs },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontWeight: font.weight.bold, fontSize: font.size.md },
  name: { fontSize: font.size.md, fontWeight: font.weight.medium, color: colors.text },
  meta: { fontSize: font.size.sm, color: colors.textMuted },
  delete: { color: colors.danger, fontSize: font.size.md, fontWeight: font.weight.bold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  dayRow: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  day: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  times: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  time: { flex: 1, marginBottom: 0 },
  dash: { color: colors.textMuted },
  error: { color: colors.danger, fontSize: font.size.sm, marginTop: spacing.sm },
});
