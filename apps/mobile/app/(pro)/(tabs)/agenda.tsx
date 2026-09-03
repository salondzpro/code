import React, { useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useProBookingMutations, useProBookings, useProSalon, useProStats } from '@salondz/api-client';
import type { BookingWithStaff } from '@salondz/types';
import { formatDA, formatDateLongDZ, localDateTimeToISO, toLocalDateKey, weekKeys } from '@salondz/constants';
import { createWalkInBookingSchema } from '@salondz/validation';
import { useRealtimeBookings } from '@/lib/realtime';
import { BookingCard, Button, Chip, EmptyState, ErrorText, Loading, Screen, Sheet, TextField, Title, WeekStrip, errorMessage } from '@/components';
import { colors, font, radius, spacing } from '@/theme/tokens';

/** Agenda pro : vue jour, semaine dimanche→samedi, temps réel. */
export default function Agenda() {
  const salonQuery = useProSalon();
  const salon = salonQuery.data?.salon ?? null;
  const [date, setDate] = useState(toLocalDateKey());
  const [staffFilter, setStaffFilter] = useState<string | undefined>(undefined);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const week = useMemo(() => weekKeys(date), [date]);
  const weekBookings = useProBookings({ from: week[0], to: week[6], limit: 200 });
  const stats = useProStats();
  const mutations = useProBookingMutations();
  useRealtimeBookings(salon?.id);

  const markedDays = useMemo(() => {
    const set = new Set<string>();
    for (const b of weekBookings.data?.items ?? []) if (b.status !== 'cancelled') set.add(toLocalDateKey(new Date(b.startsAt)));
    return set;
  }, [weekBookings.data]);

  const dayItems = useMemo(
    () =>
      (weekBookings.data?.items ?? [])
        .filter((b) => toLocalDateKey(new Date(b.startsAt)) === date)
        .filter((b) => !staffFilter || b.staffId === staffFilter)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [weekBookings.data, date, staffFilter],
  );

  if (!salon) return <Loading />;

  const act = (label: string, fn: () => void) => Alert.alert(label, undefined, [{ text: 'Non', style: 'cancel' }, { text: 'Oui', onPress: fn }]);
  const onError = (e: unknown) => Alert.alert('Action impossible', errorMessage(e));

  const actions = (b: BookingWithStaff) => {
    const busy = mutations.setStatus.isPending || mutations.cancel.isPending;
    if (b.status === 'pending') {
      return (
        <>
          <Button title="Confirmer" size="sm" disabled={busy} onPress={() => mutations.setStatus.mutate({ id: b.id, status: 'confirmed' }, { onError })} />
          <Button title="Refuser" size="sm" variant="danger" disabled={busy} onPress={() => act('Refuser cette demande ?', () => mutations.cancel.mutate({ id: b.id, reason: 'Indisponible' }, { onError }))} />
        </>
      );
    }
    if (b.status === 'confirmed') {
      return (
        <>
          <Button title="Terminé" size="sm" variant="secondary" disabled={busy} onPress={() => mutations.setStatus.mutate({ id: b.id, status: 'completed' }, { onError })} />
          <Button title="Absent" size="sm" variant="ghost" disabled={busy} onPress={() => mutations.setStatus.mutate({ id: b.id, status: 'no_show' }, { onError })} />
          <Button title="Annuler" size="sm" variant="danger" disabled={busy} onPress={() => act('Annuler ce rendez-vous ? Le client sera prévenu.', () => mutations.cancel.mutate({ id: b.id }, { onError }))} />
        </>
      );
    }
    return null;
  };

  return (
    <Screen padded={false}>
      <FlatList
        data={dayItems}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshing={weekBookings.isRefetching}
        onRefresh={() => void weekBookings.refetch()}
        ListHeaderComponent={
          <View>
            <View style={styles.top}>
              <Title>Agenda</Title>
              <Button title="+ RDV" size="sm" onPress={() => setWalkInOpen(true)} />
            </View>
            <View style={styles.stats}>
              <Stat label="Aujourd'hui" value={String(stats.data?.todayCount ?? '–')} />
              <Stat label="En attente" value={String(stats.data?.pendingCount ?? '–')} accent={(stats.data?.pendingCount ?? 0) > 0} />
              <Stat label="Semaine" value={stats.data ? formatDA(stats.data.weekRevenueDa) : '–'} />
            </View>
            <WeekStrip value={date} onChange={setDate} minDateKey={null} markedDays={markedDays} />
            {salon.staff.filter((m) => m.isActive).length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                <Chip label="Toute l'équipe" selected={!staffFilter} onPress={() => setStaffFilter(undefined)} />
                {salon.staff.filter((m) => m.isActive).map((m) => (
                  <Chip key={m.id} label={m.displayName} selected={staffFilter === m.id} onPress={() => setStaffFilter(m.id)} />
                ))}
              </ScrollView>
            ) : null}
            <Text style={styles.dayTitle}>{formatDateLongDZ(localDateTimeToISO(date, '12:00'))}</Text>
            {weekBookings.isError ? <ErrorText error={weekBookings.error} onRetry={() => void weekBookings.refetch()} /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <BookingCard booking={item} title={item.clientName} staffName={item.staff?.displayName} showDate={false}>
            {actions(item)}
          </BookingCard>
        )}
        ListEmptyComponent={
          weekBookings.isLoading ? (
            <Loading inline />
          ) : (
            <EmptyState icon="cafe-outline" title="Journée libre" description="Aucun rendez-vous ce jour. Ajoutez un client de passage ou partagez votre page pour recevoir des réservations." />
          )
        }
      />
      <WalkInSheet visible={walkInOpen} onClose={() => setWalkInOpen(false)} date={date} salon={salon} />
    </Screen>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.stat, accent && { backgroundColor: colors.accentSoft }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function WalkInSheet({ visible, onClose, date, salon }: { visible: boolean; onClose: () => void; date: string; salon: NonNullable<ReturnType<typeof useProSalon>['data']>['salon'] }) {
  const { createWalkIn } = useProBookingMutations();
  const activeServices = salon?.services.filter((s) => s.isActive) ?? [];
  const activeStaff = salon?.staff.filter((s) => s.isActive) ?? [];
  const [serviceId, setServiceId] = useState<string | null>(activeServices[0]?.id ?? null);
  const [staffId, setStaffId] = useState<string | null>(activeStaff[0]?.id ?? null);
  const [time, setTime] = useState('10:00');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setError('Heure au format HH:mm (ex : 14:30)');
    const parsed = createWalkInBookingSchema.safeParse({
      serviceId,
      staffId,
      startsAt: localDateTimeToISO(date, time),
      clientName,
      clientPhone: clientPhone.trim() || undefined,
      source: 'walk_in',
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Données invalides');
    setError(null);
    createWalkIn.mutate(parsed.data, {
      onSuccess: () => {
        setClientName('');
        setClientPhone('');
        onClose();
      },
      onError: (e) => setError(errorMessage(e)),
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Ajouter un rendez-vous">
      <Text style={styles.label}>Service</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
        {activeServices.map((s) => (
          <Chip key={s.id} label={`${s.name} · ${formatDA(s.priceDa)}`} selected={serviceId === s.id} onPress={() => setServiceId(s.id)} />
        ))}
      </ScrollView>
      <Text style={styles.label}>Membre</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
        {activeStaff.map((m) => (
          <Chip key={m.id} label={m.displayName} selected={staffId === m.id} onPress={() => setStaffId(m.id)} />
        ))}
      </ScrollView>
      <TextField label={`Heure (${date})`} value={time} onChangeText={setTime} placeholder="14:30" keyboardType="numbers-and-punctuation" />
      <TextField label="Nom du client" value={clientName} onChangeText={setClientName} placeholder="Ex : Mohamed" />
      <TextField label="Téléphone (facultatif)" value={clientPhone} onChangeText={setClientPhone} placeholder="05 51 23 45 67" keyboardType="phone-pad" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Ajouter" onPress={submit} loading={createWalkIn.isPending} fullWidth />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  statValue: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  statLabel: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },
  dayTitle: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text, marginBottom: spacing.sm, textTransform: 'capitalize' },
  label: { fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.text, marginBottom: spacing.xs },
  error: { color: colors.danger, fontSize: font.size.sm, marginBottom: spacing.sm },
});
