/**
 * PRO-F 22 — Accueil professionnel. Refonte du 28 oct. 2026 : un cockpit de salon.
 *
 * Ordre de lecture (téléphone) :
 *   1. le BANDEAU DU JOUR, en encre : date, bonjour, l'anneau de la journée (rendez-vous passés sur
 *      le total, au centre le nombre du jour), puis deux chiffres qui appellent un geste — les
 *      demandes à valider et le chiffre d'affaires du jour ;
 *   2. quatre gestes en tuiles (nouveau, agenda, bloquer, partager) ;
 *   3. ce qui se passe MAINTENANT, avec sa barre d'avancement quand le rendez-vous est en cours ;
 *   4. les demandes à valider (avec leur jour : une demande pour demain affichait seulement
 *      « 09:00 », comme si c'était aujourd'hui) ;
 *   5. la journée en FRISE VERTICALE, avec le repère « maintenant » entre le passé et la suite ;
 *   6. la semaine en barres (le jour est déjà dans le bandeau : il n'est pas répété) et le lien.
 * À partir de 1 024 px, deux colonnes : le travail du jour à gauche, les chiffres et le partage à droite.
 *
 * Une information ne s'écrit qu'UNE fois : le nombre de rendez-vous du jour est au centre de
 * l'anneau, pas aussi dans une case de chiffres ; le chiffre d'affaires du jour est dans le bandeau,
 * la carte « Chiffre d'affaires » montre la semaine et le mois.
 *
 * Un rendez-vous s'ouvre en FENÊTRE (`BookingPeekSheet`), comme dans l'agenda : on garde l'accueil
 * derrière. Ce que l'écran montre est marqué VU (`useSeenOnDisplay`) : les pastilles baissent sans
 * qu'il faille ouvrir chaque fiche. Chaque demande a son PROPRE état d'envoi : confirmer l'une ne
 * fige pas les autres.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Phone,
  QrCode,
  Share2,
} from 'lucide-react';
import {
  useMe,
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
  toLocalDateKey,
  untilLabelFR,
  weekKeys,
} from '@salondz/constants';
import type { BookingWithStaff } from '@salondz/types';
import { Button, EmptyState, I, Skeleton, StatusBadge } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { NotificationsNudge } from '@/components/NotificationsNudge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { TimelineList, TimelineNow, TimelineRow, toneVar } from '@/components/ProBookingCards';
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

/** Rendez-vous passés montrés avant de replier la suite (« 4 passés »). */
const PAST_SHOWN = 0;

/** Montant sans devise, espaces insécables (le séparateur de milliers ne coupe jamais la ligne). */
const amount = (v: number) => v.toLocaleString(formatLocale()).replace(/ /g, ' ');

