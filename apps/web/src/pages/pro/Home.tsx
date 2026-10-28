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
import { Link, useNavigate } from 'react-router';
import {
  CalendarDays,
  CalendarOff,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Phone,
  Plus,
  QrCode,
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
/** Montant sans devise, espaces insécables (le séparateur de milliers ne coupe jamais la ligne). */
const amount = (v: number) => v.toLocaleString(formatLocale()).replace(/ /g, ' ');

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

  const hero = (
    <section className="phx" aria-label={t('Votre journée')}>
      <div className="phx-top">
        <div className="min-w-0">
          <p className="phx-date">{dateLine}</p>
          <h1 className="phx-hi">{firstName ? t('Bonjour, {name}', { name: firstName }) : t('Votre journée')}</h1>
        </div>
        {/* « Arrêt / Pause » à droite du bonjour ; l'identité du salon est dans l'en-tête. */}
        {salon && <QuickCloseButton openingHours={salon.openingHours} />}
      </div>

      <Link to="/pro/agenda" className="phx-day">
        <Ring ratio={ratio} live={inProgress}>
          {todayList.data ? total : '–'}
        </Ring>
        <span className="min-w-0 flex-1">
          <span className="block text-[1.143rem] font-semibold">
            {t("Rendez-vous aujourd'hui")}
          </span>
          <span className="block truncate text-[1rem] text-white/60">{dayLine}</span>
        </span>
        <I icon={ChevronRight} size={18} className="flex-none text-white/40 rtl:rotate-180" />
      </Link>

      {stats.isError ? (
        <ErrorMessage error={stats.error} retry={() => stats.refetch()} />
      ) : (
        <div className="phx-k">
          <Link to="/pro/reservations" className="phx-c" aria-label={t('Demandes à valider')}>
            <span className="phx-l">{t('À valider')}</span>
            <span className={`phx-v ${stats.data?.pendingCount ? 'warn' : ''}`}>
              {stats.isPending ? '–' : stats.data.pendingCount}
            </span>
            <span className="phx-s">
              {stats.isPending ? ' ' : stats.data.pendingCount ? t('Réponse attendue') : t('Tout est traité')}
            </span>
          </Link>
          <Link to="/pro/chiffre-affaires" className="phx-c">
            <span className="phx-l">{t("Chiffre d'affaires du jour")}</span>
            <span className="phx-v whitespace-nowrap">
              <bdi dir="ltr">
                {stats.isPending ? '–' : amount(stats.data.todayRevenueDa ?? 0)}
                <span className="phx-u">DA</span>
              </bdi>
            </span>
            <span className="phx-s">{t('Voir le détail')}</span>
          </Link>
        </div>
      )}
    </section>
  );

  const actions = (
    <nav className="phq" aria-label={t('Raccourcis')}>
      <button type="button" className="phq-a on" onClick={() => navigate('/pro/rendez-vous/nouveau')}>
        <span className="phq-i"><I icon={Plus} size={22} /></span>
        <span className="phq-t">{t('Nouveau')}</span>
      </button>
      <Link to="/pro/agenda" className="phq-a">
        <span className="phq-i"><I icon={CalendarDays} size={21} /></span>
        <span className="phq-t">{t('Agenda')}</span>
      </Link>
      <Link to="/pro/blocages" className="phq-a">
        <span className="phq-i"><I icon={CalendarOff} size={21} /></span>
        <span className="phq-t">{t('Bloquer')}</span>
      </Link>
      <button type="button" className="phq-a" onClick={() => setShare(true)} disabled={!salon}>
        <span className="phq-i"><I icon={Share2} size={21} /></span>
        <span className="phq-t">{t('Partager')}</span>
      </button>
    </nav>
  );

  /* ---------------------------------------------------------------- maintenant */

  const nowCard = next && (
    /* Le prochain (ou celui en cours) en grand : heure, client, prestation, prix, membre. */
    <div className={`phn ${inProgress ? 'live' : ''}`} style={{ ['--tone' as string]: toneVar(toneOf(next)) }}>
      <div className="flex items-center justify-between gap-3">
        <span className="phn-k">
          <span className="phn-dot" aria-hidden />
          {inProgress
            ? t('En cours · fin à {time}', { time: formatTimeDZ(next.endsAt) })
            : `${t('Prochain')} · ${untilLabelFR(next.startsAt, now)}`}
        </span>
        {next.status !== 'confirmed' && <StatusBadge status={next.status} md />}
      </div>
      <button
        type="button"
        className="flex items-center gap-3.5 text-start"
        onClick={() => setPeek(next.id)}
        aria-label={t('Ouvrir le rendez-vous de {name}', { name: next.clientName })}
      >
        <Avatar name={next.clientName} size={48} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.143rem] font-semibold tracking-[-0.2px]">{next.clientName}</span>
          <span className="block truncate text-[1rem] text-muted">
            {next.serviceName} · {formatDuration(next.durationMinutes)}
            {next.staff?.displayName ? ` · ${next.staff.displayName}` : ''}
          </span>
        </span>
        <span className="flex flex-none flex-col items-end">
          <span className="phn-t mono" dir="ltr">{formatTimeDZ(next.startsAt)}</span>
          <span className="text-[0.857rem] font-semibold text-muted">{formatDA(next.priceDa)}</span>
        </span>
      </button>
      {inProgress && (
        <div className="phn-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsed * 100)}>
          <span style={{ width: `${elapsed * 100}%` }} />
        </div>
      )}
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

  /* ---------------------------------------------------------------- demandes */

  // L'état d'envoi est celui de LA demande touchée : les autres restent utilisables.
  const confirming = (id: string) => setStatus.isPending && setStatus.variables?.id === id;

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
        const isToday = day === today;
        return (
          <div key={b.id} className="phr">
            <button type="button" className="flex items-center gap-3 text-start" onClick={() => setPeek(b.id)}>
              <span className={`phr-d ${isToday ? 'on' : ''}`}>
                <span className="mono" dir="ltr">{formatTimeDZ(b.startsAt)}</span>
                <span>{relativeDayLabelDZ(day, today)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[1.143rem] font-semibold">{b.clientName}</span>
                <span className="block truncate text-[1rem] text-muted">
                  {b.serviceName}
                  {!staffId && b.staff?.displayName ? ` · ${b.staff.displayName}` : ''}
                </span>
              </span>
              <span className="flex-none text-[1rem] font-semibold">{formatDA(b.priceDa)}</span>
            </button>
            <div className="phr-a">
              <Button
                variant="ok"
                sm
                loading={confirming(b.id)}
                disabled={confirming(b.id)}
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
            {setStatus.isError && setStatus.variables?.id === b.id && <ErrorMessage error={setStatus.error} />}
          </div>
        );
      })}
    </section>
  );

  /* ---------------------------------------------------------------- journée */

  const shownPast = showPast ? past : past.slice(-PAST_SHOWN);
  const nowLabel = formatTimeDZ(new Date(now).toISOString());
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
        <ol className="phd">
          {past.length > PAST_SHOWN && !showPast && (
            <li>
              <button type="button" className="phd-more" onClick={() => setShowPast(true)}>
                <I icon={ChevronDown} size={16} />
                {t('{n} rendez-vous passé(s)', { n: past.length - PAST_SHOWN })}
              </button>
            </li>
          )}
          {shownPast.map((b) => (
            <DayRow key={b.id} b={b} state="done" tone={toneVar(toneOf(b))} staff={!staffId} onOpen={setPeek} />
          ))}
          {/* Le repère du moment : entre ce qui est fait et ce qui vient, sauf pendant un
              rendez-vous en cours — sa ligne verte le dit déjà. */}
          {!inProgress && upcoming.length > 0 && past.length > 0 && (
            <li className="phd-now" aria-label={t('Maintenant')}>
              <span className="mono" dir="ltr">{nowLabel}</span>
            </li>
          )}
          {upcoming.map((b) => (
            <DayRow
              key={b.id}
              b={b}
              state={b === next && inProgress ? 'live' : 'next'}
              tone={toneVar(toneOf(b))}
              staff={!staffId}
              onOpen={setPeek}
            />
          ))}
        </ol>
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

/** Une ligne de la frise : heure, point sur le rail, client et prestation, prix. */
function DayRow({
  b,
  state,
  tone,
  staff,
  onOpen,
}: {
  b: BookingWithStaff;
  state: 'done' | 'live' | 'next';
  tone: string;
  staff: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`phd-r ${state}`}
        style={{ ['--tone' as string]: tone }}
        onClick={() => onOpen(b.id)}
      >
        <span className="phd-h mono" dir="ltr">
          {formatTimeDZ(b.startsAt)}
          <span>{formatTimeDZ(b.endsAt)}</span>
        </span>
        <span className="phd-p" aria-hidden />
        <span className="phd-c">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1rem] font-semibold">{b.clientName}</span>
            <span className="block truncate text-[0.857rem] text-muted">
              {b.serviceName}
              {staff && b.staff?.displayName ? ` · ${b.staff.displayName}` : ''}
            </span>
          </span>
          <span className="flex flex-none flex-col items-end gap-1">
            <span className="text-[1rem] font-semibold">{formatDA(b.priceDa)}</span>
            {(b.status !== 'confirmed' || state === 'done') && <StatusBadge status={b.status} />}
          </span>
        </span>
      </button>
    </li>
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
