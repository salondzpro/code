/**
 * C-F 14 — Rendez-vous à venir ; C-F 19 — Rendez-vous passés / annulés.
 * Pensé pour un coup d'œil : le prochain rendez-vous en grand (jour, « dans 55 min », heure, prix, salon, adresse),
 * une icône sur chaque onglet et chaque action (Itinéraire, Reporter, Appeler, Réserver à nouveau, Noter).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { pagesItems, useMyBookingsInfinite } from '@salondz/api-client';
import { LoadMore } from '@/components/LoadMore';
import {
  formatDA,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
  untilLabelFR,
} from '@salondz/constants';
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
} from 'lucide-react';
import { I, Img, LinkButton, Segmented, Skeleton, StatusBadge } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import type { BookingWithSalon } from '@salondz/types';

export function directionsUrl(b: BookingWithSalon): string {
  const q = [b.salon.name, b.salon.address, b.salon.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

type Scope = 'upcoming' | 'past' | 'cancelled';
const DZ = 'Africa/Algiers';
const dayNum = (iso: string) =>
  new Intl.DateTimeFormat('fr-DZ', { day: 'numeric', timeZone: DZ }).format(new Date(iso));
const monthShort = (iso: string) =>
  new Intl.DateTimeFormat('fr-DZ', { month: 'short', timeZone: DZ }).format(new Date(iso));
const weekday = (iso: string) =>
  new Intl.DateTimeFormat('fr-DZ', { weekday: 'short', timeZone: DZ }).format(new Date(iso));

/** Heure courante rafraîchie chaque minute (« dans 25 min »). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/** Pavé date (jour en grand, mois, jour de semaine) des rendez-vous passés / annulés. */
function DateBlock({ iso, muted }: { iso: string; muted?: boolean }) {
  return (
    <span
      className={`flex w-[3.75rem] flex-none flex-col items-center rounded-[0.875rem] bg-fill py-2 ${muted ? 'text-muted' : ''}`}
    >
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">
        {weekday(iso).replace('.', '')}
      </span>
      <span className="text-[1.5rem] font-bold leading-none tracking-[-0.5px]">{dayNum(iso)}</span>
      <span className="text-[0.75rem] text-muted">{monthShort(iso).replace('.', '')}</span>
    </span>
  );
}