export function ProHome() {
  const me = useMe();
  const proSalon = useProSalon().data;
  const salon = proSalon?.salon ?? null;
  const stats = useProStats();
  const pending = useProPendingBookings();
  const today = toLocalDateKey();
  const week = weekKeys(today);
  const weekStats = useProStatsRange(week[0]!, week[6]!, !!salon);
  const todayList = useProBookings({ from: today, to: today, limit: 50 }, !!salon);
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
    // Les demandes ne sont plus listées ici : on ne les marque pas vues, sinon l'onglet
    // « Réservations » s'éteindrait avant que le professionnel les ait regardées.
    todays.map((b) => b.id),
    !!salon && !todayList.isFetching && !pending.isFetching,
  );

  const dateLine = new Intl.DateTimeFormat(formatLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Algiers',
  }).format(new Date());

  /* ---------------------------------------------------------------- bandeau du jour */

  const total = todays.length;
  const live = inProgress ? 1 : 0;
  const left = upcoming.length - live;
  const elapsed =
    next && inProgress
      ? Math.min(
          1,
          Math.max(
            0,
            (now - new Date(next.startsAt).getTime()) /
              Math.max(1, new Date(next.endsAt).getTime() - new Date(next.startsAt).getTime()),
          ),
        )
      : 0;
  // L'anneau avance AVEC le rendez-vous en cours : sa part écoulée compte déjà.
  const ratio = total ? (past.length + elapsed) / total : 0;
  const dayLine = !todayList.data
    ? '\u00a0'
    : !total
      ? t('Aucun rendez-vous pour l’instant')
      : !upcoming.length
        ? t('Journée terminée')
        : [
            past.length ? t('{n} terminé(s)', { n: past.length }) : null,
            live ? t('1 en cours') : null,
            left ? t('{n} à venir', { n: left }) : null,
          ]
            .filter(Boolean)
            .join(' · ');

  const pendingCount = stats.data?.pendingCount ?? pendingItems.length;
  const hero = (
    <section className="phx" aria-label={t('Votre journée')}>
      <div className="phx-top">
        <div className="min-w-0">
          <h1 className="phx-hi">{firstName ? t('Bonjour, {name}', { name: firstName }) : t('Votre journée')}</h1>
          <p className="phx-date">{dateLine}</p>
        </div>
        {/* « Arrêt / Pause » à droite du bonjour ; l'identité du salon est dans l'en-tête. */}
        {salon && <QuickCloseButton openingHours={salon.openingHours} />}
      </div>

      {/* Trois chiffres, une rangée : la journée, ce qui attend une réponse, ce qu'elle rapporte. */}
      <div className="phx-k">
        <Link to="/pro/agenda" className="phx-c phx-c-day" aria-label={`${t("Rendez-vous aujourd'hui")} · ${dayLine}`}>
          <Ring ratio={ratio} live={inProgress}>
            {todayList.data ? total : '–'}
          </Ring>
          <span className="min-w-0">
            <span className="phx-l">{t('Aujourd’hui')}</span>
            <span className="phx-s">{todayList.data ? (left + live ? t('{n} à venir', { n: left + live }) : total ? t('Terminé') : t('Libre')) : '\u00a0'}</span>
          </span>
        </Link>
        {/* Les demandes se traitent dans « Réservations » (l'onglet s'allume quand il y en a de
            nouvelles) : l'accueil n'en garde que le nombre, qui y mène. */}
        <Link to="/pro/reservations" className={`phx-c ${pendingCount ? 'phx-pd' : ''}`} aria-label={t('Demandes à valider')}>
          <span className={`phx-v ${pendingCount ? 'warn' : ''}`}>{stats.isPending ? '–' : pendingCount}</span>
          <span className="phx-l">{t('À valider')}</span>
        </Link>
        <Link to="/pro/chiffre-affaires" className="phx-c" aria-label={t("Chiffre d'affaires du jour")}>
          <span className="phx-v whitespace-nowrap">
            <bdi dir="ltr">{stats.isPending ? '–' : amount(stats.data?.todayRevenueDa ?? 0)}</bdi>
          </span>
          <span className="phx-l">{t('DA ce jour')}</span>
        </Link>
      </div>
      {stats.isError && <ErrorMessage error={stats.error} retry={() => stats.refetch()} />}
    </section>
  );

  /* ---------------------------------------------------------------- maintenant */

  const nowCard = next && (
    /* Le prochain (ou celui en cours) : heure, client, prestation, et l'appel à portée de pouce. */
    <div className={`phn ${inProgress ? 'live' : ''}`} style={{ ['--tone' as string]: toneVar(toneOf(next)) }}>
      <span className="phn-k">
        <span className="phn-dot" aria-hidden />
        {inProgress
          ? t('En cours · fin à {time}', { time: formatTimeDZ(next.endsAt) })
          : `${t('Prochain')} · ${untilLabelFR(next.startsAt, now)}`}
        {next.status !== 'confirmed' && <StatusBadge status={next.status} />}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-start"
          onClick={() => setPeek(next.id)}
          aria-label={t('Ouvrir le rendez-vous de {name}', { name: next.clientName })}
        >
          <span className="phn-t mono" dir="ltr">{formatTimeDZ(next.startsAt)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.143rem] font-semibold">{next.clientName}</span>
            <span className="block truncate text-[0.857rem] text-muted">
              {next.serviceName} · {formatDA(next.priceDa)}
              {!staffId && next.staff?.displayName ? ` · ${next.staff.displayName}` : ''}
            </span>
          </span>
        </button>
        {next.clientPhone && (
          <span className="flex flex-none gap-1.5">
            <a href={`tel:${next.clientPhone}`} className="phn-ib" aria-label={t('Appeler {name}', { name: next.clientName })}>
              <I icon={Phone} size={18} />
            </a>
            <a
              href={`https://wa.me/${next.clientPhone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="phn-ib wa"
              aria-label={`WhatsApp ${next.clientName}`}
            >
              <I icon={MessageCircle} size={18} />
            </a>
          </span>
        )}
      </div>
      {inProgress && (
        <div className="phn-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsed * 100)}>
          <span style={{ width: `${elapsed * 100}%` }} />
        </div>
      )}
    </div>
  );

  /* ---------------------------------------------------------------- demandes */

  /* ---------------------------------------------------------------- journée */

  const shownPast = showPast ? past : past.slice(past.length - PAST_SHOWN);
  // Le prochain a sa carte au-dessus : la frise commence APRÈS lui (une information, une fois).
  const later = upcoming.slice(1);
  const nowLabel = formatTimeDZ(new Date(now).toISOString());
  const day = (
    <section className="flex flex-col gap-2.5" aria-label={t('Ma journée')}>
      <SectionHead title={next ? t('Ensuite') : t('Ma journée')} count={later.length || undefined} to="/pro/agenda" more={t('Agenda')} />
      {todayList.isPending && <Skeleton className="h-[9rem] w-full !rounded-[var(--radius-card)]" />}
      {todayList.isError && <ErrorMessage error={todayList.error} retry={() => todayList.refetch()} />}
      {todayList.data && !todays.length && !next && (
        <EmptyState
          icon={CalendarDays}
          title={t('Aucun rendez-vous aujourd’hui')}
          description={t('Ajoutez un client de passage ou partagez votre lien pour remplir la journée.')}
        />
      )}
      {(later.length > 0 || past.length > 0) && (
        <TimelineList>
          {past.length > PAST_SHOWN && !showPast && (
            <li>
              <button type="button" className="phd-more" onClick={() => setShowPast(true)}>
                <I icon={ChevronDown} size={16} />
                {t('{n} rendez-vous passé(s)', { n: past.length - PAST_SHOWN })}
              </button>
            </li>
          )}
          {shownPast.map((b) => (
            <TimelineRow key={b.id} b={b} state="done" tone={toneVar(toneOf(b))} showStaff={!staffId} onOpen={setPeek} />
          ))}
          {/* Le repère du moment : entre ce qui est fait et ce qui vient, sauf pendant un
              rendez-vous en cours — sa ligne verte le dit déjà. */}
          {showPast && past.length > 0 && later.length > 0 && <TimelineNow time={nowLabel} />}
          {later.map((b) => (
            <TimelineRow
              key={b.id}
              b={b}
              state="next"
              tone={toneVar(toneOf(b))}
              showStaff={!staffId}
              onOpen={setPeek}
            />
          ))}
        </TimelineList>
      )}
    </section>
  );

  /* ---------------------------------------------------------------- chiffres */

  const bars = weekStats.data?.byDay ?? [];
  const top = Math.max(1, ...bars.map((d) => d.revenueDa));
  const revenue = (
    <Link to="/pro/chiffre-affaires" className="crd phc">
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="h3">{t('Cette semaine')}</span>
          <span className="phc-v whitespace-nowrap">
            <bdi dir="ltr">
              {amount(stats.data?.weekRevenueDa ?? 0)} <span className="phc-u">DA</span>
            </bdi>
          </span>
          <span className="text-[0.857rem] text-muted">
            {t('Ce mois : {n} DA', { n: amount(stats.data?.monthRevenueDa ?? 0) })}
          </span>
        </span>
        <I icon={ChevronRight} size={18} className="mt-0.5 flex-none text-disabled rtl:rotate-180" />
      </span>
      {bars.length === 7 && (
        <span className="phc-g" aria-label={t('Chiffre d’affaires de la semaine, jour par jour')}>
          {bars.map((d) => (
            <span key={d.date} className={`phc-b ${d.date === today ? 'on' : ''} ${d.date > today ? 'fut' : ''}`}>
              <span className="phc-f" style={{ height: `${Math.max(6, Math.round((d.revenueDa / top) * 100))}%` }} />
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
      <span className="phs-i" aria-hidden>
        <I icon={QrCode} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1rem] font-semibold">{t('Votre page de réservation')}</span>
        <span className="block truncate text-[0.857rem] text-muted" dir="ltr">
          {link.short}
        </span>
      </span>
      <Button variant="g" sm auto onClick={() => setShare(true)} aria-label={t('Partager mon lien')}>
        <I icon={Share2} size={16} /> {t('Partager')}
      </Button>
    </div>
  );

  return (
    <Screen bottom={NAV_PAD} gap={14} width="page">
      {/* Les notifications décident si l'application sert à quelque chose quand elle est fermée :
          une demande manquée est un client perdu. Le bandeau ne revient qu'à intervalle. */}
      <NotificationsNudge role="pro" />
      {salon && <QuickCloseBanner />}

      <div className="phg">
        <div className="phg-m">
          {hero}
          {salon && salon.staff.filter((m) => m.isActive).length > 1 && (
            <StaffFilter staff={salon.staff} value={staffId} onChange={setStaffId} />
          )}
          {nowCard}
          {(later.length > 0 || past.length > 0 || !next) && day}
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
    </Screen>
  );
}

/**
 * Anneau de la journée : la part des rendez-vous déjà passés. Le chiffre du centre est le nombre du
 * jour. Pendant un rendez-vous en cours, l'anneau passe au vert.
 */
function Ring({ ratio, live, children }: { ratio: number; live?: boolean; children: ReactNode }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <span className={`phx-ring ${live ? 'live' : ''}`} aria-hidden>
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle cx="32" cy="32" r={r} className="phx-ring-bg" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className="phx-ring-fg"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, ratio)))}
        />
      </svg>
      <span className="phx-ring-n mono">{children}</span>
    </span>
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
