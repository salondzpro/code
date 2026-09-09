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
  const [scope, setScope] = useState<'upcoming' | 'past' | 'cancelled'>(params.scope === 'past' ? 'past' : params.scope === 'cancelled' ? 'cancelled' : 'upcoming');
  useEffect(() => {
    if (params.scope === 'past' || params.scope === 'upcoming' || params.scope === 'cancelled') setScope(params.scope);
  }, [params.scope]);
  const list = useMyBookings({ scope });
  useRealtimeMyBookings(user?.id);
  const items = list.data?.items ?? [];

  return (
    <Screen gap={13} bottom={NAV_PAD} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <H1 size={23} lh={26} ls={-0.8}>
        {scope === 'upcoming' ? 'Rendez-vous' : 'Mes rendez-vous'}
      </H1>
      <Segmented
        label="Période"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'upcoming', label: 'À venir' },
          { value: 'past', label: 'Passés' },
          { value: 'cancelled', label: 'Annulés' },
        ]}
      />
      {list.isPending ? (
        <>
          <Skeleton h={146} radius={16} />
          <Skeleton h={98} radius={16} />
        </>
      ) : list.isError ? (
        <ErrorText error={list.error} retry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingTop: 46 }}>
          <Tx size={14.5} weight={700} lh={18.5} center>
            {scope === 'upcoming' ? 'Aucun rendez-vous à venir' : scope === 'cancelled' ? 'Aucun rendez-vous annulé' : 'Aucun rendez-vous passé'}
          </Tx>
          <P center>Réservez en quelques secondes dans le salon de votre choix.</P>
          <Button onPress={() => router.push('/(client)/(tabs)')} style={{ marginTop: 6 }}>
            Explorer les salons
          </Button>
        </View>
      ) : scope === 'upcoming' ? (
        items.map((b) => {
          const active = b.status === 'pending' || b.status === 'confirmed';
          return (
            <Card key={b.id} gap={13}>
              <Pressable accessibilityRole="link" accessibilityLabel={`${b.serviceName} · ${b.salon.name}`} onPress={() => router.push(`/rdv/${b.id}` as never)} style={{ gap: 13 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <Tx size={14.5} weight={700} ls={-0.4} lh={18.5} color={active ? C.text : C.muted} style={{ flex: 1 }}>
                    {capitalize(formatDateShortDZ(b.startsAt))} · {formatTimeDZ(b.startsAt)}
                  </Tx>
                  <StatusBadge status={b.status} md cancelledBy={b.cancelledBy} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <Img src={b.salon.coverUrl} radius={13} style={{ width: 84, height: 84, opacity: active ? 1 : 0.6 }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Tx size={14.5} weight={700} ls={-0.4} lh={18.5} color={active ? C.text : C.muted}>
                      {b.serviceName}
                    </Tx>
                    <Tx size={10.5} color={C.muted} lh={15.5}>
                      {b.salon.name} · {formatDA(b.priceDa)}
                    </Tx>
                  </View>
                </View>
              </Pressable>
              {active && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button variant="g" sm style={{ flex: 1, paddingVertical: 15 }} onPress={() => void open(directionsUrl(b))}>
                    <Tx size={10.5} weight={600} ls={-0.2}>
                      Itinéraire
                    </Tx>
                  </Button>
                  {b.salon.allowClientReschedule !== false && (
                    <Button variant="g" sm style={{ flex: 1, paddingVertical: 15 }} onPress={() => router.push(`/rdv/${b.id}/reporter` as never)}>
                      <Tx size={10.5} weight={600} ls={-0.2}>
                        Reporter
                      </Tx>
                    </Button>
                  )}
                </View>
              )}
            </Card>
          );
        })
      ) : (
        items.map((b) => (
          <Card key={b.id} gap={13}>
            <Pressable accessibilityRole="link" onPress={() => router.push(`/rdv/${b.id}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <Avatar src={b.salon.coverUrl} name={b.salon.name} size={68} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={14.5} weight={700} ls={-0.4} lh={18.5}>
                  {b.salon.name}
                </Tx>
                <Tx size={10.5} color={C.muted} lh={15.5}>
                  {dayMonth(b.startsAt)} · {formatTimeDZ(b.startsAt)} · {b.serviceName}
                  {b.status !== 'cancelled' ? ` · ${formatDA(b.priceDa)}` : ''}
                </Tx>
                {b.status === 'cancelled' && !!b.cancellationReason && (
                  <Tx size={10.5} color={C.danger} lh={15.5}>
                    Motif : {b.cancellationReason}
                  </Tx>
                )}
              </View>
              <StatusBadge status={b.status} md cancelledBy={b.cancelledBy} />
            </Pressable>
            {b.status === 'completed' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button variant="g" sm style={{ flex: 1, paddingVertical: 15 }} onPress={() => router.push(`/s/${b.salon.slug}/prestations` as never)}>
                  <Tx size={11.5} weight={600} ls={-0.2}>
                    Réserver à nouveau
                  </Tx>
                </Button>
                <Button variant="g" sm auto style={{ paddingHorizontal: 20, paddingVertical: 15 }} onPress={() => router.push(`/rdv/${b.id}/noter` as never)}>
                  <Tx size={11.5} weight={600} ls={-0.2}>
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
