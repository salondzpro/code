/**
 * C-F 14 — Rendez-vous à venir (Itinéraire / Reporter) ; C-F 19 — Rendez-vous passés
 * (Réserver à nouveau / Noter, note donnée).
 */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMyBookings } from '@salondz/api-client';
import { formatDA, formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { useRealtimeMyBookings } from '@/lib/realtime';
import { capitalize, dayMonth, directionsUrl, open } from '@/lib/salon';
import { Avatar, Button, Card, ErrorText, H1, Img, P, Segmented, Skeleton, StatusBadge, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C, NAV_PAD } from '@/theme/design';

export default function Bookings() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ scope?: string }>();
  const [scope, setScope] = useState<'upcoming' | 'past'>(params.scope === 'past' ? 'past' : 'upcoming');
  useEffect(() => {
    if (params.scope === 'past' || params.scope === 'upcoming') setScope(params.scope);
  }, [params.scope]);
  const list = useMyBookings({ scope });
  useRealtimeMyBookings(user?.id);
  const items = list.data?.items ?? [];

  return (
    <Screen gap={16} bottom={NAV_PAD} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <H1 size={34} lh={38} ls={-0.8}>
        {scope === 'past' ? 'Mes rendez-vous' : 'Rendez-vous'}
      </H1>
      <Segmented
        label="Période"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'upcoming', label: 'À venir' },
          { value: 'past', label: 'Passés' },
        ]}
      />
      {list.isPending ? (
        <>
          <Skeleton h={180} radius={20} />
          <Skeleton h={120} radius={20} />
        </>
      ) : list.isError ? (
        <ErrorText error={list.error} retry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 56 }}>
          <Tx size={22} weight={700} lh={27} center>
            {scope === 'upcoming' ? 'Aucun rendez-vous à venir' : 'Aucun rendez-vous passé'}
          </Tx>
          <P center>Réservez en quelques secondes dans le salon de votre choix.</P>
          <Button onPress={() => router.push('/(client)/(tabs)')} style={{ marginTop: 8 }}>
            Explorer les salons
          </Button>
        </View>
      ) : scope === 'upcoming' ? (
        items.map((b) => {
          const active = b.status === 'pending' || b.status === 'confirmed';
          return (
            <Card key={b.id} gap={16}>
              <Pressable accessibilityRole="link" accessibilityLabel={`${b.serviceName} · ${b.salon.name}`} onPress={() => router.push(`/rdv/${b.id}` as never)} style={{ gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Tx size={22} weight={700} ls={-0.4} lh={27} color={active ? C.text : C.muted} style={{ flex: 1 }}>
                    {capitalize(formatDateShortDZ(b.startsAt))} · {formatTimeDZ(b.startsAt)}
                  </Tx>
                  <StatusBadge status={b.status} md />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Img src={b.salon.coverUrl} radius={16} style={{ width: 104, height: 104, opacity: active ? 1 : 0.6 }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Tx size={22} weight={700} ls={-0.4} lh={27} color={active ? C.text : C.muted}>
                      {b.serviceName}
                    </Tx>
                    <Tx size={17} color={C.muted} lh={23}>
                      {b.status === 'cancelled' ? `Annulé${b.cancelledBy === 'salon' ? ' par le salon' : ''}` : `${b.salon.name} · ${formatDA(b.priceDa)}`}
                    </Tx>
                  </View>
                </View>
              </Pressable>
              {active && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button variant="g" sm style={{ flex: 1, paddingVertical: 18 }} onPress={() => void open(directionsUrl(b))}>
                    <Tx size={17} weight={600} ls={-0.2}>
                      Itinéraire
                    </Tx>
                  </Button>
                  <Button variant="g" sm style={{ flex: 1, paddingVertical: 18 }} onPress={() => router.push(`/rdv/${b.id}/reporter` as never)}>
                    <Tx size={17} weight={600} ls={-0.2}>
                      Reporter
                    </Tx>
                  </Button>
                </View>
              )}
            </Card>
          );
        })
      ) : (
        items.map((b) => (
          <Card key={b.id} gap={16}>
            <Pressable accessibilityRole="link" onPress={() => router.push(`/rdv/${b.id}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar src={b.salon.coverUrl} name={b.salon.name} size={84} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={22} weight={700} ls={-0.4} lh={27}>
                  {b.salon.name}
                </Tx>
                <Tx size={17} color={C.muted} lh={23}>
                  {dayMonth(b.startsAt)} · {b.serviceName}
                  {b.status !== 'cancelled' ? ` · ${formatDA(b.priceDa)}` : ''}
                </Tx>
              </View>
              <StatusBadge status={b.status} md />
            </Pressable>
            {b.status === 'completed' && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button variant="g" sm style={{ flex: 1, paddingVertical: 18 }} onPress={() => router.push(`/s/${b.salon.slug}/prestations` as never)}>
                  <Tx size={18} weight={600} ls={-0.2}>
                    Réserver à nouveau
                  </Tx>
                </Button>
                <Button variant="g" sm auto style={{ paddingHorizontal: 24, paddingVertical: 18 }} onPress={() => router.push(`/rdv/${b.id}/noter` as never)}>
                  <Tx size={18} weight={600} ls={-0.2}>
                    Noter
                  </Tx>
                </Button>
              </View>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}