function UpcomingCard({ b, now }: { b: BookingWithSalon; now: number }) {
  const navigate = useNavigate();
  const active = b.status === 'pending' || b.status === 'confirmed';
  const dayKey = toLocalDateKey(new Date(b.startsAt));
  const today = dayKey === toLocalDateKey();
  const started = new Date(b.startsAt).getTime() <= now;
  const open = () => navigate(`/rendez-vous/${b.id}`);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      className={`crd !gap-3 cursor-pointer ${today && active ? '!border-ink' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span
            className={`block text-[1.125rem] font-bold tracking-[-0.4px] ${active ? '' : 'text-muted'}`}
          >
            {relativeDayLabelDZ(dayKey)}
          </span>
          {today && active && (
            <span className="block text-[0.8125rem] font-semibold text-ok-fg">
              {started ? 'En cours' : untilLabelFR(b.startsAt, now)}
            </span>
          )}
        </span>
        <StatusBadge status={b.status} md cancelledBy={b.cancelledBy} kind={b.cancellationKind} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <span
          className={`mono text-[2.25rem] font-bold leading-none tracking-[-1px] ${active ? '' : 'text-muted'}`}
        >
          {formatTimeDZ(b.startsAt)}
          <span className="ml-1 text-[1rem] font-medium tracking-normal text-muted">
            → {formatTimeDZ(b.endsAt)}
          </span>
        </span>
        <span className="text-[1.375rem] font-bold leading-none tracking-[-0.5px]">
          {formatDA(b.priceDa)}
        </span>
      </div>
      <div className="flex items-center gap-3.5">
        <Img
          src={b.salon.coverUrl}
          className={`h-[4.5rem] w-[4.5rem] flex-none !rounded-[0.875rem] ${active ? '' : 'opacity-60'}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.0625rem] font-bold tracking-[-0.3px]">
            {b.salon.name}
          </span>
          <span className="block text-[0.9375rem] text-muted">
            {b.serviceName}
            {b.staff?.displayName ? ` · avec ${b.staff.displayName}` : ''}
          </span>
          {(b.salon.address || b.salon.city) && (
            <span className="mt-0.5 flex items-center gap-1 text-[0.8125rem] text-muted">
              <I icon={MapPin} size={13} />
              <span className="truncate">
                {[b.salon.address, b.salon.city].filter(Boolean).join(', ')}
              </span>
            </span>
          )}
        </span>
      </div>
      {active && (
        <div className="flex gap-2" onClick={stop} onKeyDown={stop} role="presentation">
          <a
            href={directionsUrl(b)}
            target="_blank"
            rel="noreferrer"
            className="btn g sm flex-1 !py-[1.125rem] !text-[0.9375rem]"
          >
            <I icon={Navigation} size={16} /> Itinéraire
          </a>
          {b.salon.allowClientReschedule !== false && (
            <LinkButton
              to={`/rendez-vous/${b.id}/reporter`}
              variant="g"
              sm
              className="flex-1 !py-[1.125rem] !text-[0.9375rem]"
            >
              <I icon={CalendarClock} size={16} /> Reporter
            </LinkButton>
          )}
          {b.salon.phone && (
            <a
              href={`tel:${b.salon.phone}`}
              className="ib lg flex-none"
              aria-label={`Appeler ${b.salon.name}`}
            >
              <I icon={Phone} size={18} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ b }: { b: BookingWithSalon }) {
  const navigate = useNavigate();
  const cancelled = b.status === 'cancelled';
  const open = () => navigate(`/rendez-vous/${b.id}`);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      className="crd !gap-3 cursor-pointer"
    >
      <div className="flex items-center gap-3.5">
        <DateBlock iso={b.startsAt} muted={cancelled} />
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[1.0625rem] font-bold tracking-[-0.3px] ${cancelled ? 'text-muted' : ''}`}
          >
            {b.salon.name}
          </span>
          <span className="block text-[0.9375rem] text-muted">
            <span className="mono">{formatTimeDZ(b.startsAt)}</span> · {b.serviceName}
          </span>
          <span className="block text-[0.9375rem] font-semibold">{formatDA(b.priceDa)}</span>
        </span>
        <StatusBadge status={b.status} md cancelledBy={b.cancelledBy} kind={b.cancellationKind} />
      </div>
      {cancelled && b.cancellationReason && (
        <p className="flex items-start gap-1.5 text-[0.875rem] text-danger">
          <I icon={Info} size={15} className="mt-0.5 flex-none" /> Motif : {b.cancellationReason}
        </p>
      )}
      {(b.status === 'completed' || cancelled) && (
        <div className="flex gap-2" onClick={stop} onKeyDown={stop} role="presentation">
          <LinkButton
            to={`/s/${b.salon.slug}/prestations`}
            variant="g"
            sm
            className="flex-1 !py-[1.125rem] !text-[0.9375rem]"
          >
            <I icon={RotateCcw} size={16} /> Réserver à nouveau
          </LinkButton>
          {b.status === 'completed' &&
            (b.reviewRating != null ? (
              <span
                className="flex items-center gap-1.5 self-center px-3 text-[1rem] font-bold"
                aria-label={`Votre note : ${b.reviewRating} sur 5`}
              >
                <I icon={Star} size={17} className="fill-current" /> {b.reviewRating}/5
              </span>
            ) : (
              <LinkButton
                to={`/rendez-vous/${b.id}/noter`}
                variant="g"
                sm
                auto
                className="!px-5 !py-[1.125rem] !text-[0.9375rem]"
              >
                <I icon={Star} size={16} /> Noter
              </LinkButton>
            ))}
        </div>
      )}
    </div>
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

export function Bookings() {
  const [params] = useSearchParams();
  const [scope, setScope] = useState<Scope>(
    params.get('scope') === 'past'
      ? 'past'
      : params.get('scope') === 'cancelled'
        ? 'cancelled'
        : 'upcoming',
  );
  const list = useMyBookingsInfinite({ scope });
  const items = pagesItems(list.data);
  const now = useNow();
  const empty = EMPTY[scope];

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <h1 className="h1">Rendez-vous</h1>
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
          <Skeleton className="h-[13rem] w-full !rounded-[1.25rem]" />
          <Skeleton className="h-[7.5rem] w-full !rounded-[1.25rem]" />
        </>
      ) : list.isError ? (
        <ErrorMessage error={list.error} retry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 pt-12 text-center">
          <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-fill text-muted">
            <I icon={empty.icon} size={30} />
          </span>
          <div className="text-[1.125rem] font-bold">{empty.title}</div>
          <p className="p">{empty.text}</p>
          <LinkButton to="/" className="mt-2">
            <I icon={Search} size={18} /> Explorer les salons
          </LinkButton>
        </div>
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
