import { useEffect } from 'react';
import { pagesItems, useMarkNotificationsRead, useNotificationsInfinite } from '@salondz/api-client';
import { LoadMore } from '@/components/LoadMore';
import { formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';

export function AccountNotifications() {
  const notifs = useNotificationsInfinite();
  const items = pagesItems(notifs.data);
  const unreadCount = notifs.data?.pages[0]?.unreadCount ?? 0;
  const markRead = useMarkNotificationsRead();

  // Marque tout lu à l'ouverture (une seule fois par chargement)
  useEffect(() => {
    if (unreadCount > 0 && !markRead.isPending && !markRead.isSuccess) markRead.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  if (notifs.isPending) return <Spinner />;
  if (notifs.isError) return <ErrorMessage error={notifs.error} retry={() => notifs.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Notifications</h1>
      {items.length === 0 ? (
        <EmptyState title="Rien pour le moment" description="Vos confirmations et rappels apparaîtront ici." />
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((n) => (
            <li key={n.id} className={`flex flex-col gap-0.5 p-4 ${n.readAt ? '' : 'bg-primary/5'}`}>
              <p className="font-medium">{n.title}</p>
              <p className="text-sm text-muted">{n.body}</p>
              <time className="text-xs text-muted" dateTime={n.createdAt}>
                {formatDateShortDZ(n.createdAt)} · {formatTimeDZ(n.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
      <LoadMore hasMore={notifs.hasNextPage} loading={notifs.isFetchingNextPage} onMore={() => void notifs.fetchNextPage()} label="Voir plus de notifications" />
    </div>
  );
}
