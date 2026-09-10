/**
 * C-F 14 — Rendez-vous à venir ; C-F 19 — Rendez-vous passés / annulés.
 * Pensé pour un coup d'œil : le prochain rendez-vous en grand (jour, « dans 55 min », heure, prix, salon, adresse),
 * une icône sur chaque onglet et chaque action (Itinéraire, Reporter, Appeler, Réserver à nouveau, Noter).
 */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalendarClock,
  CalendarX,
  History,
  Info,
  MapPin,
  Navigation,
  Phone,
  RotateCcw,
  Search,
  Star,
} from 'lucide-react-native';
import { pagesItems, useMyBookingsInfinite } from '@salondz/api-client';
import { LoadMore } from '@/ui/LoadMore';
import {
  formatDA,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
  untilLabelFR,
} from '@salondz/constants';
import type { BookingWithSalon } from '@salondz/types';
import { useAuth } from '@/lib/auth';
import { useRealtimeMyBookings } from '@/lib/realtime';
import { directionsUrl, open } from '@/lib/salon';
import {
  Button,
  Card,
  ErrorText,
  H1,
  I,
  IconButton,
  Img,
  P,
  Segmented,
  Skeleton,
  StatusBadge,
  Tx,
} from '@/ui';
import { Screen } from '@/ui/Screen';
import { C, NAV_PAD } from '@/theme/design';

type Scope = 'upcoming' | 'past' | 'cancelled';
const DZ = 'Africa/Algiers';
const dayNum = (iso: string) =>
  new Intl.DateTimeFormat('fr-DZ', { day: 'numeric', timeZone: DZ }).format(new Date(iso));
const monthShort = (iso: string) =>
  new Intl.DateTimeFormat('fr-DZ', { month: 'short', timeZone: DZ })
    .format(new Date(iso))
    .replace('.', '');
const weekday = (iso: string) =>
  new Intl.DateTimeFormat('fr-DZ', { weekday: 'short', timeZone: DZ })
    .format(new Date(iso))
    .replace('.', '');

/** Heure courante rafraîchie chaque minute (« dans 25 min »). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Pavé date (jour en grand, mois, jour de semaine) des rendez-vous passés / annulés. */
function DateBlock({ iso, muted }: { iso: string; muted?: boolean }) {
  return (
    <View
      style={{
        width: 49,
        alignItems: 'center',
        borderRadius: 11,
        backgroundColor: C.fill,
        paddingVertical: 7,
      }}
    >
      <Tx size={9} weight={600} upper ls={0.5} lh={12} color={C.muted}>
        {weekday(iso)}
      </Tx>
      <Tx size={19.5} weight={700} ls={-0.5} lh={22} color={muted ? C.muted : C.text}>
        {dayNum(iso)}
      </Tx>
      <Tx size={10} lh={13} color={C.muted}>
        {monthShort(iso)}
      </Tx>
    </View>
  );
}

function ActionLabel({ children }: { children: string }) {
  return (
    <Tx size={12} weight={600} ls={-0.2} lh={16}>
      {children}
    </Tx>
  );
}

