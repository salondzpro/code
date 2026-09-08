/**
 * C-F 15 — Détail du rendez-vous côté pro : client (appeler, WhatsApp), lignes, note, historique,
 * Confirmer / Reporter / Annuler ; Terminé / Absent après l'heure.
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProBooking, useProBookingMutations, useProBookings, useProSalon } from '@salondz/api-client';
import { addDaysToKey, formatDA, formatDateShortDZ, formatDZPhone, formatTimeDZ, toLocalDateKey } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { capitalize, open } from '@/lib/salon';
import { Avatar, BottomSheet, Button, Card, ErrorText, Grid, H1, Input, ModalSheet, P, Row, Rows, Soft, StatusBadge, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function ProBookingDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = useProBooking(id);
  const salon = useProSalon().data?.salon ?? null;
  const { setStatus, cancel } = useProBookingMutations();
  const b = booking.data;
  const today = toLocalDateKey();
  const history = useProBookings({ from: addDaysToKey(today, -365), to: addDaysToKey(today, 90), limit: 200 }, !!b);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const visits = useMemo(() => (history.data?.items ?? []).filter((x) => b && x.status !== 'cancelled' && (x.clientPhone && b.clientPhone ? x.clientPhone === b.clientPhone : x.clientName === b.clientName)), [history.data, b]);
  const lastVisit = visits.filter((x) => x.startsAt < (b?.startsAt ?? '')).sort((a, c) => c.startsAt.localeCompare(a.startsAt))[0];

  if (booking.isPending || !salon) return <Splash />;
  if (booking.isError)
    return (
      <Screen center>
        <ErrorText error={booking.error} retry={() => void booking.refetch()} />
      </Screen>
    );
  if (!b) return null;
  const active = b.status === 'pending' || b.status === 'confirmed';
  const past = new Date(b.startsAt).getTime() < Date.now();
  const wa = b.clientPhone ? `https://wa.me/${b.clientPhone.replace(/\D/g, '')}` : null;
  const initials = b.clientName
    .split(' ')
    .map((p, i) => (i === 0 ? p : `${p.charAt(0)}.`))
    .join(' ');
  const lines = b.items?.length ? b.items : [{ id: b.id, serviceName: b.serviceName }];
  const back = () => router.replace('/(pro)/(tabs)/agenda');

  return (
    <Screen
      gap={13}
      footer={
        <BottomSheet grab={false}>
          {b.status === 'pending' && !past && (
            <Button disabled={setStatus.isPending} onPress={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}>
              Confirmer le rendez-vous
            </Button>
          )}
          {b.status === 'confirmed' && past && (
            <Grid cols={2}>
              <Button disabled={setStatus.isPending} onPress={() => setStatus.mutate({ id: b.id, status: 'completed' })}>
                Terminé
              </Button>
              <Button variant="g" disabled={setStatus.isPending} onPress={() => setStatus.mutate({ id: b.id, status: 'no_show' })}>
                Absent
              </Button>
            </Grid>
          )}
          {active && (
            <Grid cols={2}>
              <Button variant="g" onPress={() => router.push(`/pro-rdv/${b.id}/reporter` as never)}>
                Reporter
              </Button>
              <Button variant="d" onPress={() => setCancelling(true)}>
                Annuler
              </Button>
            </Grid>
          )}
          {!active && (
            <Button variant="g" onPress={back}>
              Retour à l'agenda
            </Button>
          )}
        </BottomSheet>
      }
    >
      <TopBar backTo="/(pro)/(tabs)/agenda" right={<StatusBadge status={b.status} md />} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
        <Avatar name={b.clientName} size={104} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <H1 size={21} lh={24.5} ls={-0.8}>
            {initials}
          </H1>
          {!!b.clientPhone && (
            <Tx size={10.5} color={C.muted} lh={15.5} style={{ marginTop: 3 }}>
              {formatDZPhone(b.clientPhone)}
            </Tx>
          )}
          {b.staff && (
            <Tx size={12} color={C.muted} lh={16}>
              avec {b.staff.displayName}
            </Tx>
          )}
        </View>
      </View>
      {!!b.clientPhone && (
        <Grid cols={2}>
          <Button variant="g" style={{ paddingVertical: 15 }} onPress={() => void open(`tel:${b.clientPhone}`)}>
            <Tx size={11.5} weight={600} ls={-0.2}>
              Appeler
            </Tx>
          </Button>
          {!!wa && (
            <Button variant="g" style={{ paddingVertical: 15 }} onPress={() => void open(wa)}>
              <Tx size={11.5} weight={600} ls={-0.2}>
                WhatsApp
              </Tx>
            </Button>
          )}
        </Grid>
      )}
      <Card gap={0}>
        <Rows>
          {lines.map((it) => (
            <Row key={it.id} py={13} chevron={false} right={<Tx size={11.5} weight={600} lh={15.5}>{it.serviceName}</Tx>}>
              <Tx size={11.5} color={C.muted} lh={15.5}>
                Prestation
              </Tx>
            </Row>
          ))}
          <Row py={13} chevron={false} right={<Tx size={11.5} weight={600} lh={15.5}>{capitalize(formatDateShortDZ(b.startsAt))}</Tx>}>
            <Tx size={11.5} color={C.muted} lh={15.5}>
              Date
            </Tx>
          </Row>
          <Row py={13} chevron={false} right={<Tx size={11.5} weight={600} lh={15.5} mono>{formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)}</Tx>}>
            <Tx size={11.5} color={C.muted} lh={15.5}>
              Heure
            </Tx>
          </Row>
          <Row py={13} chevron={false} right={<Tx size={11.5} weight={600} lh={15.5}>{formatDuration(b.durationMinutes)}</Tx>}>
            <Tx size={11.5} color={C.muted} lh={15.5}>
              Durée
            </Tx>
          </Row>
          <Row py={13} chevron={false} right={<Tx size={11.5} weight={600} lh={15.5}>{formatDA(b.priceDa)}</Tx>}>
            <Tx size={11.5} color={C.muted} lh={15.5}>
              Prix
            </Tx>
          </Row>
        </Rows>
      </Card>
      {!!b.notes && (
        <Soft>
          <Tx size={10.5} color={C.muted} lh={14.5}>
            Note {salon.genderTarget === 'men' ? 'du client' : 'de la cliente'}
          </Tx>
          <Tx size={12} lh={17}>
            « {b.notes} »
          </Tx>
        </Soft>
      )}
      {!!b.cancellationReason && (
        <Tx size={12} color={C.danger} lh={16}>
          Motif : {b.cancellationReason}
        </Tx>
      )}
      <Tx size={10.5} color={C.muted} lh={14.5}>
        {visits.length} rendez-vous{lastVisit ? ` · dernière visite le ${formatDateShortDZ(lastVisit.startsAt)}` : ''}
      </Tx>
      <ErrorText error={setStatus.error ?? cancel.error} />

      <ModalSheet open={cancelling} onClose={() => setCancelling(false)}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Tx size={16} weight={700} ls={-0.4} lh={20.5} center>
            Annuler ce rendez-vous ?
          </Tx>
          <P center>Le client sera prévenu sur WhatsApp et le créneau sera libéré.</P>
        </View>
        <Card row style={{ paddingVertical: 10, justifyContent: 'space-between' }}>
          <Tx size={12} lh={16}>
            Motif (optionnel)
          </Tx>
          <Input value={reason} onChangeText={setReason} placeholder="Indisponible" maxLength={200} accessibilityLabel="Motif" style={{ flex: 1, backgroundColor: 'transparent', borderColor: 'transparent', paddingVertical: 0, paddingHorizontal: 0, textAlign: 'right', fontSize: 12 }} />
        </Card>
        <Button
          bg={C.danger}
          textColor="#fff"
          disabled={cancel.isPending}
          loading={cancel.isPending}
          onPress={async () => {
            await cancel.mutateAsync({ id: b.id, reason: reason.trim() || undefined });
            setCancelling(false);
          }}
        >
          Annuler le rendez-vous
        </Button>
        <Button variant="g" onPress={() => setCancelling(false)}>
          Garder le rendez-vous
        </Button>
      </ModalSheet>
    </Screen>
  );
}
