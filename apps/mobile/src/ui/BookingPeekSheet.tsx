/**
 * Détail d'un rendez-vous en feuille, ouvert depuis l'agenda — jumelle du composant web
 * (apps/web/src/components/BookingPeekSheet.tsx).
 *
 * Pourquoi une feuille et pas un écran : dans un agenda, on ouvre un rendez-vous pour
 * vérifier ou décider, puis on revient au planning. Un écran dédié fait perdre le jour
 * affiché et la position dans la journée, et impose un aller-retour par rendez-vous.
 *
 * Le rendez-vous est relu par son identifiant, donc la feuille montre toujours l'état
 * courant. Le motif d'annulation passe par `ReasonField`, qui reste DANS la feuille :
 * empiler deux `Modal` React Native n'est pas fiable sur iOS.
 */
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlarmClock, ArrowRight, Check, CheckCircle2, MessageCircle, Phone, UserX } from 'lucide-react-native';
import { useProBooking, useProBookingMutations } from '@salondz/api-client';
import {
  formatDA,
  formatDateLongDZ,
  formatDZPhone,
  formatTimeDZ,
  isLate,
  LATE_TOLERANCE_MINUTES,
  relativeDayLabelDZ,
  SALON_CANCEL_REASONS_FR,
  toLocalDateKey,
} from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { C } from '@/theme/design';
import { Avatar, Button, Card, ErrorText, Grid, I, ModalSheet, P, Skeleton, StatusBadge, Tx } from './index';
import { ReasonField } from './ReasonField';

