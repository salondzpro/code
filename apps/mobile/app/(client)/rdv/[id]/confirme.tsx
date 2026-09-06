/** C-F 12 — Rendez-vous confirmé (ou demande envoyée) ; C-F 13 — feuille « Ajouter au calendrier ». */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Check, ChevronRight } from 'lucide-react-native';
import { useBooking } from '@salondz/api-client';
import { formatDA, formatDateShortDZ, formatDZPhone, formatTimeDZ } from '@salondz/constants';
import type { BookingWithSalon } from '@salondz/types';
import { googleCalendarUrl, open } from '@/lib/salon';
import { Avatar, Button, Card, ErrorText, H1, I, IconButton, ModalSheet, P, Row, Rows, StatusBadge, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export function CalendarSheet({ booking, open: isOpen, onClose }: { booking: BookingWithSalon; open: boolean; onClose: () => void }) {
  return (
    <ModalSheet open={isOpen} onClose={onClose}>
      <Tx size={22} weight={600} ls={-0.3} lh={27} center>
        Ajouter au calendrier
      </Tx>
      <Rows>
        <Row
          py={20}
          chevron={false}
          onPress={() => {
            void open(googleCalendarUrl(booking));
            onClose();
          }}
          right={<I icon={ChevronRight} size={18} color={C.disabled} />}
          accessibilityLabel="Google Agenda"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <IconButton lg accessibilityLabel="Google Agenda" onPress={() => void open(googleCalendarUrl(booking))}>
              <I icon={Calendar} size={20} />
            </IconButton>
            <Tx size={19} lh={24}>
              Google Agenda
            </Tx>
          </View>
        </Row>
      </Rows>
      <Button variant="g" onPress={onClose}>
        Plus tard
      </Button>
    </ModalSheet>
  );
}

export default function BookingConfirmed() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = useBooking(id);
  const [cal, setCal] = useState(false);
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
    <Screen center gap={16}>
      <View style={{ alignItems: 'center', gap: 20 }}>
        <View style={{ width: 148, height: 148, borderRadius: 74, backgroundColor: C.okBg, alignItems: 'center', justifyContent: 'center' }}>
          <I icon={Check} size={56} color={C.okFg} />
        </View>
        <H1 size={34} lh={38} ls={-0.8} center>
          {confirmed ? 'Rendez-vous' : 'Demande'}
          {'\n'}
          {confirmed ? 'confirmé' : 'envoyée'}
        </H1>
      </View>
      <Card gap={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <Avatar src={b.salon.coverUrl} name={b.salon.name} size={88} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={22} weight={700} ls={-0.4} lh={27}>
              {b.salon.name}
            </Tx>
            <Tx size={16} color={C.muted} lh={22}>
              {b.salon.city}
              {b.salon.phone ? ` · ${formatDZPhone(b.salon.phone)}` : ''}
            </Tx>
          </View>
        </View>
        <Rows>
          <Row py={16} chevron={false} right={<Tx size={18} weight={600} lh={23}>{b.serviceName}</Tx>}>
            <Tx size={18} color={C.muted} lh={23}>
              Prestation
            </Tx>
          </Row>
          <Row py={16} chevron={false} right={<Tx size={18} weight={600} lh={23}>{formatDateShortDZ(b.startsAt)} · {formatTimeDZ(b.startsAt)}</Tx>}>
            <Tx size={18} color={C.muted} lh={23}>
              Date et heure
            </Tx>
          </Row>
          <Row py={16} chevron={false} right={<Tx size={18} weight={600} lh={23}>{formatDA(b.priceDa)}</Tx>}>
            <Tx size={18} color={C.muted} lh={23}>
              Total
            </Tx>
          </Row>
        </Rows>
        {!confirmed && (
          <View style={{ paddingTop: 12 }}>
            <StatusBadge status={b.status} md />
          </View>
        )}
      </Card>
      <P center>{confirmed ? 'Un rappel vous sera envoyé la veille.' : 'Le salon confirme votre demande sur WhatsApp.'}</P>
      <Button variant="g" onPress={() => setCal(true)}>
        Ajouter au calendrier
      </Button>
      <Button onPress={() => router.replace(`/rdv/${b.id}` as never)}>Voir le rendez-vous</Button>
      <CalendarSheet booking={b} open={cal} onClose={() => setCal(false)} />
    </Screen>
  );
}
