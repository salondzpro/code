/**
 * C-F 14 — Rendez-vous à venir ; C-F 19 — Rendez-vous passés / annulés.
 * Pensé pour un coup d'œil : le prochain rendez-vous en grand (jour, « dans 55 min », heure, prix, salon, adresse),
 * une icône sur chaque onglet et chaque action (Itinéraire, Reporter, Appeler, Réserver à nouveau, Noter).
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { pagesItems, useMyBookingsInfinite } from '@salondz/api-client';
import { LoadMore } from '@/components/LoadMore';
import {
  formatDA,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
  untilLabelFR, formatLocale, MAX_CLIENT_RESCHEDULES, rescheduleMinHours } from '@salondz/constants';
import {
  CalendarClock,
  CalendarX,
  History,
  Info,
  Navigation,
  Phone,
  RotateCcw,
  Search,
  Star,
} from 'lucide-react';
import { EmptyState, I, Img, LinkButton, PageHead, Segmented, Skeleton, StatusBadge } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import type { BookingWithSalon } from '@salondz/types';
import { t } from '@/i18n';
import { MARCHE } from '@/lib/flavor';
import { cibleCarte, itineraireUrl } from '@/lib/maps';

/** Itinéraire vers le salon d'un rendez-vous : l'application de cartes du téléphone (`lib/maps.ts`). */
export function directionsUrl(b: BookingWithSalon): string {
  const lieu = b.salon as typeof b.salon & { lat?: number | null; lng?: number | null };
  return itineraireUrl({ name: lieu.name, address: lieu.address, city: lieu.city, lat: lieu.lat, lng: lieu.lng });
}

type Scope = 'upcoming' | 'past' | 'cancelled';
const DZ = 'Africa/Algiers';
const dayNum = (iso: string) =>
  new Intl.DateTimeFormat(formatLocale(), { day: 'numeric', timeZone: DZ }).format(new Date(iso));
const monthShort = (iso: string) =>
  new Intl.DateTimeFormat(formatLocale(), { month: 'short', timeZone: DZ }).format(new Date(iso));
const weekday = (iso: string) =>
  new Intl.DateTimeFormat(formatLocale(), { weekday: 'short', timeZone: DZ }).format(new Date(iso));

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
      className={`flex w-[3.75rem] flex-none flex-col items-center rounded-[var(--radius-card-sm)] bg-fill py-2 ${muted ? 'text-muted' : ''}`}
    >
      <span className="text-[0.857rem] font-semibold text-muted">
        {weekday(iso).replace('.', '')}
      </span>
      <span className="text-[1.714rem] font-semibold leading-none tracking-[-0.5px]">{dayNum(iso)}</span>
      <span className="text-[0.857rem] text-muted">{monthShort(iso).replace('.', '')}</span>
    </span>
  );
}