export function BookingPeekSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const router = useRouter();
  const booking = useProBooking(id ?? '');
  const { setStatus, cancel } = useProBookingMutations();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const b = id ? booking.data : undefined;

  const close = () => {
    setCancelling(false);
    setReason('');
    onClose();
  };
  // Le salon décide, puis revient à son planning : chaque action referme la feuille.
  const act = async (p: Promise<unknown>) => {
    await p;
    close();
  };

  const active = b ? b.status === 'pending' || b.status === 'confirmed' : false;
  const past = b ? new Date(b.startsAt).getTime() < Date.now() : false;
  const late = !!b && active && isLate(b.startsAt);
  const lines = b?.items?.length
    ? b.items
    : b
      ? [{ id: b.id, serviceName: b.serviceName, durationMinutes: b.durationMinutes, priceDa: b.priceDa }]
      : [];
  const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

  return (
    <ModalSheet open={!!id} onClose={close} scroll>
      {booking.isPending && !!id && <Skeleton h={160} radius={16} />}
      {booking.isError && <ErrorText error={booking.error} retry={() => void booking.refetch()} />}
      {!!b && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Tx size={12} weight={600} color={C.muted} ls={0.8} lh={16} upper>
                {relativeDayLabelDZ(toLocalDateKey(new Date(b.startsAt)))}
              </Tx>
              <Tx size={32} weight={600} ls={-1} lh={35} mono>
                {formatTimeDZ(b.startsAt)}
                <Tx size={16} color={C.muted} lh={35}>
                  {` – ${formatTimeDZ(b.endsAt)}`}
                </Tx>
              </Tx>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 5 }}>
              <StatusBadge status={b.status} cancelledBy={b.cancelledBy} viewer="pro" md />
              <Tx size={20} weight={600} lh={22}>
                {formatDA(b.priceDa)}
              </Tx>
            </View>
          </View>
          <Tx size={12} color={C.muted} lh={16}>
            {`${formatDateLongDZ(b.startsAt)} · ${formatDuration(b.durationMinutes)}${b.staff ? ` · ${b.staff.displayName}` : ''}`}
          </Tx>

          <Card gap={9}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={b.clientName} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={16} weight={600} lh={20} numberOfLines={1}>
                  {b.clientName}
                </Tx>
                {!!b.clientPhone && (
                  <Tx size={12} color={C.muted} lh={16} mono>
                    {formatDZPhone(b.clientPhone)}
                  </Tx>
                )}
              </View>
            </View>
            {!!b.clientPhone && (
              <Grid cols={2}>
                <Button variant="g" sm onPress={() => open(`tel:${b.clientPhone}`)}>
                  <I icon={Phone} size={16} />
                  <Tx size={12} weight={600} ls={-0.2}>
                    Appeler
                  </Tx>
                </Button>
                <Button
                  variant="g"
                  sm
                  onPress={() => open(`https://wa.me/${b.clientPhone!.replace(/\D/g, '')}`)}
                >
                  <I icon={MessageCircle} size={16} />
                  <Tx size={12} weight={600} ls={-0.2}>
                    WhatsApp
                  </Tx>
                </Button>
              </Grid>
            )}
          </Card>

          <Card gap={0}>
            {lines.map((it, i) => (
              <View
                key={it.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  paddingVertical: 9,
                  borderBottomWidth: i === lines.length - 1 ? 0 : 1,
                  borderBottomColor: C.lineSoft,
                }}
              >
                <Tx size={14} weight={600} lh={18} numberOfLines={1} style={{ flex: 1 }}>
                  {it.serviceName}
                </Tx>
                <Tx size={12} color={C.muted} lh={16}>
                  {`${formatDuration(it.durationMinutes)} · ${formatDA(it.priceDa)}`}
                </Tx>
              </View>
            ))}
          </Card>

          {!!b.notes && (
            <Card gap={4}>
              <Tx size={12} weight={600} color={C.muted} ls={0.8} lh={16} upper>
                Note du client
              </Tx>
              <P>{`« ${b.notes} »`}</P>
            </Card>
          )}

          <ErrorText error={setStatus.error ?? cancel.error} />

          {b.status === 'pending' && (
            <Button
              variant="ok"
              disabled={setStatus.isPending}
              onPress={() => void act(setStatus.mutateAsync({ id: b.id, status: 'confirmed' }))}
            >
              <I icon={Check} size={18} color="#fff" />
              <Tx size={14} weight={600} color="#fff" ls={-0.2}>
                Confirmer le rendez-vous
              </Tx>
            </Button>
          )}
          {active && past && (
            <Grid cols={2}>
              <Button
                disabled={setStatus.isPending}
                onPress={() => void act(setStatus.mutateAsync({ id: b.id, status: 'completed' }))}
              >
                <I icon={CheckCircle2} size={16} color="#fff" />
                <Tx size={12} weight={600} color="#fff" ls={-0.2}>
                  Terminé
                </Tx>
              </Button>
              <Button
                variant="d"
                disabled={setStatus.isPending}
                onPress={() => void act(setStatus.mutateAsync({ id: b.id, status: 'no_show' }))}
              >
                <I icon={UserX} size={16} color={C.danger} />
                <Tx size={12} weight={600} color={C.danger} ls={-0.2}>
                  Absent
                </Tx>
              </Button>
            </Grid>
          )}
          {late && (
            <Button
              variant="d"
              disabled={cancel.isPending}
              onPress={() => void act(cancel.mutateAsync({ id: b.id, reason: 'Retard', late: true }))}
            >
              <I icon={AlarmClock} size={16} color={C.danger} />
              <Tx size={12} weight={600} color={C.danger} ls={-0.2}>
                {`Annuler pour retard (plus de ${LATE_TOLERANCE_MINUTES} min)`}
              </Tx>
            </Button>
          )}
          {active && !cancelling && (
            <Grid cols={2}>
              <Button
                variant="g"
                onPress={() => {
                  close();
                  router.push(`/pro-rdv/${b.id}/reporter` as never);
                }}
              >
                <Tx size={13} weight={600} ls={-0.2}>
                  Reporter
                </Tx>
              </Button>
              <Button variant="d" onPress={() => setCancelling(true)}>
                <Tx size={13} weight={600} color={C.danger} ls={-0.2}>
                  Annuler
                </Tx>
              </Button>
            </Grid>
          )}
          {cancelling && (
            <View style={{ gap: 9 }}>
              <Tx size={14} weight={600} lh={18}>
                Annuler ce rendez-vous ?
              </Tx>
              <ReasonField
                reasons={SALON_CANCEL_REASONS_FR}
                value={reason}
                onChange={setReason}
                title="Pourquoi annuler ?"
              />
              <Grid cols={2}>
                <Button
                  variant="d"
                  disabled={cancel.isPending}
                  onPress={() => void act(cancel.mutateAsync({ id: b.id, reason: reason || undefined }))}
                >
                  <Tx size={12} weight={600} color={C.danger} ls={-0.2}>
                    Annuler le rendez-vous
                  </Tx>
                </Button>
                <Button variant="g" onPress={() => setCancelling(false)}>
                  <Tx size={12} weight={600} ls={-0.2}>
                    Garder
                  </Tx>
                </Button>
              </Grid>
            </View>
          )}

          <Button
            variant="g"
            onPress={() => {
              close();
              router.push(`/pro-rdv/${b.id}` as never);
            }}
          >
            <Tx size={13} weight={600} ls={-0.2}>
              Fiche complète et historique
            </Tx>
            <I icon={ArrowRight} size={16} />
          </Button>
        </>
      )}
    </ModalSheet>
  );
}
