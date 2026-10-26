/**
 * PRO-F 22 — Accueil professionnel, refait le 26 oct. 2026 : un tableau de bord de salon.
 *
 * Ordre de lecture (téléphone) : la date et le bonjour, trois chiffres sur UNE carte, les gestes du
 * jour, ce qui se passe MAINTENANT, les demandes à valider (avec leur jour : une demande pour demain
 * affichait seulement « 09:00 », comme si c'était aujourd'hui), la journée entière en frise, puis le
 * chiffre d'affaires et la semaine en barres. À partir de 1 024 px, deux colonnes : le travail du
 * jour à gauche, les chiffres et le partage à droite.
 *
 * Un rendez-vous s'ouvre en FENÊTRE (`BookingPeekSheet`), comme dans l'agenda : on garde l'accueil
 * derrière. Ce que l'écran montre est marqué VU (`useSeenOnDisplay`) : les pastilles baissent sans
 * qu'il faille ouvrir chaque fiche.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  CalendarDays,
  CalendarOff,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Phone,
  Plus,
  Share2,
} from 'lucide-react';
import {
  useMe,
  useProBookingMutations,
  useProBookings,
  useProPendingBookings,
  useProSalon,
  useProStats,
  useProStatsRange,
  useSeenOnDisplay,
} from '@salondz/api-client';
import {
  categoryTone,
  formatDA,
  formatLocale,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
  untilLabelFR,
  weekKeys,
} from '@salondz/constants';
import type { BookingWithStaff } from '@salondz/types';
import { formatDuration } from '@/lib/format';
import { Avatar, Button, EmptyState, I, Skeleton, StatusBadge } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { NotificationsNudge } from '@/components/NotificationsNudge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { RefuseRequestSheet, type RefusedRequest } from '@/components/RefuseRequestSheet';
import { StaffFilter } from '@/components/StaffFilter';
import { BookingPeekSheet } from '@/components/BookingPeekSheet';
import { QuickCloseBanner, QuickCloseButton } from '@/components/QuickClose';
import { useStaffFilter } from '@/lib/proPrefs';
import { ShareSheet, usePublicUrl } from './Link';
import { t } from '@/i18n';

/** Heure courante rafraîchie chaque minute (« dans 25 min », « en cours »). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Nombre de demandes montrées sur l'accueil ; la suite est dans « Réservations ». */
const PENDING_SHOWN = 3;
/** Rendez-vous passés montrés avant de replier la suite (« 4 passés »). */
const PAST_SHOWN = 1;

const localKey = (iso: string) => toLocalDateKey(new Date(iso));
const toneVar = (tone: string | null | undefined) =>
  tone ? `var(--color-cat-${tone}-line)` : 'var(--color-disabled)';

