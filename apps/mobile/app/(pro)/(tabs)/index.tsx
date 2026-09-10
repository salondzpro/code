/** PRO-F 22 — Accueil professionnel : « Votre journée », à valider, prochains, chiffre d'affaires. */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, MessageCircle, Phone, Share2 } from 'lucide-react-native';
import {
  useMe,
  useProBookingMutations,
  useProBookings,
  useProPendingBookings,
  useProSalon,
  useProStats,
} from '@salondz/api-client';
import { formatDA, formatTimeDZ, toLocalDateKey, untilLabelFR } from '@salondz/constants';
import { useRealtimeBookings } from '@/lib/realtime';
import { useStaffFilter } from '@/lib/prefs';
import { StaffFilter } from '@/ui/StaffFilter';
import { QuickCloseBanner, QuickCloseButton } from '@/ui/QuickClose';
import { ShareSheet } from '@/ui/ShareSheet';
import { formatDuration } from '@/lib/format';
import { open } from '@/lib/salon';
import {
  Avatar,
  Button,
  Card,
  ErrorText,
  Grid,
  H1,
  I,
  IconButton,
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

/** Heure courante rafraîchie chaque minute (« dans 25 min », « en cours »). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

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
  const now = useNow();
  const [share, setShare] = useState(false);
  const [staffId, setStaffId] = useStaffFilter();
  const byStaff = <T extends { staffId: string | null }>(list: T[]) =>
    staffId ? list.filter((b) => b.staffId === staffId) : list;
  const todays = byStaff(todayList.data?.items ?? [])
    .filter((b) => b.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  // « Prochains » = ce qui reste à faire aujourd'hui (en cours compris) ; le passé est compté à part.
  const upcoming = todays.filter(
    (b) =>
      new Date(b.endsAt).getTime() > now && (b.status === 'pending' || b.status === 'confirmed'),
  );
  const passed = todays.length - upcoming.length;
  const next = upcoming[0];
  const inProgress = !!next && new Date(next.startsAt).getTime() <= now;
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
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Tout voir"
            onPress={() => router.push('/(pro)/(tabs)/agenda')}
          >
            <Tx size={10.5} color={C.muted} lh={14.5}>
              Tout voir
            </Tx>
          </Pressable>
        }
      >
        Prochains
      </SectionLabel>
      {todayList.isPending && <Skeleton h={117} radius={16} />}
      {!todayList.isPending && !next && (
        <Card>
          <P>
            {passed
              ? `Journée terminée · ${passed} rendez-vous ${passed > 1 ? 'passés' : 'passé'} aujourd'hui.`
              : 'Journée libre : aucun rendez-vous prévu aujourd’hui.'}
          </P>
        </Card>
      )}
      {next && (
        /* Le prochain (ou celui en cours) en grand : heure, client, prestations, prix, membre — l'essentiel d'un coup d'œil. */
        <Card
          gap={10}
          style={inProgress ? { backgroundColor: C.okBg, borderColor: C.okFg } : undefined}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Tx size={10} weight={700} upper ls={0.8} lh={14} color={inProgress ? C.okFg : C.muted}>
              {inProgress
                ? `En cours · fin à ${formatTimeDZ(next.endsAt)}`
                : `Prochain · ${untilLabelFR(next.startsAt, now)}`}
            </Tx>
            <StatusBadge status={next.status} md />
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Ouvrir le rendez-vous de ${next.clientName}`}
            onPress={() => router.push(`/pro-rdv/${next.id}` as never)}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
              <Tx size={29} weight={700} ls={-1} lh={32} mono>
                {formatTimeDZ(next.startsAt)}
              </Tx>
              <Tx size={13} color={C.muted} lh={22} mono>
                → {formatTimeDZ(next.endsAt)}
              </Tx>
            </View>
            <Tx size={19.5} weight={700} ls={-0.5} lh={24}>
              {formatDA(next.priceDa)}
            </Tx>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/pro-rdv/${next.id}` as never)}
              style={{ flex: 1, minWidth: 0 }}
            >
              <Tx size={18} weight={700} ls={-0.4} lh={23} numberOfLines={1}>
                {next.clientName}
              </Tx>
              <Tx size={13} color={C.muted} lh={18}>
                {next.serviceName} · {formatDuration(next.durationMinutes)}
                {next.staff?.displayName ? ` · ${next.staff.displayName}` : ''}
              </Tx>
            </Pressable>
            {next.clientPhone && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <IconButton
                  accessibilityLabel={`Appeler ${next.clientName}`}
                  onPress={() => void open(`tel:${next.clientPhone}`)}
                >
                  <I icon={Phone} size={17} color={C.text} />
                </IconButton>
                <IconButton
                  accessibilityLabel={`WhatsApp ${next.clientName}`}
                  onPress={() => void open(`https://wa.me/${next.clientPhone!.replace(/\D/g, '')}`)}
                >
                  <I icon={MessageCircle} size={17} color={C.text} />
                </IconButton>
              </View>
            )}
          </View>
        </Card>
      )}
      {upcoming.length > 1 && (
        <ListCard>
          {upcoming.slice(1, 6).map((b) => (
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
                    {!staffId && b.staff?.displayName ? ` · ${b.staff.displayName}` : ''}
                  </Tx>
                </View>
              </View>
            </Row>
          ))}
          {upcoming.length > 6 && (
            <Row py={10} onPress={() => router.push('/(pro)/(tabs)/agenda')}>
              <Tx size={12} color={C.muted} lh={16}>
                + {upcoming.length - 6} autres aujourd'hui
              </Tx>
            </Row>
          )}
        </ListCard>
      )}
      {next && passed > 0 && (
        <Tx size={10.5} color={C.muted} lh={14.5} style={{ marginTop: -6 }}>
          {passed} rendez-vous déjà {passed > 1 ? 'passés' : 'passé'} aujourd'hui.
        </Tx>
      )}

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
      {/* Partage du lien de réservation : tout en bas, après le chiffre d'affaires. */}
      {salon && (
        <Button variant="g" onPress={() => setShare(true)}>
          <I icon={Share2} size={15} color={C.text} />
          <Tx size={13} weight={600} lh={17}>
            Partager mon lien
          </Tx>
        </Button>
      )}
      {salon && (
        <ShareSheet
          open={share}
          onClose={() => setShare(false)}
          name={salon.name}
          slug={salon.slug}
        />
      )}
    </Screen>
  );
}