function UpcomingCard({ b, now }: { b: BookingWithSalon; now: number }) {
  const router = useRouter();
  const active = b.status === 'pending' || b.status === 'confirmed';
  const dayKey = toLocalDateKey(new Date(b.startsAt));
  const today = dayKey === toLocalDateKey();
  const started = new Date(b.startsAt).getTime() <= now;
  const openDetail = () => router.push(`/rdv/${b.id}` as never);
  const place = [b.salon.address, b.salon.city].filter(Boolean).join(', ');
  return (
    <Card gap={10} style={today && active ? { borderColor: C.ink } : undefined}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${b.serviceName} · ${b.salon.name}`}
        onPress={openDetail}
        style={{ gap: 10 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={14.5} weight={700} ls={-0.4} lh={18.5} color={active ? C.text : C.muted}>
              {relativeDayLabelDZ(dayKey)}
            </Tx>
            {today && active && (
              <Tx size={10.5} weight={600} lh={14} color={C.okFg}>
                {started ? 'En cours' : untilLabelFR(b.startsAt, now)}
              </Tx>
            )}
          </View>
          <StatusBadge status={b.status} md cancelledBy={b.cancelledBy} kind={b.cancellationKind} />
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
            <Tx size={29} weight={700} ls={-1} lh={32} mono color={active ? C.text : C.muted}>
              {formatTimeDZ(b.startsAt)}
            </Tx>
            <Tx size={13} color={C.muted} lh={22} mono>
              → {formatTimeDZ(b.endsAt)}
            </Tx>
          </View>
          <Tx size={18} weight={700} ls={-0.5} lh={22}>
            {formatDA(b.priceDa)}
          </Tx>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Img
            src={b.salon.coverUrl}
            radius={11}
            style={{ width: 58, height: 58, opacity: active ? 1 : 0.6 }}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={13.5} weight={700} ls={-0.3} lh={17.5} numberOfLines={1}>
              {b.salon.name}
            </Tx>
            <Tx size={12} color={C.muted} lh={16}>
              {b.serviceName}
              {b.staff?.displayName ? ` · avec ${b.staff.displayName}` : ''}
            </Tx>
            {!!place && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <I icon={MapPin} size={11} color={C.muted} />
                <Tx size={10.5} color={C.muted} lh={14} numberOfLines={1} style={{ flex: 1 }}>
                  {place}
                </Tx>
              </View>
            )}
          </View>
        </View>
      </Pressable>
      {active && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Button
            variant="g"
            sm
            style={{ flex: 1, paddingVertical: 15 }}
            onPress={() => void open(directionsUrl(b))}
          >
            <I icon={Navigation} size={14} />
            <ActionLabel>Itinéraire</ActionLabel>
          </Button>
          {b.salon.allowClientReschedule !== false && (
            <Button
              variant="g"
              sm
              style={{ flex: 1, paddingVertical: 15 }}
              onPress={() => router.push(`/rdv/${b.id}/reporter` as never)}
            >
              <I icon={CalendarClock} size={14} />
              <ActionLabel>Reporter</ActionLabel>
            </Button>
          )}
          {!!b.salon.phone && (
            <IconButton
              lg
              accessibilityLabel={`Appeler ${b.salon.name}`}
              onPress={() => void open(`tel:${b.salon.phone}`)}
            >
              <I icon={Phone} size={17} color={C.text} />
            </IconButton>
          )}
        </View>
      )}
    </Card>
  );
}

function HistoryCard({ b }: { b: BookingWithSalon }) {
  const router = useRouter();
  const cancelled = b.status === 'cancelled';
  return (
    <Card gap={10}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${b.serviceName} · ${b.salon.name}`}
        onPress={() => router.push(`/rdv/${b.id}` as never)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}
      >
        <DateBlock iso={b.startsAt} muted={cancelled} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx
            size={13.5}
            weight={700}
            ls={-0.3}
            lh={17.5}
            numberOfLines={1}
            color={cancelled ? C.muted : C.text}
          >
            {b.salon.name}
          </Tx>
          <Tx size={12} color={C.muted} lh={16}>
            {formatTimeDZ(b.startsAt)} · {b.serviceName}
          </Tx>
          <Tx size={12} weight={600} lh={16}>
            {formatDA(b.priceDa)}
          </Tx>
        </View>
        <StatusBadge status={b.status} md cancelledBy={b.cancelledBy} kind={b.cancellationKind} />
      </Pressable>
      {cancelled && !!b.cancellationReason && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5 }}>
          <I icon={Info} size={13} color={C.danger} />
          <Tx size={11.5} color={C.danger} lh={15} style={{ flex: 1 }}>
            Motif : {b.cancellationReason}
          </Tx>
        </View>
      )}
      {(b.status === 'completed' || cancelled) && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Button
            variant="g"
            sm
            style={{ flex: 1, paddingVertical: 15 }}
            onPress={() => router.push(`/s/${b.salon.slug}/prestations` as never)}
          >
            <I icon={RotateCcw} size={14} />
            <ActionLabel>Réserver à nouveau</ActionLabel>
          </Button>
          {b.status === 'completed' &&
            (b.reviewRating != null ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 10,
                }}
                accessibilityLabel={`Votre note : ${b.reviewRating} sur 5`}
              >
                <I icon={Star} size={15} color={C.text} />
                <Tx size={13} weight={700} lh={16}>
                  {b.reviewRating}/5
                </Tx>
              </View>
            ) : (
              <Button
                variant="g"
                sm
                auto
                style={{ paddingHorizontal: 18, paddingVertical: 15 }}
                onPress={() => router.push(`/rdv/${b.id}/noter` as never)}
              >
                <I icon={Star} size={14} />
                <ActionLabel>Noter</ActionLabel>
              </Button>
            ))}
        </View>
      )}
    </Card>
  );
}

