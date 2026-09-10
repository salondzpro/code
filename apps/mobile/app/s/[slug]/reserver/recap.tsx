/**
 * C-F 11 — Récapitulatif, lu en trois secondes : quand (jour, heure → fin) et combien en grand, puis les
 * prestations, le salon, « Bon à savoir » (retard, annulation), « Confirmer la réservation ».
 * Blocage par le salon ou suspension anti-abus : dit tout en haut, bouton grisé — jamais découvert après un clic.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ban, CalendarCheck, Phone } from 'lucide-react-native';
import {
  ApiError,
  useBookingStanding,
  useCreateBooking,
  useSalon,
  useUpdateProfile,
} from '@salondz/api-client';
import {
  ARRIVAL_ADVANCE_MINUTES,
  CLIENT_CANCEL_MIN_HOURS,
  LATE_TOLERANCE_MINUTES,
  formatDA,
  formatDateLongDZ,
  formatTimeDZ,
  lateRule,
  minutesToTime,
  relativeDayLabelDZ,
  timeToMinutes,
  toLocalDateKey,
  wilayaName,
} from '@salondz/constants';
import { clearDraft, readDraft } from '@/lib/bookingDraft';
import { formatDuration } from '@/lib/format';
import { capitalize, open } from '@/lib/salon';
import { Avatar, BottomSheet, Button, Card, ErrorText, H1, I, Row, Rows, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function BookingReview() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const salon = useSalon(slug);
  const create = useCreateBooking();
  const updateProfile = useUpdateProfile();
  const standing = useBookingStanding(salon.data?.id ?? '');
  // Instantané du brouillon : la création invalide des requêtes (re-rendu) avant la navigation.
  const [draft] = useState(() => readDraft(slug));
  const [slotError, setSlotError] = useState<string | null>(null);

  if (!draft.startsAt || !draft.name || draft.serviceIds.length === 0)
    return <Redirect href={`/s/${slug}` as never} />;
  if (salon.isPending) return <Splash />;
  const s = salon.data;
  if (!s) return null;
  const chosen = draft.serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean);
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);
  const start = formatTimeDZ(draft.startsAt);
  const end = minutesToTime(timeToMinutes(start) + minutes);
  const late = lateRule(draft.startsAt);
  const cannotBook = !!standing.data && !standing.data.canBook;
  const blockedMessage = cannotBook ? standing.data?.message : null;

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
      if (
        err instanceof ApiError &&
        (err.code === 'SLOT_TAKEN' ||
          err.code === 'TOO_SOON' ||
          err.code === 'OUTSIDE_OPENING_HOURS' ||
          err.code === 'ALREADY_BOOKED')
      ) {
        setSlotError(err.message);
      }
    }
  };

  return (
    <Screen
      gap={13}
      footer={
        <BottomSheet>
          <Button
            onPress={() => void confirm()}
            disabled={create.isPending || cannotBook || standing.isPending}
            loading={create.isPending}
          >
            {cannotBook ? 'Réservation en ligne impossible' : 'Confirmer la réservation'}
          </Button>
        </BottomSheet>
      }
    >
      <TopBar backTo={`/s/${slug}/reserver/coordonnees`} right="Étape 3 sur 3" />
      <H1>Récapitulatif</H1>

      {!!blockedMessage && (
        <View
          accessibilityRole="alert"
          style={{
            gap: 8,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: C.dangerLine,
            backgroundColor: C.cancelBg,
            padding: 13,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <I icon={Ban} size={18} color={C.cancelFg} />
            <Tx size={14.5} weight={700} lh={19} color={C.cancelFg}>
              Réservation en ligne impossible
            </Tx>
          </View>
          <Tx size={13} lh={18} color={C.cancelFg}>
            {blockedMessage}
          </Tx>
          {!!s.phone && (
            <Button variant="g" sm onPress={() => void open(`tel:${s.phone}`)}>
              <I icon={Phone} size={14.5} />
              <Tx size={13} weight={600} lh={17}>
                Appeler le salon
              </Tx>
            </Button>
          )}
        </View>
      )}

      {/* L'essentiel en grand : quand, à quelle heure, combien. */}
      <Card gap={10} style={blockedMessage ? { opacity: 0.6 } : { borderColor: C.ink }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Tx size={16} weight={700} ls={-0.3} lh={20}>
            {relativeDayLabelDZ(toLocalDateKey(new Date(draft.startsAt)))}
          </Tx>
          <Tx size={12} color={C.muted} lh={16}>
            {capitalize(formatDateLongDZ(draft.startsAt))}
          </Tx>
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
            <Tx size={32} weight={700} ls={-1} lh={35} mono>
              {start}
            </Tx>
            <Tx size={14.5} color={C.muted} lh={24} mono>
              → {end}
            </Tx>
          </View>
          <Tx size={23} weight={700} ls={-0.7} lh={27}>
            {formatDA(price)}
          </Tx>
        </View>
        <Tx size={13} color={C.muted} lh={17}>
          {`${formatDuration(minutes)} au total · ${s.depositRequired ? 'acompte demandé sur place' : 'paiement sur place, aucun acompte'}`}
        </Tx>
      </Card>

      <Card gap={0}>
        <Rows>
          <Row
            py={10}
            chevron={false}
            right={
              <Tx size={13} weight={600} lh={17}>
                {formatDA(price)}
              </Tx>
            }
          >
            <Tx size={14} weight={700} lh={18}>
              {chosen.length} prestation{chosen.length > 1 ? 's' : ''}
            </Tx>
          </Row>
          {chosen.map((sv) => (
            <Row
              key={sv!.id}
              py={10}
              chevron={false}
              right={
                <Tx
                  size={12}
                  color={C.muted}
                  lh={16}
                >{`${formatDuration(sv!.durationMinutes)} · ${formatDA(sv!.priceDa)}`}</Tx>
              }
            >
              <Tx size={14} weight={600} lh={18}>
                {sv!.name}
              </Tx>
            </Row>
          ))}
        </Rows>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={14} weight={700} ls={-0.3} lh={18}>
              {s.name}
            </Tx>
            <Tx size={12} color={C.muted} lh={16} numberOfLines={1}>
              {[s.address, s.zone ?? s.city, wilayaName(s.wilayaCode)].filter(Boolean).join(', ')}
            </Tx>
          </View>
        </View>
      </Card>

      <Card gap={6}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <I icon={CalendarCheck} size={13} color={C.muted} />
          <Tx size={10.5} weight={700} upper ls={0.8} lh={14} color={C.muted}>
            Bon à savoir
          </Tx>
        </View>
        <Tx size={13} lh={18}>
          • Arrivez à{' '}
          <Tx size={13} weight={700} lh={18}>
            {late.arriveAt}
          </Tx>{' '}
          ({ARRIVAL_ADVANCE_MINUTES} min avant). Retard toléré jusqu'à{' '}
          <Tx size={13} weight={700} lh={18}>
            {late.lateUntil}
          </Tx>{' '}
          ({LATE_TOLERANCE_MINUTES} min).
        </Tx>
        <Tx size={13} lh={18}>
          • Annulation ou report gratuits jusqu'à {s.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS} h
          avant.
        </Tx>
        <Tx size={13} lh={18}>
          • Confirmation par WhatsApp et rappel avant le rendez-vous.
        </Tx>
      </Card>

      {slotError && (
        <View style={{ gap: 10 }}>
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
