import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, useAvailability, useCreateBooking, useMe, useSalon } from '@salondz/api-client';
import { addDaysToKey, formatDA, formatDateLongDZ, formatTimeDZ, toLocalDateKey } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { Button, Chip, EmptyState, ErrorText, Loading, Screen, SlotGrid, TextField, WeekStrip, errorMessage } from '@/components';
import { colors, font, radius, spacing } from '@/theme/tokens';

type Step = 1 | 2 | 3;

/** Parcours de réservation en 3 étapes : service → créneau → confirmation. */
export default function Reserver() {
  const { slug, serviceId: initialServiceId } = useLocalSearchParams<{ slug: string; serviceId?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const salon = useSalon(slug ?? '');
  const me = useMe(!!session);
  const createBooking = useCreateBooking();

  const [step, setStep] = useState<Step>(initialServiceId ? 2 : 1);
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId ?? null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState(toLocalDateKey());
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const s = salon.data;
  const service = useMemo(() => s?.services.find((x) => x.id === serviceId) ?? null, [s, serviceId]);
  const maxDate = s ? addDaysToKey(toLocalDateKey(), s.bookingHorizonDays) : null;

  const availability = useAvailability(s?.id ?? '', { serviceId: serviceId ?? '', date, ...(staffId ? { staffId } : {}) });

  useEffect(() => {
    if (me.data) {
      setClientName((v) => v || me.data!.profile.fullName || '');
      setClientPhone((v) => v || me.data!.profile.phone || '');
    }
  }, [me.data]);

  // Le créneau sélectionné n'est plus dispo (rafraîchissement) → on le retire.
  useEffect(() => {
    if (slot && availability.data && !availability.data.slots.some((x) => x.startsAt === slot)) setSlot(null);
  }, [availability.data, slot]);

  if (salon.isLoading) return <Loading />;
  if (salon.isError || !s) return <Screen><ErrorText error={salon.error ?? new Error('Salon introuvable')} /></Screen>;

  const goConfirm = () => {
    if (!session) {
      router.push({ pathname: '/(auth)/connexion', params: { redirect: `/(client)/salon/${s.slug}/reserver?serviceId=${serviceId ?? ''}` } } as never);
      return;
    }
    setStep(3);
  };

  const submit = () => {
    if (!serviceId || !slot) return;
    if (!clientName.trim()) return setNotice('Indiquez votre nom.');
    setNotice(null);
    createBooking.mutate(
      {
        salonId: s.id,
        serviceId,
        staffId: staffId ?? null,
        startsAt: slot,
        notes: notes.trim() || undefined,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
      },
      {
        onSuccess: (b) => {
          Alert.alert(
            b.status === 'confirmed' ? 'Réservation confirmée ✂️' : 'Demande envoyée',
            `${s.name} · ${b.serviceName}\n${formatDateLongDZ(b.startsAt)} à ${formatTimeDZ(b.startsAt)}`,
          );
          router.replace('/(client)/(tabs)/reservations' as never);
        },
        onError: (e) => {
          if (e instanceof ApiError && (e.code === 'SLOT_TAKEN' || e.code === 'TOO_SOON' || e.code === 'OUTSIDE_OPENING_HOURS')) {
            setNotice(e.message);
            setSlot(null);
            setStep(2);
            void availability.refetch();
          } else {
            setNotice(errorMessage(e));
          }
        },
      },
    );
  };

  return (
    <Screen scroll>
      <Stepper step={step} />
      <Text style={styles.salon}>{s.name}</Text>

      {step === 1 ? (
        <View>
          <Text style={styles.stepTitle}>Choisissez un service</Text>
          {s.services.map((sv) => (
            <Pressable
              key={sv.id}
              onPress={() => {
                setServiceId(sv.id);
                setSlot(null);
                setStep(2);
              }}
              style={[styles.service, sv.id === serviceId && styles.serviceSelected]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{sv.name}</Text>
                <Text style={styles.serviceMeta}>{sv.durationMinutes} min</Text>
              </View>
              <Text style={styles.price}>{formatDA(sv.priceDa)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {step === 2 && service ? (
        <View>
          <Pressable onPress={() => setStep(1)} style={styles.summary}>
            <Text style={styles.summaryText}>
              {service.name} · {service.durationMinutes} min · {formatDA(service.priceDa)}
            </Text>
            <Text style={styles.link}>Changer</Text>
          </Pressable>
          {s.staff.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <Chip label="Sans préférence" selected={!staffId} onPress={() => setStaffId(null)} />
              {s.staff.map((m) => (
                <Chip key={m.id} label={m.displayName} selected={staffId === m.id} onPress={() => setStaffId(m.id)} />
              ))}
            </ScrollView>
          ) : null}
          <WeekStrip value={date} onChange={(d) => { setDate(d); setSlot(null); }} maxDateKey={maxDate} />
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {availability.isLoading ? (
            <Loading inline label="Recherche des créneaux…" />
          ) : availability.isError ? (
            <ErrorText error={availability.error} onRetry={() => void availability.refetch()} />
          ) : (availability.data?.slots.length ?? 0) === 0 ? (
            <EmptyState icon="time-outline" title="Aucun créneau ce jour" description="Essayez un autre jour ou un autre membre de l'équipe." />
          ) : (
            <SlotGrid slots={availability.data!.slots} value={slot} onChange={setSlot} />
          )}
          <Button title="Continuer" onPress={goConfirm} disabled={!slot} fullWidth style={{ marginTop: spacing.lg }} />
        </View>
      ) : null}

      {step === 3 && service && slot ? (
        <View>
          <Text style={styles.stepTitle}>Confirmez votre rendez-vous</Text>
          <View style={styles.recap}>
            <Row icon="cut-outline" text={`${service.name} · ${service.durationMinutes} min`} />
            <Row icon="calendar-outline" text={`${formatDateLongDZ(slot)} à ${formatTimeDZ(slot)}`} />
            <Row icon="person-outline" text={staffId ? (s.staff.find((m) => m.id === staffId)?.displayName ?? '') : 'Premier membre disponible'} />
            <Row icon="cash-outline" text={`${formatDA(service.priceDa)} — à régler sur place`} />
          </View>
          <TextField label="Votre nom" value={clientName} onChangeText={setClientName} placeholder="Ex : Amine Benali" />
          <TextField label="Téléphone (recommandé)" value={clientPhone} onChangeText={setClientPhone} placeholder="05 51 23 45 67" keyboardType="phone-pad" />
          <TextField label="Note pour le salon (facultatif)" value={notes} onChangeText={setNotes} placeholder="Ex : dégradé, barbe courte…" multiline />
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Button title={s.autoConfirm ? 'Confirmer la réservation' : 'Envoyer la demande'} onPress={submit} loading={createBooking.isPending} fullWidth />
          <Button title="Modifier le créneau" variant="ghost" onPress={() => setStep(2)} style={{ marginTop: spacing.sm }} />
        </View>
      ) : null}
    </Screen>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ['Service', 'Créneau', 'Confirmation'];
  return (
    <View style={styles.stepper}>
      {labels.map((l, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <View key={l} style={styles.stepItem}>
            <View style={[styles.stepDot, (active || done) && styles.stepDotActive]}>
              <Text style={[styles.stepNum, (active || done) && { color: colors.textOnPrimary }]}>{done ? '✓' : n}</Text>
            </View>
            <Text style={[styles.stepLabel, active && { color: colors.text, fontWeight: font.weight.semibold }]}>{l}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Row({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: colors.primary },
  stepNum: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.textMuted },
  stepLabel: { fontSize: font.size.xs, color: colors.textMuted },
  salon: { fontSize: font.size.sm, color: colors.textMuted, marginBottom: spacing.md, textAlign: 'center' },
  stepTitle: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text, marginBottom: spacing.md },
  service: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  serviceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  serviceName: { fontSize: font.size.md, fontWeight: font.weight.medium, color: colors.text },
  serviceMeta: { fontSize: font.size.sm, color: colors.textMuted },
  price: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.primaryDark },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.md },
  summaryText: { flex: 1, color: colors.text, fontWeight: font.weight.medium },
  link: { color: colors.primary, fontWeight: font.weight.semibold },
  notice: { color: colors.warning, backgroundColor: colors.warningSoft, padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.sm, fontSize: font.size.sm },
  recap: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, color: colors.text },
});
