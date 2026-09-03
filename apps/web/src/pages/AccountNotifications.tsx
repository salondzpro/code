import { useEffect } from 'react';
import { useMarkNotificationsRead, useNotifications } from '@salondz/api-client';
import { formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';

export function AccountNotifications() {
  const notifs = useNotifications();
  const markRead = useMarkNotificationsRead();

  // Marque tout lu à l'ouverture (une seule fois par chargement)
  useEffect(() => {
    if (notifs.data && notifs.data.unreadCount > 0 && !markRead.isPending && !markRead.isSuccess) markRead.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifs.data?.unreadCount]);

  if (notifs.isPending) return <Spinner />;
  if (notifs.isError) return <ErrorMessage error={notifs.error} retry={() => notifs.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Notifications</h1>
      {notifs.data.items.length === 0 ? (
        <EmptyState title="Rien pour le moment" description="Vos confirmations et rappels apparaîtront ici." />
      ) : (
        <ul className="card divide-y divide-line">
          {notifs.data.items.map((n) => (
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
    </div>
  );
}
