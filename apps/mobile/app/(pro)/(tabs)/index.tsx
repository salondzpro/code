/** PRO-F 22 — Accueil professionnel : « Votre journée », à valider, prochains, chiffre d'affaires. */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import {
  useMe,
  useProBookingMutations,
  useProBookings,
  useProPendingBookings,
  useProSalon,
  useProStats,
} from '@salondz/api-client';
import { formatDA, formatTimeDZ, toLocalDateKey } from '@salondz/constants';
import { useRealtimeBookings } from '@/lib/realtime';
import { useStaffFilter } from '@/lib/prefs';
import { StaffFilter } from '@/ui/StaffFilter';
import { QuickCloseBanner, QuickCloseButton } from '@/ui/QuickClose';
import { formatDuration } from '@/lib/format';
import {
  Avatar,
  Button,
  Card,
  ErrorText,
  Grid,
  H1,
  I,
  ListCard,
  P,
  Row,
  SectionLabel,
  Skeleton,
  StatusBadge,
  Tx,
} from '@/ui';
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
  const [staffId, setStaffId] = useStaffFilter();
  const byStaff = <T extends { staffId: string | null }>(list: T[]) =>
    staffId ? list.filter((b) => b.staffId === staffId) : list;
  const upcoming = byStaff(todayList.data?.items ?? [])
    .filter((b) => b.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const pendingItems = byStaff(pending.data?.items ?? []);

  return (
    <Screen
      gap={13}
      bottom={NAV_PAD}
      refreshing={stats.isRefetching}
      onRefresh={() => void Promise.all([stats.refetch(), pending.refetch(), todayList.refetch()])}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View>
          <Tx size={12} color={C.muted} lh={16}>
            Bonjour, {firstName}
          </Tx>
          <H1 size={23} lh={26} ls={-0.8}>
            Votre journée
          </H1>
        </View>
        {/* « Fermer / Pause » en icône, entre le titre et le logo. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {salon && <QuickCloseButton openingHours={salon.openingHours} />}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Profil"
            onPress={() => router.push('/(pro)/(tabs)/profil-pro')}
          >
            <Avatar
              src={salon?.logoUrl ?? me.data?.profile.avatarUrl}
              name={firstName || 'Pro'}
              size={45.5}
            />
          </Pressable>
        </View>
      </View>
      {salon && <StaffFilter staff={salon.staff} value={staffId} onChange={setStaffId} />}

      {stats.isPending ? (
        <Skeleton h={114} radius={16} />
      ) : stats.isError ? (
        <ErrorText error={stats.error} retry={() => void stats.refetch()} />
      ) : (
        <Grid cols={3}>
          <Card
            gap={3}
            pad={20}
            style={{ backgroundColor: C.ink, borderColor: C.ink, paddingVertical: 20 }}
          >
            <Tx size={23} weight={700} ls={-0.8} lh={24.5} color="#fff">
              {stats.data.todayCount}
            </Tx>
            <Tx size={10.5} color={C.white70} lh={14.5}>
              rendez-vous
            </Tx>
          </Card>
          <Card gap={3} pad={20} style={{ paddingVertical: 20 }}>
            <Tx
              size={23}
              weight={700}
              ls={-0.8}
              lh={24.5}
              color={stats.data.pendingCount ? C.pendingFg : C.text}
            >
              {stats.data.pendingCount}
            </Tx>
            <Tx size={10.5} color={C.muted} lh={14.5}>
              en attente
            </Tx>
          </Card>
          <Card gap={3} pad={20} style={{ paddingVertical: 20 }}>
            <Tx size={23} weight={700} ls={-0.8} lh={24.5}>
              {compactDA(stats.data.todayRevenueDa)}
            </Tx>
            <Tx size={10.5} color={C.muted} lh={14.5}>
              DA prévu
            </Tx>
          </Card>
        </Grid>
      )}

      {salon && <QuickCloseBanner />}

      <SectionLabel
        right={
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Voir toutes les demandes"
            onPress={() => router.push('/reservations')}
          >
            <Tx size={12} weight={700} lh={16}>
              {pendingItems.length}
            </Tx>
          </Pressable>
        }
      >
        À valider
      </SectionLabel>
      {pendingItems.length ? (
        pendingItems.slice(0, 3).map((b) => (
          <Card key={b.id} gap={13}>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/pro-rdv/${b.id}` as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}
            >
              <Avatar name={b.clientName} size={55} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={16} weight={700} ls={-0.4} lh={20.5}>
                  {b.clientName}
                </Tx>
                <Tx size={10.5} color={C.muted} lh={15.5}>
                  {b.serviceName} · {formatTimeDZ(b.startsAt)} · {formatDA(b.priceDa)}
                </Tx>
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
          </Card>
        ))
      ) : (
        <P>Aucune demande en attente.</P>
      )}

      <SectionLabel
        right={
          <Pressable accessibilityRole="link" onPress={() => router.push('/(pro)/(tabs)/agenda')}>
            <Tx size={10.5} color={C.muted} lh={14.5}>
              Tout voir
            </Tx>
          </Pressable>
        }
      >
        Prochains
      </SectionLabel>
      <ListCard>
        {todayList.isPending && <Skeleton h={52} style={{ marginVertical: 10 }} />}
        {upcoming.length === 0 && !todayList.isPending && (
          <View style={{ paddingVertical: 10 }}>
            <P>Journée libre.</P>
          </View>
        )}
        {upcoming.slice(0, 6).map((b) => (
          <Row
            key={b.id}
            py={13}
            chevron={false}
            onPress={() => router.push(`/pro-rdv/${b.id}` as never)}
            right={<StatusBadge status={b.status} md />}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
              <Tx size={12} weight={700} lh={16} mono style={{ width: 49 }}>
                {formatTimeDZ(b.startsAt)}
              </Tx>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx
                  size={14}
                  weight={700}
                  ls={-0.3}
                  lh={18}
                  color={new Date(b.endsAt).getTime() < now ? C.muted : C.text}
                >
                  {b.clientName}
                </Tx>
                <Tx size={10.5} color={C.muted} lh={15.5}>
                  {b.serviceName} · {formatDuration(b.durationMinutes)}
                </Tx>
              </View>
            </View>
          </Row>
        ))}
      </ListCard>

      <Card
        gap={13}
        onPress={() => router.push('/chiffre-affaires')}
        accessibilityLabel="Chiffre d'affaires"
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <SectionLabel>Chiffre d'affaires</SectionLabel>
          <I icon={ChevronRight} size={16} color={C.disabled} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          {[
            { v: stats.data?.todayRevenueDa ?? 0, l: "aujourd'hui" },
            { v: stats.data?.weekRevenueDa ?? 0, l: 'cette semaine' },
            { v: stats.data?.monthRevenueDa ?? 0, l: 'ce mois' },
          ].map((x, i) => (
            <View
              key={x.l}
              style={{
                flex: 1,
                paddingLeft: i ? 16 : 0,
                borderLeftWidth: i ? 1 : 0,
                borderLeftColor: C.line,
              }}
            >
              <Tx
                size={14.5}
                weight={700}
                ls={-0.4}
                lh={18.5}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {fmt(x.v)}{' '}
                <Tx size={11.5} weight={600} color={C.muted} lh={22}>
                  DA
                </Tx>
              </Tx>
              <Tx size={12} color={C.muted} lh={16}>
                {x.l}
              </Tx>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
