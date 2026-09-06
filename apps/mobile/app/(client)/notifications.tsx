/** Notifications du compte : confirmations, rappels, reports ; marquées lues à l'ouverture. */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useMarkNotificationsRead, useNotifications } from '@salondz/api-client';
import { formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import { EmptyState, ErrorText, H1, ListCard, Row, Skeleton, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C } from '@/theme/design';

export default function Notifications() {
  const notifs = useNotifications();
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    if (notifs.data && notifs.data.unreadCount > 0 && !markRead.isPending && !markRead.isSuccess) markRead.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifs.data?.unreadCount]);

  return (
    <Screen gap={16}>
      <TopBar backTo="/(client)/(tabs)/profil" right="Notifications" />
      <H1>Notifications</H1>
      {notifs.isPending ? (
        <Skeleton h={160} radius={20} />
      ) : notifs.isError ? (
        <ErrorText error={notifs.error} retry={() => void notifs.refetch()} />
      ) : notifs.data.items.length === 0 ? (
        <EmptyState title="Rien pour le moment" description="Vos confirmations et rappels apparaîtront ici." />
      ) : (
        <ListCard>
          {notifs.data.items.map((n) => (
            <Row key={n.id} py={16} chevron={false}>
              <View style={{ gap: 2 }}>
                <Tx size={17} weight={n.readAt ? 400 : 600} lh={22}>
                  {n.title}
                </Tx>
                <Tx size={15} color={C.muted} lh={20}>
                  {n.body}
                </Tx>
                <Tx size={12} color={C.subtle} lh={16}>
                  {formatDateShortDZ(n.createdAt)} · {formatTimeDZ(n.createdAt)}
                </Tx>
              </View>
            </Row>
          ))}
        </ListCard>
      )}
    </Screen>
  );
}
