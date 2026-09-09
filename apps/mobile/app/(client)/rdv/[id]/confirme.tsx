/** C-F 12 — Rendez-vous confirmé (ou demande envoyée) ; C-F 13 — feuille « Ajouter au calendrier ». */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, CalendarCheck, Check } from 'lucide-react-native';
import { useBooking } from '@salondz/api-client';
import {
  formatDA,
  formatDateLongDZ,
  formatDZPhone,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
} from '@salondz/constants';
import type { BookingWithSalon } from '@salondz/types';
import { api } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/push';
import { capitalize, googleCalendarUrl, open } from '@/lib/salon';
import { Avatar, Button, Card, ErrorText, H1, I, P, Row, Rows, StatusBadge, Tx } from '@/ui';
import { formatDuration } from '@/lib/format';
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
  const lines = b.items?.length
    ? b.items
    : [
        {
          id: b.id,
          serviceName: b.serviceName,
          durationMinutes: b.durationMinutes,
          priceDa: b.priceDa,
        },
      ];

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
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Avatar src={b.salon.logoUrl ?? b.salon.coverUrl} name={b.salon.name} size={71.5} />
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
      </Card>
      {/* L'essentiel en grand : quand, à quelle heure, combien — même lecture que la fiche de rendez-vous. */}
      <Card gap={10}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Tx size={13} weight={700} lh={17}>
            {relativeDayLabelDZ(toLocalDateKey(new Date(b.startsAt)))}
          </Tx>
          <StatusBadge status={b.status} lg />
        </View>
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
          {`${capitalize(formatDateLongDZ(b.startsAt))} · ${formatDuration(b.durationMinutes)} au total · paiement sur place`}
        </Tx>
      </Card>
      <Card gap={0}>
        <Rows>
          <Row
            py={10}
            chevron={false}
            right={
              <Tx size={11.5} color={C.muted} lh={15.5}>
                {formatDA(b.priceDa)}
              </Tx>
            }
          >
            <Tx size={13} weight={700} lh={17}>
              {lines.length} prestation{lines.length > 1 ? 's' : ''}
            </Tx>
          </Row>
          {lines.map((it) => (
            <Row
              key={it.id}
              py={10}
              chevron={false}
              right={
                <Tx size={11} color={C.muted} lh={15}>
                  {it.durationMinutes
                    ? `${formatDuration(it.durationMinutes)} · ${formatDA(it.priceDa)}`
                    : formatDA(it.priceDa)}
                </Tx>
              }
            >
              <Tx size={13} weight={600} lh={17}>
                {it.serviceName}
              </Tx>
            </Row>
          ))}
        </Rows>
      </Card>
      <LateRule startsAt={b.startsAt} />
      <P center>
        {confirmed
          ? 'Un rappel vous sera envoyé la veille.'
          : 'Le salon confirme votre demande sur WhatsApp.'}
      </P>
      <Button onPress={() => router.replace(`/rdv/${b.id}` as never)}>
        <I icon={CalendarCheck} size={15} color={C.onInk} />
        <Tx size={12} weight={600} lh={16} color={C.onInk}>
          Voir le rendez-vous
        </Tx>
      </Button>
      <GoogleCalendarButton booking={b} />
    </Screen>
  );
}
