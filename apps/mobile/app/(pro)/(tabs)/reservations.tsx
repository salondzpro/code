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
  ListCard,
  Row,
  SectionLabel,
  Skeleton,
  StatusBadge,
  Tx,
} from '@/ui';
import { RefuseRequestSheet, type RefusedRequest } from '@/ui/RefuseRequestSheet';
import { Screen } from '@/ui/Screen';
import { C, NAV_PAD } from '@/theme/design';

/** Fenêtre de la liste « à venir » : au-delà, l'agenda mois prend le relais. */
const HORIZON_DAYS = 30;
const localKey = (iso: string) => toLocalDateKey(new Date(iso));

export default function Requests() {
  const router = useRouter();
  const pending = useProPendingBookings();
  const today = toLocalDateKey();
  const next = useProBookings({ from: today, to: addDaysToKey(today, HORIZON_DAYS), limit: 100 });
  const { setStatus } = useProBookingMutations();
  const [refusing, setRefusing] = useState<RefusedRequest | null>(null);
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
            <Tx size={12} color={C.muted} lh={14.5}>
              {items.length}
            </Tx>
          }
        >
          À valider
        </SectionLabel>
      )}
      {items.map((b) => (
        <Card key={b.id} gap={9}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(`/pro-rdv/${b.id}` as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Avatar name={b.clientName} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Tx size={14} weight={600} ls={-0.2} lh={18} numberOfLines={1}>
                {b.clientName}
              </Tx>
              <Tx size={12} color={C.muted} lh={16} numberOfLines={1}>
                {b.serviceName} · {formatDA(b.priceDa)}
                {b.staff ? ` · ${b.staff.displayName}` : ''}
              </Tx>
            </View>
            <View>
              <Tx size={14} weight={600} lh={18} right>
                {formatTimeDZ(b.startsAt)}
              </Tx>
              <Tx size={12} color={C.muted} lh={16} right>
                {formatDateShortDZ(b.startsAt)}
              </Tx>
            </View>
          </Pressable>
          <Grid cols={3}>
            <Button
              variant="ok"
              sm
              disabled={setStatus.isPending}
              onPress={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}
            >
              <Tx size={12} weight={600} color="#fff" ls={-0.2}>
                Confirmer
              </Tx>
            </Button>
            <Button variant="g" sm onPress={() => router.push(`/pro-rdv/${b.id}/reporter` as never)}>
              <Tx size={12} weight={600} ls={-0.2}>
                Reporter
              </Tx>
            </Button>
            <Button
              variant="d"
              sm
              onPress={() => setRefusing({ id: b.id, clientName: b.clientName })}
            >
              <Tx size={12} weight={600} color={C.danger} ls={-0.2}>
                Refuser
              </Tx>
            </Button>
          </Grid>
        </Card>
      ))}
      <ErrorText error={setStatus.error} />

      {next.isPending && <Skeleton h={130} radius={16} />}
      {next.isError && <ErrorText error={next.error} retry={() => void next.refetch()} />}
      {days.map(([key, list]) => (
        <View key={key} style={{ gap: 10 }}>
          <SectionLabel
            right={
              <Tx size={12} color={C.muted} lh={14.5}>
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
                    <Tx size={14} weight={700} lh={17}>
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
                    <Tx size={16} weight={700} ls={-0.3} lh={18.5} numberOfLines={1}>
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
              <I icon={Plus} size={14} color="#fff" />
              <Tx size={12} weight={600} color="#fff" lh={16}>
                Nouveau rendez-vous
              </Tx>
            </Button>
          }
        />
      )}

      <RefuseRequestSheet request={refusing} onClose={() => setRefusing(null)} />
    </Screen>
  );
}
