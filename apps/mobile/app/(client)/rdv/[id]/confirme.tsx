/** C-F 12 — Rendez-vous confirmé (ou demande envoyée) ; C-F 13 — feuille « Ajouter au calendrier ». */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Check } from 'lucide-react-native';
import { useBooking } from '@salondz/api-client';
import { formatDA, formatDateShortDZ, formatDZPhone, formatTimeDZ } from '@salondz/constants';
import type { BookingWithSalon } from '@salondz/types';
import { api } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/push';
import { googleCalendarUrl, open } from '@/lib/salon';
import { Avatar, Button, Card, ErrorText, H1, I, P, Row, Rows, StatusBadge, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { LateRule } from '@/ui/LateRule';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

/** Bouton commun (confirmation + détails) : tout en bas, avec icône — lien direct Google Agenda, sans feuille ni .ics. */
export function GoogleCalendarButton({ booking }: { booking: BookingWithSalon }) {
  return (
    <Button variant="g" onPress={() => void open(googleCalendarUrl(booking))}>
      <I icon={Calendar} size={16} />
      <Tx size={12} weight={600} lh={16}>
        Ajouter à votre calendrier Google
      </Tx>
    </Button>
  );
}

export default function BookingConfirmed() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = useBooking(id);
  // Moment contextuel pour la permission push : « Un rappel vous sera envoyé la veille ».
  useEffect(() => {
    registerForPushNotifications(api).catch((err) => console.warn('[push]', err));
  }, []);
  if (booking.isPending) return <Splash />;
  if (booking.isError)
    return (
      <Screen center>
        <ErrorText error={booking.error} retry={() => void booking.refetch()} />
      </Screen>
    );
  const b = booking.data;
  const confirmed = b.status === 'confirmed';

  return (
    <Screen center gap={13}>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: C.okBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <I icon={Check} size={45.5} color={C.okFg} />
        </View>
        <H1 size={23} lh={26} ls={-0.8} center>
          {confirmed ? 'Rendez-vous' : 'Demande'}
          {'\n'}
          {confirmed ? 'confirmé' : 'envoyée'}
        </H1>
      </View>
      <Card gap={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 6 }}>
          <Avatar src={b.salon.coverUrl} name={b.salon.name} size={71.5} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={14.5} weight={700} ls={-0.4} lh={18.5}>
              {b.salon.name}
            </Tx>
            <Tx size={10.5} color={C.muted} lh={15.5}>
              {b.salon.city}
              {b.salon.phone ? ` · ${formatDZPhone(b.salon.phone)}` : ''}
            </Tx>
          </View>
        </View>
        <Rows>
          <Row
            py={13}
            chevron={false}
            right={
              <Tx size={11.5} weight={600} lh={15.5}>
                {b.serviceName}
              </Tx>
            }
          >
            <Tx size={11.5} color={C.muted} lh={15.5}>
              Prestation
            </Tx>
          </Row>
          <Row
            py={13}
            chevron={false}
            right={
              <Tx size={11.5} weight={600} lh={15.5}>
                {formatDateShortDZ(b.startsAt)} · {formatTimeDZ(b.startsAt)}
              </Tx>
            }
          >
            <Tx size={11.5} color={C.muted} lh={15.5}>
              Date et heure
            </Tx>
          </Row>
          <Row
            py={13}
            chevron={false}
            right={
              <Tx size={11.5} weight={600} lh={15.5}>
                {formatDA(b.priceDa)}
              </Tx>
            }
          >
            <Tx size={11.5} color={C.muted} lh={15.5}>
              Total
            </Tx>
          </Row>
        </Rows>
        {!confirmed && (
          <View style={{ paddingTop: 10 }}>
            <StatusBadge status={b.status} md />
          </View>
        )}
      </Card>
      <LateRule startsAt={b.startsAt} />
      <P center>
        {confirmed
          ? 'Un rappel vous sera envoyé la veille.'
          : 'Le salon confirme votre demande sur WhatsApp.'}
      </P>
      <Button onPress={() => router.replace(`/rdv/${b.id}` as never)}>Voir le rendez-vous</Button>
      <GoogleCalendarButton booking={b} />
    </Screen>
  );
}
