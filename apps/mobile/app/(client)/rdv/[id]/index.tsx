/**
 * Détail d'un rendez-vous côté client (structure de C-F 15) : salon, contact, puis l'essentiel en grand
 * (Aujourd'hui / Demain / date, heure, prix) et la liste des prestations — même lecture que la fiche pro.
 * Reporter / Annuler. C-F 17 — feuille « Annuler ce rendez-vous ? » (avec la règle anti-abus) ; C-F 18 — annulation confirmée.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBooking, useCancelBooking, useMe } from '@salondz/api-client';
import { CANCEL_ABUSE_BLOCK_DAYS, CANCEL_ABUSE_MAX, CANCEL_ABUSE_WINDOW_DAYS, CLIENT_CANCEL_MIN_HOURS, formatDA, formatDateLongDZ, formatDZPhone, formatTimeDZ, relativeDayLabelDZ, toLocalDateKey } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { capitalize, directionsUrl, open } from '@/lib/salon';
import { Avatar, Button, Card, ErrorText, Grid, H1, InfoBox, Input, ModalSheet, P, Row, Rows, Soft, StatusBadge, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { LateRule } from '@/ui/LateRule';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';
import { CalendarSheet } from './confirme';

export default function BookingDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = useBooking(id);
  const cancel = useCancelBooking();
  const me = useMe();
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
  const lines = b.items?.length ? b.items : [{ id: b.id, serviceName: b.serviceName, durationMinutes: b.durationMinutes, priceDa: b.priceDa }];
  const cancels = me.data?.standing?.cancellations ?? 0;

  if (done) {
    // C-F 18 — Annulation confirmée
    return (
      <Screen center gap={13}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <H1 size={23} lh={26} ls={-0.8} center>
            Rendez-vous annulé
          </H1>
          <P center>{b.salon.name} a été prévenu sur WhatsApp. Aucun frais ne vous est appliqué.</P>
        </View>
        <Card gap={0}>
          <Rows>
            <Row py={13} chevron={false} right={<Tx size={11.5} color={C.muted} lh={15.5}>{formatDA(b.priceDa)}</Tx>}>
              <Tx size={11.5} lh={15.5}>
                {b.serviceName}
              </Tx>
            </Row>
            <Row py={13} chevron={false} right={<Tx size={11.5} color={C.muted} lh={15.5}>{formatTimeDZ(b.startsAt)} · annulé</Tx>}>
              <Tx size={11.5} lh={15.5}>
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
    <Screen gap={13}>
      <TopBar backTo="/(client)/(tabs)/rendez-vous" right={<StatusBadge status={b.status} md cancelledBy={b.cancelledBy} kind={b.cancellationKind} />} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
        <Avatar src={b.salon.coverUrl} name={b.salon.name} size={104} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <H1 size={21} lh={24.5} ls={-0.8}>
            {b.salon.name}
          </H1>
          {!!b.salon.phone && (
            <Tx size={10.5} color={C.muted} lh={15.5} style={{ marginTop: 3 }}>
              {formatDZPhone(b.salon.phone)}
            </Tx>
          )}
        </View>
      </View>
      {(!!b.salon.phone || !!wa) && (
        <Grid cols={2}>
          {!!b.salon.phone && (
            <Button variant="g" style={{ paddingVertical: 15 }} onPress={() => void open(`tel:${b.salon.phone}`)}>
              <Tx size={11.5} weight={600} ls={-0.2}>
                Appeler
              </Tx>
            </Button>
          )}
          {!!wa && (
            <Button variant="g" style={{ paddingVertical: 15 }} onPress={() => void open(wa)}>
              <Tx size={11.5} weight={600} ls={-0.2}>
                WhatsApp
              </Tx>
            </Button>
          )}
        </Grid>
      )}
      {/* L'essentiel en grand : quand, à quelle heure, combien — rassurant et lisible d'un coup d'œil. */}
      <Card gap={10}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Tx size={13} weight={700} lh={17}>
            {relativeDayLabelDZ(toLocalDateKey(new Date(b.startsAt)))}
          </Tx>
          <Tx size={11} color={C.muted} lh={15}>
            {capitalize(formatDateLongDZ(b.startsAt))}
          </Tx>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <Tx size={26} weight={700} ls={-0.9} lh={29} mono>
              {formatTimeDZ(b.startsAt)}
            </Tx>
            <Tx size={13} color={C.muted} lh={21} mono>
              – {formatTimeDZ(b.endsAt)}
            </Tx>
          </View>
          <Tx size={19.5} weight={700} ls={-0.6} lh={23.5}>
            {formatDA(b.priceDa)}
          </Tx>
        </View>
        <Tx size={10.5} color={C.muted} lh={14}>
          {formatDuration(b.durationMinutes)} au total · paiement sur place
        </Tx>
      </Card>
      {active && <LateRule startsAt={b.startsAt} />}
      <Card gap={0}>
        <Rows>
          <Row py={10} chevron={false} right={<Tx size={11.5} color={C.muted} lh={15.5}>{formatDA(b.priceDa)}</Tx>}>
            <Tx size={13} weight={700} lh={17}>
              {lines.length} prestation{lines.length > 1 ? 's' : ''}
            </Tx>
          </Row>
          {lines.map((it) => (
            <Row key={it.id} py={10} chevron={false} right={<Tx size={11} color={C.muted} lh={15}>{it.durationMinutes ? `${formatDuration(it.durationMinutes)} · ${formatDA(it.priceDa)}` : formatDA(it.priceDa)}</Tx>}>
              <Tx size={13} weight={600} lh={17}>
                {it.serviceName}
              </Tx>
            </Row>
          ))}
        </Rows>
      </Card>
      {!!b.notes && (
        <Soft>
          <Tx size={10.5} color={C.muted} lh={14.5}>
            Votre note
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
      <View style={{ gap: 8 }}>
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
          <Tx size={11.5} color={C.muted} lh={16} center>
            Report et annulation en ligne possibles jusqu'à {minHours} h avant. Contactez le salon.
          </Tx>
        )}
        {b.status === 'completed' && b.reviewRating == null && <Button onPress={() => router.push(`/rdv/${b.id}/noter` as never)}>Noter la prestation</Button>}
        {b.status === 'completed' && b.reviewRating != null && <InfoBox>{`Merci ! Vous avez noté ce rendez-vous ${b.reviewRating}/5. Votre avis est visible sur la page du salon.`}</InfoBox>}
      </View>

      <CalendarSheet booking={b} open={cal} onClose={() => setCal(false)} />

      <ModalSheet open={cancelling} onClose={() => setCancelling(false)}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Tx size={16} weight={700} ls={-0.4} lh={20.5} center>
            Annuler ce rendez-vous ?
          </Tx>
          <P center>Annulation gratuite — il reste {hoursLeft} h avant le rendez-vous. Le créneau sera libéré immédiatement.</P>
        </View>
        <InfoBox>
          {cancels >= CANCEL_ABUSE_MAX - 1
            ? `Attention : ce serait votre ${cancels + 1}ᵉ annulation en ${CANCEL_ABUSE_WINDOW_DAYS} jours. Au-delà de ${CANCEL_ABUSE_MAX}, la réservation en ligne est suspendue ${CANCEL_ABUSE_BLOCK_DAYS} jours.`
            : `Pour respecter le travail des salons, au-delà de ${CANCEL_ABUSE_MAX} annulations en ${CANCEL_ABUSE_WINDOW_DAYS} jours la réservation en ligne est suspendue ${CANCEL_ABUSE_BLOCK_DAYS} jours.`}
        </InfoBox>
        <Card row style={{ paddingVertical: 10, justifyContent: 'space-between' }}>
          <Tx size={12} lh={16}>
            Motif (optionnel)
          </Tx>
          <Input value={reason} onChangeText={setReason} placeholder="Empêchement" maxLength={200} accessibilityLabel="Motif" style={{ flex: 1, backgroundColor: 'transparent', borderColor: 'transparent', paddingVertical: 0, paddingHorizontal: 0, textAlign: 'right', fontSize: 12 }} />
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