const EMPTY: Record<Scope, { icon: typeof CalendarClock; title: string; text: string }> = {
  upcoming: {
    icon: CalendarClock,
    title: 'Aucun rendez-vous à venir',
    text: 'Réservez en quelques secondes dans le salon de votre choix.',
  },
  past: {
    icon: History,
    title: 'Aucun rendez-vous passé',
    text: 'Vos rendez-vous terminés apparaîtront ici.',
  },
  cancelled: {
    icon: CalendarX,
    title: 'Aucun rendez-vous annulé',
    text: 'Tant mieux : rien d’annulé pour le moment.',
  },
};

export default function Bookings() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ scope?: string }>();
  const [scope, setScope] = useState<Scope>(
    params.scope === 'past' ? 'past' : params.scope === 'cancelled' ? 'cancelled' : 'upcoming',
  );
  useEffect(() => {
    if (params.scope === 'past' || params.scope === 'upcoming' || params.scope === 'cancelled')
      setScope(params.scope);
  }, [params.scope]);
  const list = useMyBookingsInfinite({ scope });
  useRealtimeMyBookings(user?.id);
  const items = pagesItems(list.data);
  const now = useNow();
  const empty = EMPTY[scope];

  return (
    <Screen
      gap={13}
      bottom={NAV_PAD}
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}
    >
      <H1 size={23} lh={26} ls={-0.8}>
        Rendez-vous
      </H1>
      <Segmented
        label="Période"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'upcoming', label: 'À venir', icon: CalendarClock },
          { value: 'past', label: 'Passés', icon: History },
          { value: 'cancelled', label: 'Annulés', icon: CalendarX },
        ]}
      />
      {list.isPending ? (
        <>
          <Skeleton h={170} radius={16} />
          <Skeleton h={98} radius={16} />
        </>
      ) : list.isError ? (
        <ErrorText error={list.error} retry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingTop: 40 }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: C.fill,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <I icon={empty.icon} size={25} color={C.muted} />
          </View>
          <Tx size={14.5} weight={700} lh={18.5} center>
            {empty.title}
          </Tx>
          <P center>{empty.text}</P>
          <Button onPress={() => router.push('/(client)/(tabs)')} style={{ marginTop: 6 }}>
            <I icon={Search} size={15} color={C.onInk} />
            <Tx size={13} weight={600} color={C.onInk} lh={17}>
              Explorer les salons
            </Tx>
          </Button>
        </View>
      ) : scope === 'upcoming' ? (
        items.map((b) => <UpcomingCard key={b.id} b={b} now={now} />)
      ) : (
        items.map((b) => <HistoryCard key={b.id} b={b} />)
      )}
      <LoadMore
        hasMore={list.hasNextPage}
        loading={list.isFetchingNextPage}
        onMore={() => void list.fetchNextPage()}
        label="Voir plus de rendez-vous"
      />
    </Screen>
  );
}
