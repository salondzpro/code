/** Espace pro — Nouveau rendez-vous (client de passage ou téléphone) : client, prestations, date, heure, membre. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProBookingMutations, useProSalon } from '@salondz/api-client';
import { formatDA, formatDateShortDZ, localDateTimeToISO, toLocalDateKey } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { errorText } from '@/lib/errors';
import { formatDuration } from '@/lib/format';
import { Alert, BottomSheet, Button, Checkbox, Field, H1, Input, ListCard, P, Row, TopBar, Tx } from '@/ui';
import { DateSheet, PickerSheet, TimeSheet, ValueRow } from '@/ui/Pickers';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function ProBookingNew() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const salon = useProSalon().data?.salon ?? null;
  const { createWalkIn } = useProBookingMutations();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [date, setDate] = useState(params.date ?? toLocalDateKey());
  const [time, setTime] = useState('10:00');
  const [staffId, setStaffId] = useState<string>('');
  const [sheet, setSheet] = useState<'date' | 'time' | 'staff' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const active = salon.services.filter((s) => s.isActive);
  const staff = salon.staff.filter((s) => s.isActive);
  const chosen = services.map((id) => active.find((s) => s.id === id)).filter(Boolean);
  const total = chosen.reduce((a, s) => a + (s?.priceDa ?? 0), 0);
  const minutes = chosen.reduce((a, s) => a + (s?.durationMinutes ?? 0), 0);
  const sid = staffId || staff[0]?.id || '';

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
        const b = await createWalkIn.mutateAsync({ serviceId: s!.id, staffId: sid, startsAt: start, clientName: name.trim(), clientPhone, source: 'walk_in' });
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
      gap={16}
      footer={
        <BottomSheet>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Tx size={24} weight={700} ls={-0.4} lh={29}>
                {formatDA(total)}
              </Tx>
              <P>{chosen.length ? `${chosen.length} prestation${chosen.length > 1 ? 's' : ''} · ${formatDuration(minutes)}` : 'Choisissez une prestation'}</P>
            </View>
            <Button pill onPress={() => void submit()} disabled={createWalkIn.isPending} loading={createWalkIn.isPending} style={{ paddingHorizontal: 28, paddingVertical: 14 }}>
              Ajouter
            </Button>
          </View>
        </BottomSheet>
      }
    >
      <TopBar backTo="/(pro)/(tabs)/agenda" right="Nouveau rendez-vous" />
      <H1>Ajouter un rendez-vous</H1>
      <Field label="Client">
        <Input lg value={name} onChangeText={setName} placeholder="Mohamed B." autoFocus accessibilityLabel="Client" />
      </Field>
      <Field label="Téléphone (facultatif)">
        <Input lg keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="05 51 23 45 67" accessibilityLabel="Téléphone (facultatif)" />
      </Field>
      <Tx size={13} color={C.muted} lh={18} style={{ marginBottom: -10 }}>
        Prestations
      </Tx>
      <ListCard>
        {active.map((s) => {
          const on = services.includes(s.id);
          return (
            <Row key={s.id} py={12} chevron={false} accessibilityLabel={s.name} onPress={() => setServices((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))} right={<Checkbox on={on} label={s.name} />}>
              <Tx size={19} weight={600} lh={24}>
                {s.name}
              </Tx>
              <Tx size={15} color={C.muted} lh={20}>
                {formatDuration(s.durationMinutes)} · {formatDA(s.priceDa)}
              </Tx>
            </Row>
          );
        })}
      </ListCard>
      <ListCard>
        <ValueRow label="Date" value={formatDateShortDZ(localDateTimeToISO(date, '12:00'))} onPress={() => setSheet('date')} muted={false} />
        <ValueRow label="Heure" value={time} onPress={() => setSheet('time')} muted={false} />
        {staff.length > 1 && <ValueRow label="Membre" value={staff.find((m) => m.id === sid)?.displayName ?? '—'} onPress={() => setSheet('staff')} muted={false} />}
      </ListCard>
      {error && <Alert>{error}</Alert>}
      <DateSheet open={sheet === 'date'} onClose={() => setSheet(null)} value={date} onChange={setDate} minDate={toLocalDateKey()} />
      <TimeSheet open={sheet === 'time'} onClose={() => setSheet(null)} value={time} onChange={setTime} step={5} />
      <PickerSheet open={sheet === 'staff'} onClose={() => setSheet(null)} title="Membre" options={staff.map((m) => ({ value: m.id, label: m.displayName }))} value={sid} onChange={setStaffId} />
    </Screen>
  );
}
