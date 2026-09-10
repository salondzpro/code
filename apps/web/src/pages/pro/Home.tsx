/** PRO-F 22 — Accueil professionnel : « Votre journée », à valider, prochains, chiffre d'affaires. */
import { Link, useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';
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
import { formatDuration } from '@/lib/format';
import { Avatar, Button, I, Skeleton, StatusBadge } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { StaffFilter } from '@/components/StaffFilter';
import { QuickCloseBanner, QuickCloseButton } from '@/components/QuickClose';
import { useStaffFilter } from '@/lib/proPrefs';

/** « 9,4k » pour les gros montants du bandeau (design). */
function compactDA(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace('.', ',')}k`;
  return String(n);
}

export function ProHome() {
  const navigate = useNavigate();
  const me = useMe();
  const salon = useProSalon().data?.salon ?? null;
  const stats = useProStats();
  const pending = useProPendingBookings();
  const today = toLocalDateKey();
  const todayList = useProBookings({ from: today, to: today, limit: 50 });
  const { setStatus } = useProBookingMutations();
  const [staffId, setStaffId] = useStaffFilter();
  const byStaff = <T extends { staffId: string | null }>(list: T[]) =>
    staffId ? list.filter((b) => b.staffId === staffId) : list;
  useRealtimeBookings(salon?.id);
  const firstName = (me.data?.profile.fullName ?? salon?.name ?? '').split(' ')[0];
  const now = Date.now();
  const upcoming = byStaff(todayList.data?.items ?? [])
    .filter((b) => b.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const pendingItems = byStaff(pending.data?.items ?? []);
  const staffName = salon?.staff.find((m) => m.id === staffId)?.displayName ?? null;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.9375rem] text-muted">Bonjour, {firstName}</div>
          <h1 className="h1">Votre journée</h1>
        </div>
        {/* « Fermer / Pause » en icône, entre le titre et le logo. */}
        <div className="flex items-center gap-3">
          {salon && <QuickCloseButton openingHours={salon.openingHours} />}
          <Link to="/pro/profil" aria-label="Profil">
            <Avatar
              src={salon?.logoUrl ?? me.data?.profile.avatarUrl}
              name={firstName || 'Pro'}
              size={56}
            />
          </Link>
        </div>
      </div>

      {salon && <StaffFilter staff={salon.staff} value={staffId} onChange={setStaffId} />}
      {staffName && (
        <p className="s">Vue de {staffName} : demandes et rendez-vous qui lui sont affectés.</p>
      )}

      {stats.isPending ? (
        <Skeleton className="h-[8.75rem] w-full !rounded-[1.25rem]" />
      ) : stats.isError ? (
        <ErrorMessage error={stats.error} retry={() => stats.refetch()} />
      ) : (
        <div className="g3">
          <div className="crd !gap-1 !bg-ink !px-5 !py-6 !text-white">
            <span className="text-[1.75rem] font-bold leading-none tracking-[-0.8px]">
              {stats.data.todayCount}
            </span>
            <span className="text-[0.8125rem] text-white/70">rendez-vous</span>
          </div>
          <div className="crd !gap-1 !px-5 !py-6">
            <span
              className={`text-[1.75rem] font-bold leading-none tracking-[-0.8px] ${stats.data.pendingCount ? 'text-pending-fg' : ''}`}
            >
              {stats.data.pendingCount}
            </span>
            <span className="text-[0.8125rem] text-muted">en attente</span>
          </div>
          <div className="crd !gap-1 !px-5 !py-6">
            <span className="text-[1.75rem] font-bold leading-none tracking-[-0.8px]">
              {compactDA(stats.data.todayRevenueDa)}
            </span>
            <span className="text-[0.8125rem] text-muted">DA prévu</span>
          </div>
        </div>
      )}

      {salon && <QuickCloseBanner />}

      <div className="flex items-center justify-between">
        <span className="h3">À valider</span>
        <Link
          to="/pro/reservations"
          className="text-[0.9375rem] font-bold"
          aria-label="Voir toutes les demandes"
        >
          {pendingItems.length}
        </Link>
      </div>
      {pendingItems.length ? (
        pendingItems.slice(0, 3).map((b) => (
          <div key={b.id} className="crd !gap-4">
            <button
              type="button"
              className="flex items-center gap-3.5 text-left"
              onClick={() => navigate(`/pro/rendez-vous/${b.id}`)}
            >
              <Avatar name={b.clientName} size={68} />
              <span className="min-w-0">
                <span className="block text-[1.25rem] font-bold tracking-[-0.4px]">
                  {b.clientName}
                </span>
                <span className="block text-[0.8125rem] text-muted">
                  {b.serviceName} · {formatTimeDZ(b.startsAt)} · {formatDA(b.priceDa)}
                </span>
              </span>
            </button>
            <div className="g2">
              <Button
                sm
                className="!py-[1.125rem] !text-[0.875rem]"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}
              >
                Confirmer
              </Button>
              <Button
                variant="g"
                sm
                className="!py-[1.125rem] !text-[0.875rem]"
                onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}
              >
                Reporter
              </Button>
            </div>
          </div>
        ))
      ) : (
        <p className="p">Aucune demande en attente.</p>
      )}

      <div className="flex items-center justify-between">
        <span className="h3">Prochains</span>
        <Link to="/pro/agenda" className="text-[0.8125rem] text-muted">
          Tout voir
        </Link>
      </div>
      <div className="crd !gap-0 !py-1">
        {todayList.isPending && <Skeleton className="my-3 h-16 w-full" />}
        {upcoming.length === 0 && !todayList.isPending && <p className="p py-3">Journée libre.</p>}
        {upcoming.slice(0, 6).map((b) => (
          <button
            key={b.id}
            type="button"
            className="li w-full !py-4 text-left"
            onClick={() => navigate(`/pro/rendez-vous/${b.id}`)}
          >
            <span className="flex items-center gap-4">
              <span className="mono w-[3.75rem] flex-none text-[0.9375rem] font-bold">
                {formatTimeDZ(b.startsAt)}
              </span>
              <span>
                <span
                  className={`block text-[1.0625rem] font-bold tracking-[-0.3px] ${new Date(b.endsAt).getTime() < now ? 'text-muted' : ''}`}
                >
                  {b.clientName}
                </span>
                <span className="block text-[0.8125rem] text-muted">
                  {b.serviceName} · {formatDuration(b.durationMinutes)}
                  {!staffId && b.staff?.displayName ? ` · ${b.staff.displayName}` : ''}
                </span>
              </span>
            </span>
            <StatusBadge status={b.status} md />
          </button>
        ))}
      </div>

      <Link to="/pro/chiffre-affaires" className="crd !gap-4">
        <span className="flex items-center justify-between">
          <span className="h3">Chiffre d'affaires</span>
          <I icon={ChevronRight} size={20} className="text-disabled" />
        </span>
        <span className="grid grid-cols-3 divide-x divide-line">
          {[
            { v: stats.data?.todayRevenueDa ?? 0, l: "aujourd'hui" },
            { v: stats.data?.weekRevenueDa ?? 0, l: 'cette semaine' },
            { v: stats.data?.monthRevenueDa ?? 0, l: 'ce mois' },
          ].map((x, i) => (
            <span key={x.l} className={`flex flex-col ${i ? 'pl-4' : ''}`}>
              <span className="whitespace-nowrap text-[1.125rem] font-bold tracking-[-0.4px]">
                {x.v.toLocaleString('fr-DZ').replace(/ /g, ' ')}{' '}
                <span className="text-[0.875rem] font-semibold text-muted">DA</span>
              </span>
              <span className="text-[0.9375rem] text-muted">{x.l}</span>
            </span>
          ))}
        </span>
      </Link>
    </Screen>
  );
}
