/**
 * Détail d'un rendez-vous côté client (structure de C-F 15) : salon, contact, lignes, note,
 * Reporter / Annuler. C-F 17 — feuille « Annuler ce rendez-vous ? » ; C-F 18 — annulation confirmée.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBooking, useCancelBooking } from '@salondz/api-client';
import { CLIENT_CANCEL_MIN_HOURS, formatDA, formatDateLongDZ, formatDateShortDZ, formatDZPhone, formatTimeDZ } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { capitalize, directionsUrl, open } from '@/lib/salon';
import { Avatar, Button, Card, ErrorText, Grid, H1, Input, ModalSheet, P, Row, Rows, Soft, StatusBadge, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';
import { CalendarSheet } from './confirme';

export default function BookingDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = useBooking(id);
  const cancel = useCancelBooking();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [cal, setCal] = useState(false);
  const [done, setDone] = useState(false);

  if (booking.isPending) return <Splash />;
  if (booking.isError)
    return (
      <Screen center>
        <ErrorText error={booking.error} retry={() => void booking.refetch()} />
      </Screen>
    );
  const b = booking.data;
  const active = b.status === 'pending' || b.status === 'confirmed';
  const hoursLeft = Math.floor((new Date(b.startsAt).getTime() - Date.now()) / 3_600_000);
  // Règles du salon (même source que l'API) : délai d'annulation, report client autorisé.
  const minHours = b.salon.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS;
  const canModify = active && hoursLeft >= minHours;
  const canReschedule = canModify && b.salon.allowClientReschedule !== false;
  const wa = b.salon.phone ? `https://wa.me/${b.salon.phone.replace(/\D/g, '')}` : null;
  const lines = b.items?.length ? b.items : [{ id: b.id, serviceName: b.serviceName }];

  if (done) {
    // C-F 18 — Annulation confirmée
    return (
      <Screen center gap={16}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <H1 size={32} lh={36} ls={-0.8} center>
            Rendez-vous annulé
          </H1>
          <P center>{b.salon.name} a été prévenu sur WhatsApp. Aucun frais ne vous est appliqué.</P>
        </View>
        <Card gap={0}>
          <Rows>
            <Row py={16} chevron={false} right={<Tx size={18} color={C.muted} lh={23}>{formatDA(b.priceDa)}</Tx>}>
              <Tx size={18} lh={23}>
                {b.serviceName}
              </Tx>
            </Row>
            <Row py={16} chevron={false} right={<Tx size={18} color={C.muted} lh={23}>{formatTimeDZ(b.startsAt)} · annulé</Tx>}>
              <Tx size={18} lh={23}>
                {formatDateLongDZ(b.startsAt)}
              </Tx>
            </Row>
          </Rows>
        </Card>
        <Button onPress={() => router.replace(`/s/${b.salon.slug}/prestations` as never)}>Réserver un autre créneau</Button>
        <Button variant="g" onPress={() => router.replace('/(client)/(tabs)/rendez-vous')}>
          Retour à mes rendez-vous
        </Button>
      </Screen>
    );
  }

  return (
    <Screen gap={16}>
      <TopBar backTo="/(client)/(tabs)/rendez-vous" right={<StatusBadge status={b.status} md />} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Avatar src={b.salon.coverUrl} name={b.salon.name} size={128} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <H1 size={30} lh={34} ls={-0.8}>
            {b.salon.name}
          </H1>
          {!!b.salon.phone && (
            <Tx size={17} color={C.muted} lh={23} style={{ marginTop: 4 }}>
              {formatDZPhone(b.salon.phone)}
            </Tx>
          )}
        </View>
      </View>
      {(!!b.salon.phone || !!wa) && (
        <Grid cols={2}>
          {!!b.salon.phone && (
            <Button variant="g" style={{ paddingVertical: 18 }} onPress={() => void open(`tel:${b.salon.phone}`)}>
              <Tx size={18} weight={600} ls={-0.2}>
                Appeler
              </Tx>
            </Button>
          )}
          {!!wa && (
            <Button variant="g" style={{ paddingVertical: 18 }} onPress={() => void open(wa)}>
              <Tx size={18} weight={600} ls={-0.2}>
                WhatsApp
              </Tx>
            </Button>
          )}
        </Grid>
      )}
      <Card gap={0}>
        <Rows>
          {lines.map((it) => (
            <Row key={it.id} py={16} chevron={false} right={<Tx size={18} weight={600} lh={23}>{it.serviceName}</Tx>}>
              <Tx size={18} color={C.muted} lh={23}>
                Prestation
              </Tx>
            </Row>
          ))}
          <Row py={16} chevron={false} right={<Tx size={18} weight={600} lh={23}>{capitalize(formatDateShortDZ(b.startsAt))}</Tx>}>
            <Tx size={18} color={C.muted} lh={23}>
              Date
            </Tx>
          </Row>
          <Row py={16} chevron={false} right={<Tx size={18} weight={600} lh={23} mono>{formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)}</Tx>}>
            <Tx size={18} color={C.muted} lh={23}>
              Heure
            </Tx>
          </Row>
          <Row py={16} chevron={false} right={<Tx size={18} weight={600} lh={23}>{formatDuration(b.durationMinutes)}</Tx>}>
            <Tx size={18} color={C.muted} lh={23}>
              Durée
            </Tx>
          </Row>
          <Row py={16} chevron={false} right={<Tx size={18} weight={600} lh={23}>{formatDA(b.priceDa)}</Tx>}>
            <Tx size={18} color={C.muted} lh={23}>
              Prix
            </Tx>
          </Row>
        </Rows>
      </Card>
      {!!b.notes && (
        <Soft>
          <Tx size={13} color={C.muted} lh={18}>
            Votre note
          </Tx>
          <Tx size={19} lh={25}>
            « {b.notes} »
          </Tx>
        </Soft>
      )}
      {!!b.cancellationReason && (
        <Tx size={15} color={C.danger} lh={20}>
          Motif : {b.cancellationReason}
        </Tx>
      )}
      <View style={{ gap: 10 }}>
        {active && (
          <Button variant="g" onPress={() => void open(directionsUrl(b))}>
            Itinéraire
          </Button>
        )}
        {active && (
          <Button variant="g" onPress={() => setCal(true)}>
            Ajouter au calendrier
          </Button>
        )}
        {canReschedule && (
          <Grid cols={2}>
            <Button variant="g" onPress={() => router.push(`/rdv/${b.id}/reporter` as never)}>
              Reporter
            </Button>
            <Button variant="d" onPress={() => setCancelling(true)}>
              Annuler
            </Button>
          </Grid>
        )}
        {canModify && !canReschedule && (
          <Button variant="d" onPress={() => setCancelling(true)}>
            Annuler
          </Button>
        )}
        {active && !canModify && (
          <Tx size={14} color={C.muted} lh={20} center>
            Report et annulation en ligne possibles jusqu'à {minHours} h avant. Contactez le salon.
          </Tx>
        )}
        {b.status === 'completed' && <Button onPress={() => router.push(`/rdv/${b.id}/noter` as never)}>Noter la prestation</Button>}
      </View>

      <CalendarSheet booking={b} open={cal} onClose={() => setCal(false)} />

      <ModalSheet open={cancelling} onClose={() => setCancelling(false)}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Tx size={24} weight={700} ls={-0.4} lh={29} center>
            Annuler ce rendez-vous ?
          </Tx>
          <P center>Annulation gratuite — il reste {hoursLeft} h avant le rendez-vous. Le créneau sera libéré immédiatement.</P>
        </View>
        <Card row style={{ paddingVertical: 12, justifyContent: 'space-between' }}>
          <Tx size={19} lh={24}>
            Motif (optionnel)
          </Tx>
          <Input value={reason} onChangeText={setReason} placeholder="Empêchement" maxLength={200} accessibilityLabel="Motif" style={{ flex: 1, backgroundColor: 'transparent', borderColor: 'transparent', paddingVertical: 0, paddingHorizontal: 0, textAlign: 'right', fontSize: 17 }} />
        </Card>
        <ErrorText error={cancel.error} />
        <Button
          bg={C.danger}
          textColor="#fff"
          disabled={cancel.isPending}
          loading={cancel.isPending}
          onPress={async () => {
            await cancel.mutateAsync({ id: b.id, reason: reason.trim() || undefined });
            setCancelling(false);
            setDone(true);
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
