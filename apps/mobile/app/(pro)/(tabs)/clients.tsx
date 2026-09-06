/** Espace pro — Clients : liste déduite des rendez-vous (nom, téléphone, nombre de visites, dernière visite). */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useProBookings, useProSalon } from '@salondz/api-client';
import { addDaysToKey, formatDZPhone, formatDateShortDZ, toLocalDateKey } from '@salondz/constants';
import { Avatar, H1, ListCard, P, Row, SearchBox, Skeleton, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, NAV_PAD } from '@/theme/design';

interface ClientRow {
  key: string;
  name: string;
  phone: string | null;
  count: number;
  last: string;
  next: string | null;
  lastBookingId: string;
}

export default function Clients() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const bookings = useProBookings({ from: addDaysToKey(today, -365), to: addDaysToKey(today, 90), limit: 200 }, !!salon);
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const m = new Map<string, ClientRow>();
    const now = new Date().toISOString();
    for (const b of bookings.data?.items ?? []) {
      if (b.status === 'cancelled') continue;
      const key = b.clientPhone ?? b.clientId ?? b.clientName.toLowerCase();
      const cur = m.get(key);
      if (!cur) m.set(key, { key, name: b.clientName, phone: b.clientPhone, count: 1, last: b.startsAt, next: b.startsAt > now ? b.startsAt : null, lastBookingId: b.id });
      else {
        cur.count += 1;
        if (b.startsAt <= now && b.startsAt > cur.last) {
          cur.last = b.startsAt;
          cur.lastBookingId = b.id;
        }
        if (b.startsAt > now && (!cur.next || b.startsAt < cur.next)) cur.next = b.startsAt;
      }
    }
    const list = [...m.values()].sort((a, b) => b.last.localeCompare(a.last));
    const needle = q.trim().toLowerCase();
    return needle ? list.filter((c) => c.name.toLowerCase().includes(needle) || (c.phone ?? '').includes(needle.replace(/\s/g, ''))) : list;
  }, [bookings.data, q]);

  if (!salon) return <Splash />;

  return (
    <Screen gap={16} bottom={NAV_PAD}>
      <H1 size={34} lh={38} ls={-0.8}>
        Clients
      </H1>
      <SearchBox value={q} onChange={setQ} placeholder="Nom ou téléphone" />
      <Tx size={17} color={C.muted} lh={22}>
        {rows.length} client{rows.length > 1 ? 's' : ''} · 12 derniers mois
      </Tx>
      {bookings.isPending ? (
        <Skeleton h={200} radius={20} />
      ) : rows.length === 0 ? (
        <P>Vos clients apparaîtront ici après leur premier rendez-vous.</P>
      ) : (
        <ListCard>
          {rows.map((c) => (
            <Row key={c.key} py={16} onPress={() => router.push(`/pro-rdv/${c.lastBookingId}` as never)} accessibilityLabel={c.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Avatar name={c.name} size={52} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={20} weight={700} ls={-0.3} lh={25}>
                    {c.name}
                  </Tx>
                  <Tx size={15} color={C.muted} lh={20}>
                    {c.phone ? `${formatDZPhone(c.phone)} · ` : ''}
                    {c.count} rendez-vous · {c.next ? `prochain ${formatDateShortDZ(c.next)}` : `dernier ${formatDateShortDZ(c.last)}`}
                  </Tx>
                </View>
              </View>
            </Row>
          ))}
        </ListCard>
      )}
    </Screen>
  );
}
