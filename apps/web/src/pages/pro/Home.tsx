/** PRO-F 22 — Accueil professionnel : « Votre journée », à valider, prochains, chiffre d'affaires. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, MessageCircle, Phone, Plus, Share2 } from 'lucide-react';
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
import { formatDuration } from '@/lib/format';
import { Avatar, Button, I, Skeleton, StatusBadge } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { StaffFilter } from '@/components/StaffFilter';
import { QuickCloseBanner, QuickCloseButton } from '@/components/QuickClose';
import { useStaffFilter } from '@/lib/proPrefs';
import { ShareSheet, usePublicUrl } from './Link';

/** Heure courante rafraîchie chaque minute (« dans 25 min », « en cours »). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
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
  const now = useNow();
  const [share, setShare] = useState(false);
  const link = usePublicUrl(salon?.slug ?? '');
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
    <Screen bottom={NAV_PAD} gap={16}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.9375rem] text-muted">Bonjour, {firstName}</div>
          <h1 className="h1">Votre journée</h1>
        </div>
        {/* « Arrêt / Pause » en icône, entre le titre et le logo. */}
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

      {stats.isPending ? (
        <Skeleton className="h-[8.75rem] w-full !rounded-[1.25rem]" />
      ) : stats.isError ? (
        <ErrorMessage error={stats.error} retry={() => stats.refetch()} />
      ) : (
        /* Deux chiffres, pas trois : le prévisionnel du jour est déjà dans « Chiffre d'affaires ». */
        <div className="g2">
          <div className="crd !gap-1 !bg-ink !px-5 !py-6 !text-white">
            <span className="text-[2rem] font-bold leading-none tracking-[-0.8px]">
              {stats.data.todayCount}
            </span>
            <span className="text-[0.875rem] text-white/70">rendez-vous aujourd'hui</span>
          </div>
          <Link
            to="/pro/reservations"
            className="crd !gap-1 !px-5 !py-6"
            aria-label="Demandes à valider"
          >
            <span
              className={`text-[2rem] font-bold leading-none tracking-[-0.8px] ${stats.data.pendingCount ? 'text-pending-fg' : ''}`}
            >
              {stats.data.pendingCount}
            </span>
            <span className="text-[0.875rem] text-muted">à valider</span>
          </Link>
        </div>
      )}

      {salon && <QuickCloseBanner />}

      <Button onClick={() => navigate('/pro/rendez-vous/nouveau')}>
        <I icon={Plus} size={18} /> Nouveau rendez-vous
      </Button>

      {pendingItems.length > 0 && (
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
      )}
      {pendingItems.length > 0 &&
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
        ))}

      <div className="flex items-center justify-between">
        <span className="h3">Prochains</span>
        <Link to="/pro/agenda" className="text-[0.8125rem] text-muted">
          Tout voir
        </Link>
      </div>
      {todayList.isPending && <Skeleton className="h-[9rem] w-full !rounded-[1.25rem]" />}
      {!todayList.isPending && !next && (
        <div className="crd">
          <p className="p">
            {passed
              ? `Journée terminée · ${passed} rendez-vous ${passed > 1 ? 'passés' : 'passé'} aujourd'hui.`
              : 'Aucun rendez-vous aujourd’hui.'}
          </p>
        </div>
      )}
      {next && (
        /* Le prochain (ou celui en cours) en grand : heure, client, prestations, prix, membre — l'essentiel d'un coup d'œil. */
        <div className={`crd !gap-3 ${inProgress ? '!border-ok-fg !bg-ok-bg' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <span
              className={`text-[0.75rem] font-bold uppercase tracking-[0.08em] ${inProgress ? 'text-ok-fg' : 'text-muted'}`}
            >
              {inProgress
                ? `En cours · fin à ${formatTimeDZ(next.endsAt)}`
                : `Prochain · ${untilLabelFR(next.startsAt, now)}`}
            </span>
            <StatusBadge status={next.status} md />
          </div>
          <button
            type="button"
            className="flex items-end justify-between gap-3 text-left"
            onClick={() => navigate(`/pro/rendez-vous/${next.id}`)}
            aria-label={`Ouvrir le rendez-vous de ${next.clientName}`}
          >
            <span className="mono text-[2.25rem] font-bold leading-none tracking-[-1px]">
              {formatTimeDZ(next.startsAt)}
              <span className="ml-1 text-[1rem] font-medium tracking-normal text-muted">
                → {formatTimeDZ(next.endsAt)}
              </span>
            </span>
            <span className="text-[1.5rem] font-bold leading-none tracking-[-0.5px]">
              {formatDA(next.priceDa)}
            </span>
          </button>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => navigate(`/pro/rendez-vous/${next.id}`)}
            >
              <span className="block truncate text-[1.375rem] font-bold tracking-[-0.4px]">
                {next.clientName}
              </span>
              <span className="block text-[1rem] text-muted">
                {next.serviceName} · {formatDuration(next.durationMinutes)}
                {next.staff?.displayName ? ` · ${next.staff.displayName}` : ''}
              </span>
            </button>
            {next.clientPhone && (
              <span className="flex flex-none gap-2">
                <a
                  href={`tel:${next.clientPhone}`}
                  className="ib"
                  aria-label={`Appeler ${next.clientName}`}
                >
                  <I icon={Phone} size={18} />
                </a>
                <a
                  href={`https://wa.me/${next.clientPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ib"
                  aria-label={`WhatsApp ${next.clientName}`}
                >
                  <I icon={MessageCircle} size={18} />
                </a>
              </span>
            )}
          </div>
        </div>
      )}
      {upcoming.length > 1 && (
        <div className="crd !gap-0 !py-1">
          {upcoming.slice(1, 6).map((b) => (
            <button
              key={b.id}
              type="button"
              className="li w-full !py-4 text-left"
              onClick={() => navigate(`/pro/rendez-vous/${b.id}`)}
            >
              <span className="flex min-w-0 items-center gap-4">
                <span className="mono w-[4.25rem] flex-none text-[1.25rem] font-bold tracking-[-0.5px]">
                  {formatTimeDZ(b.startsAt)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[1.125rem] font-bold tracking-[-0.3px]">
                    {b.clientName}
                  </span>
                  <span className="block text-[0.9375rem] text-muted">
                    {b.serviceName} · {formatDuration(b.durationMinutes)}
                    {!staffId && b.staff?.displayName ? ` · ${b.staff.displayName}` : ''}
                  </span>
                </span>
              </span>
              <span className="flex flex-none flex-col items-end gap-1">
                <span className="text-[1rem] font-bold">{formatDA(b.priceDa)}</span>
                <StatusBadge status={b.status} />
              </span>
            </button>
          ))}
          {upcoming.length > 6 && (
            <Link to="/pro/agenda" className="li w-full !py-3 text-[0.9375rem] text-muted">
              + {upcoming.length - 6} autres aujourd'hui
            </Link>
          )}
        </div>
      )}
      {next && passed > 0 && (
        <p className="s -mt-2">
          {passed} rendez-vous déjà {passed > 1 ? 'passés' : 'passé'} aujourd'hui.
        </p>
      )}

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
      {/* Partage du lien de réservation : tout en bas, après le chiffre d'affaires. */}
      {salon && (
        <Button variant="g" onClick={() => setShare(true)}>
          <I icon={Share2} size={18} /> Partager mon lien
        </Button>
      )}
      {share && salon && (
        <ShareSheet
          name={salon.name}
          url={link.url}
          short={link.short}
          logo={salon.logoUrl}
          onClose={() => setShare(false)}
        />
      )}
    </Screen>
  );
}
