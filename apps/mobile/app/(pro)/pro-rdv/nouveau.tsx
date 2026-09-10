/**
 * Espace pro — Nouveau rendez-vous (client de passage ou téléphone), pensé pour le quotidien : d'abord QUAND
 * (jours à faire défiler, heure en grand, créneaux du jour en un tap — ceux déjà pris par le membre sont grisés),
 * puis les prestations, puis le client. Le membre se choisit en pastilles.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProBookingMutations, useProBookings, useProSalon } from '@salondz/api-client';
import {
  dayOfWeekFromKey,
  formatDA,
  formatDateShortDZ,
  localDateTimeToISO,
  minutesToTime,
  relativeDayLabelDZ,
  timeToMinutes,
  toLocalDateKey,
} from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { errorText } from '@/lib/errors';
import { formatDuration } from '@/lib/format';
import {
  Alert,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  Field,
  H1,
  Input,
  ListCard,
  P,
  Row,
  TopBar,
  Tx,
} from '@/ui';
import { R } from '@/theme/design';
import { TimeSheet } from '@/ui/Pickers';
import { DayScroller } from '@/ui/DayCarousel';
import { capitalize } from '@/lib/salon';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function ProBookingNew() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    date?: string;
    time?: string;
    staff?: string;
    name?: string;
    phone?: string;
  }>();
  const salon = useProSalon().data?.salon ?? null;
  const { createWalkIn } = useProBookingMutations();
  const [name, setName] = useState(params.name ?? '');
  const [phone, setPhone] = useState(params.phone ?? '');
  const [services, setServices] = useState<string[]>([]);
  const [date, setDate] = useState(params.date ?? toLocalDateKey());
  const [time, setTime] = useState(
    /^\d{2}:\d{2}$/.test(params.time ?? '') ? params.time! : '10:00',
  );
  const [staffId, setStaffId] = useState<string>(params.staff ?? '');
  const [timeSheet, setTimeSheet] = useState(false);
  const stripRef = useRef<ScrollView>(null);
  const [error, setError] = useState<string | null>(null);
  // Rendez-vous déjà pris ce jour-là (pour griser les créneaux du membre choisi).
  const dayBookings = useProBookings({ from: date, to: date, limit: 200 }, !!salon);
  if (!salon) return <Splash />;
  const active = salon.services.filter((s) => s.isActive);
  const staff = salon.staff.filter((s) => s.isActive);
  const chosen = services.map((id) => active.find((s) => s.id === id)).filter(Boolean);
  const total = chosen.reduce((a, s) => a + (s?.priceDa ?? 0), 0);
  const minutes = chosen.reduce((a, s) => a + (s?.durationMinutes ?? 0), 0);
  const sid = staffId || staff[0]?.id || '';
  const dow = dayOfWeekFromKey(date);
  const hours = salon.openingHours.filter((h) => h.dayOfWeek === dow && !h.isClosed);
  const step = salon.slotIntervalMinutes || 15;
  const need = Math.max(minutes, step);
  // Créneaux du jour : toutes les heures d'ouverture au pas du salon ; pris = chevauche un rendez-vous du membre.
  const slots = hours.flatMap((h) => {
    const out: { t: string; taken: boolean }[] = [];
    for (let m = timeToMinutes(h.opensAt); m + need <= timeToMinutes(h.closesAt); m += step) {
      const t = minutesToTime(m);
      const startIso = localDateTimeToISO(date, t);
      const endMs = new Date(startIso).getTime() + need * 60_000;
      const taken = (dayBookings.data?.items ?? []).some(
        (b) =>
          (b.status === 'pending' || b.status === 'confirmed') &&
          b.staffId === sid &&
          new Date(b.startsAt).getTime() < endMs &&
          new Date(b.endsAt).getTime() > new Date(startIso).getTime(),
      );
      out.push({ t, taken });
    }
    return out;
  });
  const endTime = minutesToTime(timeToMinutes(time) + minutes);
  const CHIP_W = 74;
  useEffect(() => {
    const idx = slots.findIndex((x) => x.t === time);
    if (idx >= 0)
      stripRef.current?.scrollTo({ x: Math.max(0, idx * CHIP_W - 120), animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, date, slots.length]);

  const submit = async () => {
    if (name.trim().length < 2) return setError('Indiquez le nom du client.');
    if (services.length === 0) return setError('Choisissez au moins une prestation.');
    let clientPhone: string | undefined;
    if (phone.trim()) {
      const parsed = phoneDZ.safeParse(phone);
      if (!parsed.success) return setError('Numéro invalide (ex : 05 51 23 45 67).');
      clientPhone = parsed.data;
    }
    setError(null);
    try {
      // Plusieurs prestations : enchaînées à la suite, même membre.
      let start = localDateTimeToISO(date, time);
      let first: { id: string } | null = null;
      for (const s of chosen) {
        const b = await createWalkIn.mutateAsync({
          serviceId: s!.id,
          staffId: sid,
          startsAt: start,
          clientName: name.trim(),
          clientPhone,
          source: 'walk_in',
        });
        first ??= b;
        start = b.endsAt;
      }
      router.replace((first ? `/pro-rdv/${first.id}` : '/(pro)/(tabs)/agenda') as never);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen
      gap={13}
      footer={
        <BottomSheet>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Tx size={16} weight={700} ls={-0.4} lh={20.5}>
                {formatDA(total)}
              </Tx>
              <P
                numberOfLines={1}
              >{`${relativeDayLabelDZ(date)} · ${time}${chosen.length ? ` · ${chosen.length} prestation${chosen.length > 1 ? 's' : ''} · ${formatDuration(minutes)}` : ' · choisissez une prestation'}`}</P>
            </View>
            <Button
              pill
              onPress={() => void submit()}
              disabled={createWalkIn.isPending}
              loading={createWalkIn.isPending}
              style={{ paddingHorizontal: 23, paddingVertical: 11 }}
            >
              Ajouter
            </Button>
          </View>
        </BottomSheet>
      }
    >
      <TopBar backTo="/(pro)/(tabs)/agenda" right="Nouveau rendez-vous" />
      <H1>Ajouter un rendez-vous</H1>

      {/* 1. QUAND — jours à faire défiler, heure en grand, créneaux du jour en un tap */}
      <Card gap={10}>
        <DayScroller selected={date} onSelect={setDate} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <Tx size={26} weight={700} ls={-0.9} lh={29} mono>
              {time}
            </Tx>
            {minutes > 0 && (
              <Tx size={13} color={C.muted} lh={21} mono>
                → {endTime}
              </Tx>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Tx size={12} weight={600} lh={16}>
              {relativeDayLabelDZ(date)}
            </Tx>
            <Tx size={10.5} color={C.muted} lh={14}>
              {capitalize(formatDateShortDZ(localDateTimeToISO(date, '12:00')))}
            </Tx>
          </View>
        </View>
        {slots.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Heure"
            onPress={() => setTimeSheet(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Tx size={12} color={C.muted} lh={16}>
              Salon fermé ce jour — heure libre
            </Tx>
            <Tx size={12} weight={600} lh={16}>
              Choisir
            </Tx>
          </Pressable>
        ) : (
          <ScrollView
            ref={stripRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
          >
            {slots.map((sl) => {
              const on = sl.t === time;
              return (
                <Pressable
                  key={sl.t}
                  accessibilityRole="button"
                  accessibilityLabel={sl.t}
                  accessibilityState={{ selected: on, disabled: sl.taken }}
                  disabled={sl.taken}
                  onPress={() => setTime(sl.t)}
                  style={{
                    width: CHIP_W - 6,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: on ? C.ink : sl.taken ? 'transparent' : C.ink,
                    backgroundColor: on ? C.ink : sl.taken ? C.fill : C.surface,
                    borderRadius: R.pill,
                    paddingVertical: 8,
                  }}
                >
                  <Tx
                    size={13}
                    weight={600}
                    lh={16}
                    mono
                    color={on ? C.onInk : sl.taken ? C.disabled : C.text}
                    style={sl.taken ? { textDecorationLine: 'line-through' } : undefined}
                  >
                    {sl.t}
                  </Tx>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        {staff.length > 1 && (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
            accessibilityRole="radiogroup"
            accessibilityLabel="Membre"
          >
            {staff.map((m) => {
              const on = m.id === sid;
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setStaffId(m.id)}
                  style={{
                    borderRadius: R.pill,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    backgroundColor: on ? C.ink : C.fill,
                  }}
                >
                  <Tx size={11.5} weight={600} lh={15} color={on ? C.onInk : C.text}>
                    {m.displayName}
                  </Tx>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      {/* 2. Prestations */}
      <Tx size={10.5} color={C.muted} lh={14.5} style={{ marginBottom: -8 }}>
        Prestations
      </Tx>
      <ListCard>
        {active.map((s) => {
          const on = services.includes(s.id);
          return (
            <Row
              key={s.id}
              py={10}
              chevron={false}
              accessibilityLabel={s.name}
              onPress={() =>
                setServices((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
              }
              right={<Checkbox on={on} label={s.name} />}
            >
              <Tx size={13} weight={600} lh={17}>
                {s.name}
              </Tx>
              <Tx size={12} color={C.muted} lh={16}>
                {formatDuration(s.durationMinutes)} · {formatDA(s.priceDa)}
              </Tx>
            </Row>
          );
        })}
      </ListCard>

      {/* 3. Client */}
      <Field label="Client">
        <Input
          lg
          value={name}
          onChangeText={setName}
          placeholder="Mohamed B."
          accessibilityLabel="Client"
        />
      </Field>
      <Field label="Téléphone (facultatif)">
        <Input
          lg
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          placeholder="05 51 23 45 67"
          accessibilityLabel="Téléphone (facultatif)"
        />
      </Field>
      {error && <Alert>{error}</Alert>}
      <TimeSheet
        open={timeSheet}
        onClose={() => setTimeSheet(false)}
        value={time}
        onChange={setTime}
        step={5}
      />
    </Screen>
  );
}