/** « Jeudi 20 novembre à 19:00 » — la ligne de tête d'une carte, comme Planity. */
function jourHeure(iso: string): string {
  const jour = new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date(iso));
  const txt = t('{jour} à {heure}', { jour, heure: formatTimeDZ(iso) });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
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
      className="pl-rdv cursor-pointer"
    >
      {/* FAÇON PLANITY (19 nov. 2026) : le jour et l'heure sur une ligne, le salon, la prestation • le
          prix ; boutons cerclés gris dessous. */}
      <div className="pl-rdv-top">
        <span className="min-w-0">
          <span className={`pl-rdv-quand${active ? '' : ' text-muted'}`}>
            {jourHeure(b.startsAt)}
          </span>
          {today && active && (
            <span className="block text-[1rem] font-medium text-ok-fg">
              {started ? 'En cours' : untilLabelFR(b.startsAt, now)}
            </span>
          )}
        </span>
        <StatusBadge status={b.status} md cancelledBy={b.cancelledBy} kind={b.cancellationKind} />
      </div>
      <div className="pl-rdv-mid">
        <Img src={b.salon.coverUrl} className={`pl-rdv-img${active ? '' : ' opacity-60'}`} />
        <span className="min-w-0 flex-1">
          <span className="pl-rdv-salon">{b.salon.name}</span>
          <span className="pl-rdv-sv" dir="auto">
            {b.serviceName}
            <span className="pl-dot" aria-hidden>•</span>
            <b dir="ltr">{formatDA(b.priceDa)}</b>
          </span>
        </span>
      </div>
      {active && (
        <div className="flex gap-2" onClick={stop} onKeyDown={stop} role="presentation">
          <a
            href={directionsUrl(b)}
            target={cibleCarte(directionsUrl(b))}
            rel="noreferrer"
            className="pl-btn pl-btn-out pl-btn-sm flex-1"
          >
            <I icon={Navigation} size={16} /> {t("Itinéraire")}
          </a>
          {/* Mêmes règles que la fiche : report autorisé, délai du salon respecté, un seul report en
              ligne. Sinon le bouton menait à un choix de créneau que le serveur refusait ensuite. */}
          {b.salon.allowClientReschedule !== false &&
            (new Date(b.startsAt).getTime() - Date.now()) / 3_600_000 >= rescheduleMinHours(b.salon.cancelMinHours) &&
            b.clientReschedules < MAX_CLIENT_RESCHEDULES && (
            <Link to={`/rendez-vous/${b.id}/reporter`} className="pl-btn pl-btn-out pl-btn-sm flex-1">
              <I icon={CalendarClock} size={16} /> {t("Déplacer le RDV")}
            </Link>
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
      className="pl-rdv cursor-pointer"
    >
      <div className="pl-rdv-top">
        <span className={`pl-rdv-quand${cancelled ? ' text-muted' : ''}`}>{jourHeure(b.startsAt)}</span>
        <StatusBadge status={b.status} md cancelledBy={b.cancelledBy} kind={b.cancellationKind} />
      </div>
      <div className="pl-rdv-mid">
        <span className="min-w-0 flex-1">
          <span className={`pl-rdv-salon${cancelled ? ' text-muted' : ''}`}>{b.salon.name}</span>
          <span className="pl-rdv-sv" dir="auto">
            {b.serviceName}
            <span className="pl-dot" aria-hidden>•</span>
            <b dir="ltr">{formatDA(b.priceDa)}</b>
          </span>
        </span>
      </div>
      {cancelled && b.cancellationReason && (
        <p className="flex items-start gap-1.5 text-[1rem] text-danger">
          <I icon={Info} size={16} className="mt-0.5 flex-none" /> {t("Motif :")}{' '}{b.cancellationReason}
        </p>
      )}
      {(b.status === 'completed' || cancelled) && (
        <div className="flex gap-2" onClick={stop} onKeyDown={stop} role="presentation">
          <Link to={`/s/${b.salon.slug}`} className="pl-btn pl-btn-out pl-btn-sm flex-1">
            <I icon={RotateCcw} size={16} /> {t("Réserver à nouveau")}
          </Link>
          {b.status === 'completed' &&
            (b.reviewRating != null ? (
              <span
                className="flex items-center gap-1.5 self-center px-3 text-[1rem] font-semibold"
                aria-label={`Votre note : ${b.reviewRating} sur 5`}
              >
                <I icon={Star} size={18} className="fill-current" /> {b.reviewRating}/5
              </span>
            ) : (
              <Link to={`/rendez-vous/${b.id}/noter`} className="pl-btn pl-btn-out pl-btn-sm !w-auto">
                <I icon={Star} size={16} /> {t("Noter")}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}

const EMPTY: Record<Scope, { icon: typeof CalendarClock; title: string; text: string }> = {
  upcoming: {
    icon: CalendarClock,
    title: t("Aucun rendez-vous à venir"),
    text: t("Réservez en quelques secondes dans le salon de votre choix."),
  },
  past: {
    icon: History,
    title: t("Aucun rendez-vous passé"),
    text: t("Vos rendez-vous terminés apparaîtront ici."),
  },
  cancelled: {
    icon: CalendarX,
    title: t("Aucun rendez-vous annulé"),
    text: t("Tant mieux : rien d’annulé pour le moment."),
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
      {/* Un rappel non reçu, c'est un rendez-vous oublié. Reproposé bien plus rarement que côté
          professionnel : un client n'y perd pas son activité. */}
      <PageHead title={t('Rendez-vous')} />
      <Segmented
        label={t("Période")}
        value={scope}
        onChange={setScope}
        options={[
          { value: 'upcoming', label: t("À venir"), icon: CalendarClock },
          { value: 'past', label: t("Passés"), icon: History },
          { value: 'cancelled', label: t("Annulés"), icon: CalendarX },
        ]}
      />
      {list.isPending ? (
        <>
          <Skeleton className="h-[13rem] w-full !rounded-[var(--radius-card)]" />
          <Skeleton className="h-[7.5rem] w-full !rounded-[var(--radius-card)]" />
        </>
      ) : list.isError ? (
        <ErrorMessage error={list.error} retry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          description={empty.text}
          action={
            scope === 'upcoming' ? (
              <LinkButton to={MARCHE}>
                <I icon={Search} size={18} /> {t("Explorer les salons")}
              </LinkButton>
            ) : undefined
          }
        />
      ) : scope === 'upcoming' ? (
        items.map((b) => <UpcomingCard key={b.id} b={b} now={now} />)
      ) : (
        items.map((b) => <HistoryCard key={b.id} b={b} />)
      )}
      <LoadMore
        hasMore={list.hasNextPage}
        loading={list.isFetchingNextPage}
        onMore={() => void list.fetchNextPage()}
        label={t("Voir plus de rendez-vous")}
      />
    </Screen>
  );
}
