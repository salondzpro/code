/**
 * Espace pro — Clients : liste (compte, sinon numéro, sinon nom) calculée en base ; chaque ligne ouvre la fiche
 * client complète (/pro-client/[key]) : compteurs, notes privées, historique, blocage.
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useProClients, useProSalon } from '@salondz/api-client';
import { formatDZPhone, formatDateShortDZ } from '@salondz/constants';
import { Avatar, Badge, H1, I, ListCard, P, Row, SearchBox, Skeleton, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, NAV_PAD } from '@/theme/design';

export default function Clients() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const clients = useProClients();
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const list = clients.data?.items ?? [];
    const needle = q.trim().toLowerCase();
    return needle ? list.filter((c) => c.name.toLowerCase().includes(needle) || (c.phone ?? '').includes(needle.replace(/\s/g, ''))) : list;
  }, [clients.data, q]);
  const blockedCount = (clients.data?.items ?? []).filter((c) => c.blocked).length;

  if (!salon) return <Splash />;

  return (
    <Screen gap={13} bottom={NAV_PAD}>
      <H1 size={23} lh={26} ls={-0.8}>
        Clients
      </H1>
      <SearchBox value={q} onChange={setQ} placeholder="Nom ou téléphone" />
      <Tx size={10.5} color={C.muted} lh={14.5}>
        {rows.length} client{rows.length > 1 ? 's' : ''}
        {blockedCount ? ` · ${blockedCount} bloqué${blockedCount > 1 ? 's' : ''}` : ''}
      </Tx>
      {clients.isPending ? (
        <Skeleton h={162} radius={16} />
      ) : rows.length === 0 ? (
        <P>Vos clients apparaîtront ici après leur premier rendez-vous.</P>
      ) : (
        <ListCard>
          {rows.map((c) => (
            <Row key={c.clientKey} py={13} onPress={() => router.push({ pathname: '/pro-client/[key]', params: { key: c.clientKey } } as never)} accessibilityLabel={c.name} chevron={false} right={<I icon={ChevronRight} size={14.5} color={C.disabled} />}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <Avatar name={c.name} size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Tx size={13} weight={700} ls={-0.3} lh={17} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {c.name}
                    </Tx>
                    {c.blocked && (
                      <Badge tone="cn" dot={false}>
                        Bloqué
                      </Badge>
                    )}
                  </View>
                  <Tx size={12} color={C.muted} lh={16}>
                    {c.phone ? `${formatDZPhone(c.phone)} · ` : ''}
                    {c.bookingsCount} rendez-vous
                    {c.noShowCount ? ` · ${c.noShowCount} absence${c.noShowCount > 1 ? 's' : ''}` : ''}
                    {c.nextAt ? ` · prochain ${formatDateShortDZ(c.nextAt)}` : c.lastAt ? ` · dernier ${formatDateShortDZ(c.lastAt)}` : ''}
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