export function ProHome() {
  const navigate = useNavigate();
  const me = useMe();
  const proSalon = useProSalon().data;
  const salon = proSalon?.salon ?? null;
  const stats = useProStats();
  const pending = useProPendingBookings();
  const today = toLocalDateKey();
  const week = weekKeys(today);
  const weekStats = useProStatsRange(week[0]!, week[6]!, !!salon);
  const todayList = useProBookings({ from: today, to: today, limit: 50 }, !!salon);
  const { setStatus } = useProBookingMutations();
  const [refusing, setRefusing] = useState<RefusedRequest | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [staffId, setStaffId] = useStaffFilter();
  const byStaff = <T extends { staffId: string | null }>(list: T[]) =>
    staffId ? list.filter((b) => b.staffId === staffId) : list;
  // `owner` n'existe que lorsqu'un administrateur pilote ce salon : on salue alors le professionnel,
  // pas l'administrateur dont `me` est le compte.
  const firstName = ((proSalon?.owner ?? me.data?.profile)?.fullName ?? salon?.name ?? '').split(' ')[0];
  const now = useNow();
  const [share, setShare] = useState(false);
  const link = usePublicUrl(salon?.slug ?? '');

  const todays = byStaff(todayList.data?.items ?? [])
    .filter((b) => b.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const isOpen = (b: BookingWithStaff) => b.status === 'pending' || b.status === 'confirmed';
  const upcoming = todays.filter((b) => new Date(b.endsAt).getTime() > now && isOpen(b));
  const past = todays.filter((b) => !upcoming.includes(b));
  const next = upcoming[0];
  const inProgress = !!next && new Date(next.startsAt).getTime() <= now;
  const pendingItems = byStaff(pending.data?.items ?? []);
  const toneOf = (b: BookingWithStaff) =>
    categoryTone(salon?.services.find((s) => s.id === b.serviceId)?.categoryId);

  // Ce que l'accueil MONTRE vaut lecture : la journée et les demandes affichées.
  useSeenOnDisplay(
    [...todays, ...pendingItems.slice(0, PENDING_SHOWN)].map((b) => b.id),
    !!salon && !todayList.isFetching && !pending.isFetching,
  );

  const dateLine = new Intl.DateTimeFormat(formatLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Algiers',
  }).format(new Date());
  const remaining = upcoming.length;

  /* ---------------------------------------------------------------- blocs */

  const kpis = stats.isPending ? (
    <Skeleton className="h-[5.5rem] w-full !rounded-[var(--radius-card)]" />
  ) : stats.isError ? (
    <ErrorMessage error={stats.error} retry={() => stats.refetch()} />
  ) : (
    <div className="phk">
      <Link to="/pro/agenda" className="phk-c">
        <span className="phk-v">{stats.data.todayCount}</span>
        <span className="phk-l">{t("Rendez-vous aujourd'hui")}</span>
        <span className="phk-s">
          {remaining ? t('{n} à venir', { n: remaining }) : t('Journée terminée')}
        </span>
      </Link>
      <Link to="/pro/reservations" className="phk-c" aria-label={t('Demandes à valider')}>
        <span className={`phk-v ${stats.data.pendingCount ? 'text-pending-fg' : ''}`}>
          {stats.data.pendingCount}
        </span>
        <span className="phk-l">{t('À valider')}</span>
        <span className="phk-s">{stats.data.pendingCount ? t('Réponse attendue') : t('Tout est traité')}</span>
      </Link>
      <Link to="/pro/chiffre-affaires" className="phk-c">
        <span className="phk-v amt whitespace-nowrap">
          <bdi dir="ltr">
            {(stats.data.todayRevenueDa ?? 0).toLocaleString(formatLocale()).replace(/ /g, ' ')}
            <span className="phk-u">DA</span>
          </bdi>
        </span>
        <span className="phk-l">{t("Chiffre d'affaires du jour")}</span>
        <span className="phk-s">
          {t('Semaine : {n}', { n: stats.data.weekRevenueDa.toLocaleString(formatLocale()).replace(/ /g, ' ') })}
        </span>
      </Link>
    </div>
  );

  const actions = (
    <div className="phq">
      <button type="button" className="phq-a on" onClick={() => navigate('/pro/rendez-vous/nouveau')}>
        <I icon={Plus} size={20} />
        <span>{t('Nouveau')}</span>
      </button>
      <Link to="/pro/agenda" className="phq-a">
        <I icon={CalendarDays} size={20} />
        <span>{t('Agenda')}</span>
      </Link>
      <Link to="/pro/blocages" className="phq-a">
        <I icon={CalendarOff} size={20} />
        <span>{t('Bloquer')}</span>
      </Link>
      <button type="button" className="phq-a" onClick={() => setShare(true)} disabled={!salon}>
        <I icon={Share2} size={20} />
        <span>{t('Partager')}</span>
      </button>
    </div>
  );

  const nowCard = next && (
    /* Le prochain (ou celui en cours) en grand : heure, client, prestation, prix, membre. */
    <div className={`crd phn ${inProgress ? 'live' : ''}`} style={{ ['--tone' as string]: toneVar(toneOf(next)) }}>
      <div className="flex items-center justify-between gap-3">
        <span className="phn-k">
          {inProgress && <span className="phn-dot" aria-hidden />}
          {inProgress
            ? t('En cours · fin à {time}', { time: formatTimeDZ(next.endsAt) })
            : `${t('Prochain')} · ${untilLabelFR(next.startsAt, now)}`}
        </span>
        <StatusBadge status={next.status} md />
      </div>
      <button
        type="button"
        className="flex items-center gap-3 text-start"
        onClick={() => setPeek(next.id)}
        aria-label={t('Ouvrir le rendez-vous de {name}', { name: next.clientName })}
      >
        <span className="phn-t mono">
          {formatTimeDZ(next.startsAt)}
          <span className="phn-e" dir="ltr">– {formatTimeDZ(next.endsAt)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.143rem] font-semibold tracking-[-0.3px]">
            {next.clientName}
          </span>
          <span className="block truncate text-[0.929rem] text-muted">
            {next.serviceName} · {formatDuration(next.durationMinutes)}
            {next.staff?.displayName ? ` · ${next.staff.displayName}` : ''}
          </span>
        </span>
        <span className="flex-none text-[1.143rem] font-semibold">{formatDA(next.priceDa)}</span>
      </button>
      {next.clientPhone && (
        <div className="g2">
          <a href={`tel:${next.clientPhone}`} className="btn g sm" aria-label={t('Appeler {name}', { name: next.clientName })}>
            <I icon={Phone} size={16} /> {t('Appeler')}
          </a>
          <a
            href={`https://wa.me/${next.clientPhone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="btn g sm"
            aria-label={`WhatsApp ${next.clientName}`}
          >
            <I icon={MessageCircle} size={16} /> WhatsApp
          </a>
        </div>
      )}
    </div>
  );

  const requests = pendingItems.length > 0 && (
    <section className="flex flex-col gap-2.5" aria-label={t('À valider')}>
      <SectionHead
        title={t('À valider')}
        count={pendingItems.length}
        to="/pro/reservations"
        more={pendingItems.length > PENDING_SHOWN ? t('Tout voir') : undefined}
      />
      {pendingItems.slice(0, PENDING_SHOWN).map((b) => {
        const day = localKey(b.startsAt);
        return (
          <div key={b.id} className="crd phr">
            <button type="button" className="flex items-center gap-3 text-start" onClick={() => setPeek(b.id)}>
              <Avatar name={b.clientName} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[1rem] font-semibold">{b.clientName}</span>
                <span className="block truncate text-[0.857rem] text-muted">
                  {b.serviceName} · {formatDA(b.priceDa)}
                  {!staffId && b.staff?.displayName ? ` · ${b.staff.displayName}` : ''}
                </span>
              </span>
              <span className="flex-none text-end">
                <span className="block text-[1rem] font-semibold mono">{formatTimeDZ(b.startsAt)}</span>
                <span className={`block text-[0.857rem] ${day === today ? 'font-semibold text-pending-fg' : 'text-muted'}`}>
                  {relativeDayLabelDZ(day, today)}
                </span>
              </span>
            </button>
            <div className="g3">
              <Button
                variant="ok"
                sm
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}
              >
                {t('Confirmer')}
              </Button>
              <Button variant="g" sm onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}>
                {t('Reporter')}
              </Button>
              <Button variant="d" sm onClick={() => setRefusing({ id: b.id, clientName: b.clientName })}>
                {t('Refuser')}
              </Button>
            </div>
          </div>
        );
      })}
      <ErrorMessage error={setStatus.error} />
    </section>
  );

  const shownPast = showPast ? past : past.slice(-PAST_SHOWN);
  const day = (
    <section className="flex flex-col gap-2.5" aria-label={t('Ma journée')}>
      <SectionHead title={t('Ma journée')} count={todays.length || undefined} to="/pro/agenda" more={t('Agenda')} />
      {todayList.isPending && <Skeleton className="h-[9rem] w-full !rounded-[var(--radius-card)]" />}
      {todayList.isError && <ErrorMessage error={todayList.error} retry={() => todayList.refetch()} />}
      {todayList.data && !todays.length && (
        <EmptyState
          icon={CalendarDays}
          title={t('Aucun rendez-vous aujourd’hui')}
          description={t('Ajoutez un client de passage ou partagez votre lien pour remplir la journée.')}
        />
      )}
      {todays.length > 0 && (
        <div className="crd phd">
          {past.length > PAST_SHOWN && !showPast && (
            <button type="button" className="phd-more" onClick={() => setShowPast(true)}>
              <I icon={ChevronDown} size={16} />
              {t('{n} rendez-vous passé(s)', { n: past.length - PAST_SHOWN })}
            </button>
          )}
          {[...shownPast, ...upcoming].map((b) => {
            const done = past.includes(b);
            const live = b === next && inProgress;
            return (
              <button
                key={b.id}
                type="button"
                className={`phd-r ${done ? 'done' : ''} ${live ? 'live' : ''}`}
                style={{ ['--tone' as string]: toneVar(toneOf(b)) }}
                onClick={() => setPeek(b.id)}
              >
                <span className="phd-h mono">
                  {formatTimeDZ(b.startsAt)}
                  <span>{formatTimeDZ(b.endsAt)}</span>
                </span>
                <span className="phd-b" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[1rem] font-semibold">{b.clientName}</span>
                  <span className="block truncate text-[0.857rem] text-muted">
                    {b.serviceName}
                    {!staffId && b.staff?.displayName ? ` · ${b.staff.displayName}` : ''}
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1">
                  <span className="text-[0.929rem] font-semibold">{formatDA(b.priceDa)}</span>
                  {(b.status !== 'confirmed' || done) && <StatusBadge status={b.status} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  const bars = weekStats.data?.byDay ?? [];
  const top = Math.max(1, ...bars.map((d) => d.revenueDa));
  const revenue = (
    <Link to="/pro/chiffre-affaires" className="crd phc">
      <span className="flex items-center justify-between">
        <span className="h3">{t("Chiffre d'affaires")}</span>
        <I icon={ChevronRight} size={18} className="text-disabled" />
      </span>
      <span className="grid grid-cols-3 divide-x divide-line rtl:divide-x-reverse">
        {[
          { v: stats.data?.todayRevenueDa ?? 0, l: t("aujourd'hui") },
          { v: stats.data?.weekRevenueDa ?? 0, l: t('cette semaine') },
          { v: stats.data?.monthRevenueDa ?? 0, l: t('ce mois') },
        ].map((x, i) => (
          <span key={x.l} className={`flex min-w-0 flex-col ${i ? 'ps-3' : ''}`}>
            <span className="truncate whitespace-nowrap text-[1.071rem] font-semibold tracking-[-0.3px]">
              <bdi dir="ltr">
                {x.v.toLocaleString(formatLocale()).replace(/ /g, ' ')}{' '}
                <span className="text-[0.857rem] font-medium text-muted">DA</span>
              </bdi>
            </span>
            <span className="text-[0.857rem] text-muted">{x.l}</span>
          </span>
        ))}
      </span>
      {bars.length === 7 && (
        <span className="phc-g" aria-label={t('Chiffre d’affaires de la semaine, jour par jour')}>
          {bars.map((d) => (
            <span key={d.date} className={`phc-b ${d.date === today ? 'on' : ''} ${d.date > today ? 'fut' : ''}`}>
              <span className="phc-f" style={{ height: `${Math.max(4, Math.round((d.revenueDa / top) * 100))}%` }} />
              <span className="phc-d">
                {new Intl.DateTimeFormat(formatLocale(), { weekday: 'narrow', timeZone: 'UTC' }).format(
                  new Date(`${d.date}T12:00:00Z`),
                )}
              </span>
            </span>
          ))}
        </span>
      )}
    </Link>
  );

  const shareCard = salon && (
    <div className="crd phs">
      <span className="h3">{t('Votre page de réservation')}</span>
      <span className="truncate text-[0.929rem] text-muted" dir="ltr">
        {link.short}
      </span>
      <Button variant="g" sm onClick={() => setShare(true)}>
        <I icon={Share2} size={16} /> {t('Partager mon lien')}
      </Button>
    </div>
  );

  return (
    <Screen bottom={NAV_PAD} gap={14} width="page">
      {/* Les notifications décident si l'application sert à quelque chose quand elle est fermée :
          une demande manquée est un client perdu. Le bandeau ne revient qu'à intervalle. */}
      <NotificationsNudge role="pro" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.857rem] font-semibold uppercase tracking-[0.08em] text-muted">{dateLine}</div>
          <h1 className="h1 truncate">
            {firstName ? t('Bonjour, {name}', { name: firstName }) : t('Votre journée')}
          </h1>
        </div>
        {/* « Arrêt / Pause » à droite du titre ; l'identité du salon est dans l'en-tête. */}
        {salon && <QuickCloseButton openingHours={salon.openingHours} />}
      </div>
      {salon && <QuickCloseBanner />}

      <div className="phg">
        <div className="phg-m">
          {kpis}
          {actions}
          {salon && salon.staff.filter((m) => m.isActive).length > 1 && (
            <StaffFilter staff={salon.staff} value={staffId} onChange={setStaffId} />
          )}
          {nowCard}
          {requests}
          {day}
        </div>
        <div className="phg-s">
          {revenue}
          {shareCard}
        </div>
      </div>

      {share && salon && (
        <ShareSheet name={salon.name} url={link.url} short={link.short} logo={salon.logoUrl} onClose={() => setShare(false)} />
      )}
      {peek && <BookingPeekSheet id={peek} onClose={() => setPeek(null)} />}
      {refusing && <RefuseRequestSheet request={refusing} onClose={() => setRefusing(null)} />}
    </Screen>
  );
}

/** Titre de section : libellé, compte, et un lien vers l'écran complet. */
function SectionHead({ title, count, to, more }: { title: string; count?: number; to: string; more?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="h3">
        {title}
        {count ? <span className="ms-2 text-text">{count}</span> : null}
      </span>
      {more && (
        <Link to={to} className="flex items-center gap-0.5 text-[0.857rem] font-semibold text-muted">
          {more} <I icon={ChevronRight} size={14} className="rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}
