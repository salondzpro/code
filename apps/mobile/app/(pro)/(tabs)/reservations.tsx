/**
 * Réservations : ce qui attend une réponse, puis tout ce qui arrive. « À valider » en tête (confirmer,
 * reporter, refuser avec motif), puis les rendez-vous à venir groupés par jour — la liste chronologique
 * que l'agenda ne donne qu'un jour à la fois.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useProBookingMutations, useProBookings, useProPendingBookings } from '@salondz/api-client';
import {
  addDaysToKey,
  formatDA,
  formatDateShortDZ,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
} from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Grid,
  H1,
  I,
  Input,
  ListCard,
  ModalSheet,
  P,
  Row,
  SectionLabel,
  Skeleton,
  StatusBadge,
  Tx,
} from '@/ui';
import { Screen } from '@/ui/Screen';
import { C, FONT_SCALE, NAV_PAD } from '@/theme/design';

/** Fenêtre de la liste « à venir » : au-delà, l'agenda mois prend le relais. */
const HORIZON_DAYS = 30;
const localKey = (iso: string) => toLocalDateKey(new Date(iso));

export default function Requests() {
  const router = useRouter();
  const pending = useProPendingBookings();
  const today = toLocalDateKey();
  const next = useProBookings({ from: today, to: addDaysToKey(today, HORIZON_DAYS), limit: 100 });
  const { setStatus, cancel } = useProBookingMutations();
  const [refusing, setRefusing] = useState<{ id: string; clientName: string } | null>(null);
  const [reason, setReason] = useState('');
  const items = pending.data?.items ?? [];

  // À venir = ce qui n'est pas terminé, hors annulés et hors demandes (déjà en tête).
  const now = Date.now();
  const upcoming = (next.data?.items ?? [])
    .filter(
      (b) =>
        (b.status === 'confirmed' || b.status === 'pending') &&
        new Date(b.endsAt).getTime() > now &&
        !items.some((p) => p.id === b.id),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const days: [string, typeof upcoming][] = [];
  for (const b of upcoming) {
    const key = localKey(b.startsAt);
    const last = days[days.length - 1];
    if (last && last[0] === key) last[1].push(b);
    else days.push([key, [b]]);
  }

  return (
    <Screen
      gap={13}
      bottom={NAV_PAD}
      refreshing={pending.isRefetching}
      onRefresh={() => void Promise.all([pending.refetch(), next.refetch()])}
    >
      <H1 size={23} lh={26} ls={-0.8}>
        Réservations
      </H1>
      {pending.isError && <ErrorText error={pending.error} retry={() => void pending.refetch()} />}

      {items.length > 0 && (
        <SectionLabel
          right={
            <Tx size={10.5} color={C.muted} lh={14.5}>
              {items.length}
            </Tx>
          }
        >
          À valider
        </SectionLabel>
      )}
      {items.map((b) => (
        <Card key={b.id} gap={13}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(`/pro-rdv/${b.id}` as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}
          >
            <Avatar name={b.clientName} size={55} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Tx size={16} weight={700} ls={-0.4} lh={20.5} numberOfLines={1}>
                {b.clientName}
              </Tx>
              <Tx size={10.5} color={C.muted} lh={15.5}>
                {b.serviceName} · {formatDateShortDZ(b.startsAt)} {formatTimeDZ(b.startsAt)} ·{' '}
                {formatDA(b.priceDa)}
              </Tx>
              {b.staff && (
                <Tx size={12} color={C.muted} lh={16}>
                  avec {b.staff.displayName}
                </Tx>
              )}
            </View>
          </Pressable>
          <Grid cols={2}>
            <Button
              sm
              style={{ paddingVertical: 15 }}
              disabled={setStatus.isPending}
              onPress={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}
            >
              <Tx size={11.5} weight={600} color="#fff" ls={-0.2}>
                Confirmer
              </Tx>
            </Button>
            <Button
              variant="g"
              sm
              style={{ paddingVertical: 15 }}
              onPress={() => router.push(`/pro-rdv/${b.id}/reporter` as never)}
            >
              <Tx size={11.5} weight={600} ls={-0.2}>
                Reporter
              </Tx>
            </Button>
          </Grid>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRefusing({ id: b.id, clientName: b.clientName })}
            style={{ alignSelf: 'center' }}
          >
            <Tx size={10.5} color={C.danger} lh={14.5}>
              Refuser la demande
            </Tx>
          </Pressable>
        </Card>
      ))}
      <ErrorText error={setStatus.error ?? cancel.error} />

      {next.isPending && <Skeleton h={130} radius={16} />}
      {next.isError && <ErrorText error={next.error} retry={() => void next.refetch()} />}
      {days.map(([key, list]) => (
        <View key={key} style={{ gap: 10 }}>
          <SectionLabel
            right={
              <Tx size={10.5} color={C.muted} lh={14.5}>
                {list.length}
              </Tx>
            }
          >
            {relativeDayLabelDZ(key, today)}
          </SectionLabel>
          <ListCard>
            {list.map((b) => (
              <Row
                key={b.id}
                py={13}
                chevron={false}
                onPress={() => router.push(`/pro-rdv/${b.id}` as never)}
                right={
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Tx size={13} weight={700} lh={17}>
                      {formatDA(b.priceDa)}
                    </Tx>
                    <StatusBadge status={b.status} />
                  </View>
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Tx size={16} weight={700} ls={-0.5} lh={20} mono style={{ width: 56 }}>
                    {formatTimeDZ(b.startsAt)}
                  </Tx>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Tx size={14.5} weight={700} ls={-0.3} lh={18.5} numberOfLines={1}>
                      {b.clientName}
                    </Tx>
                    <Tx size={12} color={C.muted} lh={16}>
                      {b.serviceName} · {formatDuration(b.durationMinutes)}
                      {b.staff?.displayName ? ` · ${b.staff.displayName}` : ''}
                    </Tx>
                  </View>
                </View>
              </Row>
            ))}
          </ListCard>
        </View>
      ))}
      {next.data && items.length === 0 && days.length === 0 && (
        <EmptyState
          title="Aucun rendez-vous à venir"
          action={
            <Button onPress={() => router.push('/pro-rdv/nouveau' as never)}>
              <I icon={Plus} size={14.5} color="#fff" />
              <Tx size={12} weight={600} color="#fff" lh={16}>
                Nouveau rendez-vous
              </Tx>
            </Button>
          }
        />
      )}

      <ModalSheet open={!!refusing} onClose={() => setRefusing(null)}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Tx size={16} weight={700} ls={-0.4} lh={20.5} center>
            Refuser cette demande ?
          </Tx>
          <P center>{refusing?.clientName} sera prévenu·e et le créneau sera libéré.</P>
        </View>
        <Card row style={{ paddingVertical: 10, justifyContent: 'space-between' }}>
          <Tx size={12} lh={16}>
            Motif (optionnel)
          </Tx>
          <Input
            value={reason}
            onChangeText={setReason}
            placeholder="Complet"
            maxLength={200}
            accessibilityLabel="Motif"
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              paddingVertical: 0,
              paddingHorizontal: 0,
              textAlign: 'right',
              fontSize: 12 * FONT_SCALE,
            }}
          />
        </Card>
        <Button
          bg={C.danger}
          textColor="#fff"
          disabled={cancel.isPending}
          loading={cancel.isPending}
          onPress={async () => {
            if (!refusing) return;
            await cancel.mutateAsync({ id: refusing.id, reason: reason.trim() || undefined });
            setRefusing(null);
            setReason('');
          }}
        >
          Refuser la demande
        </Button>
        <Button variant="g" onPress={() => setRefusing(null)}>
          Garder
        </Button>
      </ModalSheet>
    </Screen>
  );
}
