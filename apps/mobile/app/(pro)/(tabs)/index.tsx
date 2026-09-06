/** PRO-F 22 — Accueil professionnel : « Votre journée », à valider, prochains, chiffre d'affaires. */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useMe, useProBookingMutations, useProBookings, useProPendingBookings, useProSalon, useProStats } from '@salondz/api-client';
import { formatDA, formatTimeDZ, toLocalDateKey } from '@salondz/constants';
import { useRealtimeBookings } from '@/lib/realtime';
import { formatDuration } from '@/lib/format';
import { Avatar, Button, Card, ErrorText, Grid, H1, I, ListCard, P, Row, SectionLabel, Skeleton, StatusBadge, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C, NAV_PAD } from '@/theme/design';

/** « 9,4k » pour les gros montants du bandeau (design). */
function compactDA(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace('.', ',')}k`;
  return String(n);
}
const fmt = (n: number) => n.toLocaleString('fr-DZ').replace(/ /g, ' ');

export default function ProHome() {
  const router = useRouter();
  const me = useMe();
  const salon = useProSalon().data?.salon ?? null;
  const stats = useProStats();
  const pending = useProPendingBookings();
  const today = toLocalDateKey();
  const todayList = useProBookings({ from: today, to: today, limit: 50 });
  const { setStatus } = useProBookingMutations();
  useRealtimeBookings(salon?.id);
  const firstName = (me.data?.profile.fullName ?? salon?.name ?? '').split(' ')[0];
  const now = Date.now();
  const upcoming = (todayList.data?.items ?? []).filter((b) => b.status !== 'cancelled').sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <Screen gap={16} bottom={NAV_PAD} refreshing={stats.isRefetching} onRefresh={() => void Promise.all([stats.refetch(), pending.refetch(), todayList.refetch()])}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View>
          <Tx size={19} color={C.muted} lh={24}>
            Bonjour, {firstName}
          </Tx>
          <H1 size={34} lh={38} ls={-0.8}>
            Votre journée
          </H1>
        </View>
        <Pressable accessibilityRole="link" accessibilityLabel="Profil" onPress={() => router.push('/(pro)/(tabs)/profil-pro')}>
          <Avatar src={salon?.logoUrl ?? me.data?.profile.avatarUrl} name={firstName || 'Pro'} size={56} />
        </Pressable>
      </View>

      {stats.isPending ? (
        <Skeleton h={140} radius={20} />
      ) : stats.isError ? (
        <ErrorText error={stats.error} retry={() => void stats.refetch()} />
      ) : (
        <Grid cols={3}>
          <Card gap={4} pad={20} style={{ backgroundColor: C.ink, borderColor: C.ink, paddingVertical: 24 }}>
            <Tx size={34} weight={700} ls={-0.8} lh={36} color="#fff">
              {stats.data.todayCount}
            </Tx>
            <Tx size={17} color={C.white70} lh={22}>
              rendez-vous
            </Tx>
          </Card>
          <Card gap={4} pad={20} style={{ paddingVertical: 24 }}>
            <Tx size={34} weight={700} ls={-0.8} lh={36} color={stats.data.pendingCount ? C.pendingFg : C.text}>
              {stats.data.pendingCount}
            </Tx>
            <Tx size={17} color={C.muted} lh={22}>
              en attente
            </Tx>
          </Card>
          <Card gap={4} pad={20} style={{ paddingVertical: 24 }}>
            <Tx size={34} weight={700} ls={-0.8} lh={36}>
              {compactDA(stats.data.todayRevenueDa)}
            </Tx>
            <Tx size={17} color={C.muted} lh={22}>
              DA prévu
            </Tx>
          </Card>
        </Grid>
      )}

      <SectionLabel
        right={
          <Pressable accessibilityRole="link" accessibilityLabel="Voir toutes les demandes" onPress={() => router.push('/reservations')}>
            <Tx size={19} weight={700} lh={24}>
              {pending.data?.items.length ?? 0}
            </Tx>
          </Pressable>
        }
      >
        À valider
      </SectionLabel>
      {pending.data?.items.length ? (
        pending.data.items.slice(0, 3).map((b) => (
          <Card key={b.id} gap={16}>
            <Pressable accessibilityRole="link" onPress={() => router.push(`/pro-rdv/${b.id}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar name={b.clientName} size={68} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={24} weight={700} ls={-0.4} lh={29}>
                  {b.clientName}
                </Tx>
                <Tx size={17} color={C.muted} lh={23}>
                  {b.serviceName} · {formatTimeDZ(b.startsAt)} · {formatDA(b.priceDa)}
                </Tx>
              </View>
            </Pressable>
            <Grid cols={2}>
              <Button sm style={{ paddingVertical: 18 }} disabled={setStatus.isPending} onPress={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}>
                <Tx size={18} weight={600} color="#fff" ls={-0.2}>
                  Confirmer
                </Tx>
              </Button>
              <Button variant="g" sm style={{ paddingVertical: 18 }} onPress={() => router.push(`/pro-rdv/${b.id}/reporter` as never)}>
                <Tx size={18} weight={600} ls={-0.2}>
                  Reporter
                </Tx>
              </Button>
            </Grid>
          </Card>
        ))
      ) : (
        <P>Aucune demande en attente.</P>
      )}

      <SectionLabel
        right={
          <Pressable accessibilityRole="link" onPress={() => router.push('/(pro)/(tabs)/agenda')}>
            <Tx size={17} color={C.muted} lh={22}>
              Tout voir
            </Tx>
          </Pressable>
        }
      >
        Prochains
      </SectionLabel>
      <ListCard>
        {todayList.isPending && <Skeleton h={64} style={{ marginVertical: 12 }} />}
        {upcoming.length === 0 && !todayList.isPending && (
          <View style={{ paddingVertical: 12 }}>
            <P>Journée libre.</P>
          </View>
        )}
        {upcoming.slice(0, 6).map((b) => (
          <Row key={b.id} py={16} chevron={false} onPress={() => router.push(`/pro-rdv/${b.id}` as never)} right={<StatusBadge status={b.status} md />}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Tx size={19} weight={700} lh={24} mono style={{ width: 60 }}>
                {formatTimeDZ(b.startsAt)}
              </Tx>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={21} weight={700} ls={-0.3} lh={26} color={new Date(b.endsAt).getTime() < now ? C.muted : C.text}>
                  {b.clientName}
                </Tx>
                <Tx size={16} color={C.muted} lh={22}>
                  {b.serviceName} · {formatDuration(b.durationMinutes)}
                </Tx>
              </View>
            </View>
          </Row>
        ))}
      </ListCard>

      <Card gap={16} onPress={() => router.push('/chiffre-affaires')} accessibilityLabel="Chiffre d'affaires">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionLabel>Chiffre d'affaires</SectionLabel>
          <I icon={ChevronRight} size={20} color={C.disabled} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          {[
            { v: stats.data?.todayRevenueDa ?? 0, l: "aujourd'hui" },
            { v: stats.data?.weekRevenueDa ?? 0, l: 'cette semaine' },
            { v: stats.data?.monthRevenueDa ?? 0, l: 'ce mois' },
          ].map((x, i) => (
            <View key={x.l} style={{ flex: 1, paddingLeft: i ? 16 : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: C.line }}>
              <Tx size={22} weight={700} ls={-0.4} lh={27} numberOfLines={1} adjustsFontSizeToFit>
                {fmt(x.v)}{' '}
                <Tx size={14} weight={600} color={C.muted} lh={27}>
                  DA
                </Tx>
              </Tx>
              <Tx size={15} color={C.muted} lh={20}>
                {x.l}
              </Tx>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
