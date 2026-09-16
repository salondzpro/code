/**
 * Notifications (client et pro) : la boîte de réception des faits du moment. Groupées par jour, une icône
 * par type, point tant que non lue, heure courte ; toucher une ligne ouvre le rendez-vous concerné.
 * Tout est marqué lu à l'ouverture : une notification est vue, pas archivée (purge par le cron).
 */
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Bell,
  BellOff,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  Inbox,
  Settings2,
  Star,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { pagesItems, useMarkNotificationsRead, useNotificationsInfinite } from '@salondz/api-client';
import {
  addDaysToKey,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
  type NotificationType,
} from '@salondz/constants';
import type { Notification } from '@salondz/types';
import { LoadMore } from '@/components/LoadMore';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState, I, IconButton, SectionLabel, Skeleton } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { t } from '@/i18n';

/** Une icône par type : le pro ou la cliente reconnaît la nature de l'événement avant de lire. */
const KIND: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  booking_created: { icon: CalendarPlus, tone: 'bg-fill text-ink' },
  booking_confirmed: { icon: CalendarCheck, tone: 'bg-ok/10 text-ok' },
  booking_cancelled: { icon: CalendarX, tone: 'bg-danger/10 text-danger' },
  booking_rescheduled: { icon: CalendarClock, tone: 'bg-fill text-ink' },
  booking_reminder: { icon: Bell, tone: 'bg-fill text-ink' },
  booking_completed: { icon: Star, tone: 'bg-fill text-ink' },
  booking_no_show: { icon: UserX, tone: 'bg-danger/10 text-danger' },
  slot_freed: { icon: BellRing, tone: 'bg-ok/10 text-ok' },
  request_pending: { icon: Inbox, tone: 'bg-danger/10 text-danger' },
};

export function AccountNotifications() {
  const navigate = useNavigate();
  const isPro = useLocation().pathname.startsWith('/pro');
  const notifs = useNotificationsInfinite();
  const items = pagesItems(notifs.data);
  const unreadCount = notifs.data?.pages[0]?.unreadCount ?? 0;
  const markRead = useMarkNotificationsRead();

  // Les points « non lu » restent visibles le temps de la visite, même une fois tout marqué lu.
  const unseen = useRef<Set<string> | null>(null);
  if (unseen.current === null && notifs.data) {
    unseen.current = new Set(items.filter((n) => !n.readAt).map((n) => n.id));
  }

  useEffect(() => {
    if (unreadCount > 0 && !markRead.isPending && !markRead.isSuccess) markRead.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  const today = toLocalDateKey();
  const days: [string, Notification[]][] = [];
  for (const n of items) {
    const key = toLocalDateKey(new Date(n.createdAt));
    const last = days[days.length - 1];
    if (last && last[0] === key) last[1].push(n);
    else days.push([key, [n]]);
  }
  const open = (n: Notification) => {
    // Créneau libéré : vers la réservation du salon, le jour concerné.
    const url = typeof n.data?.url === 'string' ? n.data.url : null;
    if (n.type === 'slot_freed' && url) return navigate(url);
    if (!n.bookingId) return;
    navigate(`${isPro ? '/pro' : ''}/rendez-vous/${n.bookingId}`);
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="h1">{t("Notifications")}</h1>
        <IconButton
          lg
          aria-label={t("Réglages des notifications")}
          onClick={() => navigate(isPro ? '/pro/compte' : '/reglages#notifications')}
        >
          <I icon={Settings2} size={20} />
        </IconButton>
      </div>

      {notifs.isPending && (
        <>
          <Skeleton className="h-[4.5rem] w-full !rounded-[var(--radius-card)]" />
          <Skeleton className="h-[4.5rem] w-full !rounded-[var(--radius-card)]" />
          <Skeleton className="h-[4.5rem] w-full !rounded-[var(--radius-card)]" />
        </>
      )}
      {notifs.isError && <ErrorMessage error={notifs.error} retry={() => notifs.refetch()} />}

      {notifs.data && items.length === 0 && (
        <EmptyState
          icon={BellOff}
          title={t("Rien pour le moment")}
          description={
            isPro
              ? t("Les demandes, confirmations et annulations de vos clients apparaîtront ici.")
              : t("Vos confirmations et rappels apparaîtront ici.")
          }
        />
      )}

      {days.map(([key, list]) => (
        <div key={key} className="flex flex-col gap-3">
          <SectionLabel>{key === addDaysToKey(today, -1) ? t("Hier") : relativeDayLabelDZ(key, today)}</SectionLabel>
          <div className="crd !gap-0 !py-1">
            {list.map((n) => {
              const k = KIND[n.type] ?? KIND.booking_reminder;
              const fresh = !n.readAt || unseen.current?.has(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  className="li w-full text-left"
                  onClick={() => open(n)}
                  disabled={!n.bookingId && !(n.type === 'slot_freed' && typeof n.data?.url === 'string')}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={`relative flex h-11 w-11 flex-none items-center justify-center rounded-full ${k.tone}`}>
                      <I icon={k.icon} size={20} />
                      {fresh && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-danger" aria-label={t("Non lue")} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[1rem] ${fresh ? 'font-semibold' : 'font-medium'}`}>{n.title}</span>
                      <span className="block truncate text-[0.857rem] text-muted">{n.body}</span>
                    </span>
                  </span>
                  <time className="flex-none text-[0.857rem] text-subtle" dateTime={n.createdAt}>
                    {formatTimeDZ(n.createdAt)}
                  </time>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <LoadMore
        hasMore={notifs.hasNextPage}
        loading={notifs.isFetchingNextPage}
        onMore={() => void notifs.fetchNextPage()}
        label={t("Voir plus de notifications")}
      />
    </Screen>
  );
}
