/** Espace pro — Notifications (demandes, confirmations, annulations) ; marquées lues à l'ouverture. */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { pagesItems, useMarkNotificationsRead, useNotificationsInfinite } from '@salondz/api-client';
import { LoadMore } from '@/ui/LoadMore';
import { formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import { EmptyState, ErrorText, H1, ListCard, Row, Skeleton, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C } from '@/theme/design';

export default function ProNotifications() {
  const notifs = useNotificationsInfinite();
  const items = pagesItems(notifs.data);
  const unreadCount = notifs.data?.pages[0]?.unreadCount ?? 0;
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    if (unreadCount > 0 && !markRead.isPending && !markRead.isSuccess) markRead.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  return (
    <Screen gap={13}>
      <TopBar backTo="/compte" right="Compte" />
      <H1>Notifications</H1>
      {notifs.isPending ? (
        <Skeleton h={130} radius={16} />
      ) : notifs.isError ? (
        <ErrorText error={notifs.error} retry={() => void notifs.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="Rien pour le moment" description="Vos demandes, confirmations et annulations apparaîtront ici." />
      ) : (
        <ListCard>
          {items.map((n) => (
            <Row key={n.id} py={13} chevron={false}>
              <View style={{ gap: 2 }}>
                <Tx size={12} weight={n.readAt ? 400 : 600} lh={16}>
                  {n.title}
                </Tx>
                <Tx size={12} color={C.muted} lh={16}>
                  {n.body}
                </Tx>
                <Tx size={10} color={C.subtle} lh={13}>
                  {formatDateShortDZ(n.createdAt)} · {formatTimeDZ(n.createdAt)}
                </Tx>
              </View>
            </Row>
          ))}
        </ListCard>
      )}
      <LoadMore hasMore={notifs.hasNextPage} loading={notifs.isFetchingNextPage} onMore={() => void notifs.fetchNextPage()} label="Voir plus de notifications" />
    </Screen>
  );
}
