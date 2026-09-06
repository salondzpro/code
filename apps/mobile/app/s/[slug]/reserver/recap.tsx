/** C-F 11 — Récapitulatif : salon, lignes de prestations, date → heure de fin, total, conditions, « Confirmer la réservation ». */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, useCreateBooking, useSalon, useUpdateProfile } from '@salondz/api-client';
import { CLIENT_CANCEL_MIN_HOURS, formatDA, formatDateLongDZ, formatTimeDZ, minutesToTime, timeToMinutes, wilayaName } from '@salondz/constants';
import { clearDraft, readDraft } from '@/lib/bookingDraft';
import { formatDuration } from '@/lib/format';
import { publicHost } from '@/lib/salon';
import { Avatar, BottomSheet, Button, Card, ErrorText, H1, InfoBox, P, Row, Rows, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function BookingReview() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const salon = useSalon(slug);
  const create = useCreateBooking();
  const updateProfile = useUpdateProfile();
  // Instantané du brouillon : la création invalide des requêtes (re-rendu) avant la navigation.
  const [draft] = useState(() => readDraft(slug));
  const [slotError, setSlotError] = useState<string | null>(null);

  if (!draft.startsAt || !draft.name || draft.serviceIds.length === 0) return <Redirect href={`/s/${slug}/prestations` as never} />;
  if (salon.isPending) return <Splash />;
  const s = salon.data;
  if (!s) return null;
  const chosen = draft.serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean);
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);
  const start = formatTimeDZ(draft.startsAt);
  const end = minutesToTime(timeToMinutes(start) + minutes);

  const confirm = async () => {
    setSlotError(null);
    try {
      const b = await create.mutateAsync({
        salonId: s.id,
        serviceIds: draft.serviceIds,
        staffId: null,
        startsAt: draft.startsAt!,
        notes: draft.notes || undefined,
        clientName: draft.name,
        clientPhone: draft.phone,
      });
      if (draft.whatsapp !== undefined) updateProfile.mutate({ whatsappReminders: draft.whatsapp });
      router.replace(`/rdv/${b.id}/confirme` as never);
      clearDraft(slug);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'SLOT_TAKEN' || err.code === 'TOO_SOON' || err.code === 'OUTSIDE_OPENING_HOURS')) {
        setSlotError("Ce créneau vient d'être pris. Choisissez-en un autre.");
      }
    }
  };

  return (
    <Screen
      gap={16}
      footer={
        <BottomSheet>
          <Button onPress={() => void confirm()} disabled={create.isPending} loading={create.isPending}>
            Confirmer la réservation
          </Button>
        </BottomSheet>
      }
    >
      <TopBar backTo={`/s/${slug}/reserver/coordonnees`} right="Étape 4 sur 4" />
      <H1>Récapitulatif</H1>
      <Card gap={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={72} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={22} weight={700} ls={-0.4} lh={27}>
              {s.name}
            </Tx>
            <Tx size={16} color={C.muted} lh={22} numberOfLines={1}>
              {s.zone ?? s.city}, {wilayaName(s.wilayaCode)} · {publicHost()}/s/{s.slug}
            </Tx>
          </View>
        </View>
        <Rows>
          {chosen.map((sv) => (
            <Row key={sv!.id} py={16} chevron={false} right={<Tx size={18} color={C.muted} lh={23}>{formatDuration(sv!.durationMinutes)} · {formatDA(sv!.priceDa)}</Tx>}>
              <Tx size={18} lh={23}>
                {sv!.name}
              </Tx>
            </Row>
          ))}
          <Row py={16} chevron={false} right={<Tx size={18} color={C.muted} lh={23} mono>{start} → {end}</Tx>}>
            <Tx size={18} lh={23}>
              {formatDateLongDZ(draft.startsAt)}
            </Tx>
          </Row>
        </Rows>
      </Card>
      <Card gap={4}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Tx size={22} weight={600} lh={27}>
            Total
          </Tx>
          <Tx size={24} weight={700} lh={29}>
            {formatDA(price)}
          </Tx>
        </View>
        <P>{s.depositRequired ? 'Acompte demandé sur place · confirmé par le salon' : 'Paiement sur place · aucun acompte demandé'}</P>
      </Card>
      <InfoBox>Annulation gratuite jusqu'à {s.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS} h avant. Confirmation par WhatsApp.</InfoBox>
      {slotError && (
        <View style={{ gap: 12 }}>
          <ErrorText error={new Error(slotError)} />
          <Button variant="g" onPress={() => router.replace(`/s/${slug}/reserver/quand` as never)}>
            Choisir un autre créneau
          </Button>
        </View>
      )}
      {!slotError && <ErrorText error={create.error} />}
    </Screen>
  );
}
