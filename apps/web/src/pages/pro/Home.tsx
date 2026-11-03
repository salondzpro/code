/**
 * PRO-F 22 — Accueil professionnel (refonte du 3 nov. 2026 : identité NOIRE de Salon DZ, simplicité
 * de mew3id sans la copier). Ce qu'un professionnel doit comprendre en cinq secondes, dans l'ordre :
 *
 *   1. l'EN-TÊTE : sa photo, le nom du salon, la date ; la cloche ; « + » nouveau rendez-vous ;
 *   2. le BANDEAU DU JOUR, en noir plat : rendez-vous terminés sur le total, demandes à valider
 *      (abricot dès qu'il y en a), chiffre d'affaires du jour — chaque chiffre mène à son écran — et,
 *      dessous, la journée rendez-vous par rendez-vous (la longueur de chaque trait = sa durée) ;
 *   3. trois ACTIONS RAPIDES : mon lien (partager, copier), mon code QR, mes disponibilités ;
 *   4. MA JOURNÉE en frise compacte : heure de début et de fin, client, prestation, prix, statut.
 *      Le prochain rendez-vous (ou celui en cours) porte « dans 1 h 20 » et ses gestes (appeler,
 *      message prêt, confirmer une demande) ; ce qui est passé se replie en une ligne. Un conseil
 *      seulement quand il sert : des créneaux encore libres aujourd'hui → les partager ;
 *   5. VOTRE PAGE : visites et réservations en ligne de la semaine, visites jour par jour ;
 *   6. À VENIR : les prochains rendez-vous des jours suivants, et l'agenda.
 *
 * Une équipe (≥ 2 personnes actives) voit en plus le filtre par membre, avec photos : il s'applique
 * à tout l'écran (chiffres compris). 95 % des pros travaillent seuls : pour eux, aucune mention
 * d'équipe. À partir de 1 024 px : la journée à gauche, les outils, la page et la suite à droite.
 *
 * Toutes les données sont réelles (rendez-vous, demandes, disponibilités, visites de la page) et
 * rien n'est estimé : le chiffre d'affaires du jour est la somme des rendez-vous confirmés ou
 * terminés du jour, exactement la règle du serveur (`pro_stats`). Un bloc dont la donnée manque ne
 * s'affiche pas (les visites, tant que la migration 0053 n'est pas appliquée en production).
 * SalonDZ n'envoie jamais de WhatsApp lui-même : wa.me s'ouvre chez le professionnel.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import {
  Bell,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  Phone,
  Plus,
  QrCode,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import {
  useAvailability,
  useMe,
  useProBookingMutations,
  useProBookings,
  useProPageStats,
  useProPendingBookings,
  useProSalon,
  useSeenOnDisplay,
  useUnreadNotifications,
} from '@salondz/api-client';
import {
  addDaysToKey,
  formatDA,
  formatLocale,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
  untilLabelFR,
  weekKeys,
} from '@salondz/constants';
import type { BookingWithStaff, SalonOwnerView } from '@salondz/types';
import { Avatar, BottomSheet, Button, Dim, I, Pill, Skeleton, Toast } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { NotificationsNudge } from '@/components/NotificationsNudge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { BookingPeekSheet } from '@/components/BookingPeekSheet';
import { QuickCloseBanner } from '@/components/QuickClose';
import { StaffFilter } from '@/components/StaffFilter';
import { useStaffFilter } from '@/lib/proPrefs';
import { useDesktop } from '@/lib/breakpoint';
import { drawStory, shareImage } from '@/lib/storyImage';
import { ShareSheet, useLabelUrl, usePublicUrl, useQr } from './Link';
import { t } from '@/i18n';

/** Horizon de « À venir » (jours après aujourd'hui) et nombre de rendez-vous montrés. */
const NEXT_DAYS = 14;
const NEXT_SHOWN = 4;

/** Heure courante rafraîchie chaque minute (« dans 25 min », « en cours »). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const ms = (iso: string) => new Date(iso).getTime();
const byStart = (a: BookingWithStaff, b: BookingWithStaff) => a.startsAt.localeCompare(b.startsAt);
const dayOf = (iso: string) => toLocalDateKey(new Date(iso));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « 14:30 » → « 14h30 », « 14:00 » → « 14h » (décalé de `add` minutes). */
const hfr = (hm: string, add = 0) => {
  const [h, m] = hm.split(':').map(Number);
  const x = h! * 60 + (m ?? 0) + add;
  const mm = ((x % 60) + 60) % 60;
  return `${Math.floor(x / 60)}h${mm ? String(mm).padStart(2, '0') : ''}`;
};
/** « 10h, 13h30 et 16h ». */
const joinTimes = (list: string[]) =>
  list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} ${t('et')} ${list[list.length - 1]}`;

/**
 * État d'un rendez-vous du jour, tel qu'on le LIT : passé (terminé ou absent), en cours, confirmé,
 * à valider. Un confirmé dont l'heure de fin est passée est terminé — le serveur ne le clôt
 * qu'au bout de trois heures, l'écran n'a pas à attendre.
 */
type RowKey = 'done' | 'noshow' | 'live' | 'confirmed' | 'pending';
function rowKey(b: BookingWithStaff, now: number): RowKey {
  if (b.status === 'no_show') return 'noshow';
  if (b.status === 'completed') return 'done';
  if (b.status === 'pending') return 'pending';
  if (ms(b.endsAt) <= now) return 'done';
  if (ms(b.startsAt) <= now) return 'live';
  return 'confirmed';
}
const rowLabel = (k: RowKey) =>
  k === 'done'
    ? t('Terminé')
    : k === 'noshow'
      ? t('Absent')
      : k === 'live'
        ? t('En cours')
        : k === 'pending'
          ? t('À valider')
          : t('Confirmé');

type Sheet =
  | { kind: 'share' }
  | { kind: 'qr' }
  | { kind: 'dispo' }
  | { kind: 'msg'; b: BookingWithStaff; tpl: number }
  | null;

export function ProHome() {
  const me = useMe();
  const proSalon = useProSalon().data;
  const salon = proSalon?.salon ?? null;
  const desktop = useDesktop();
  const today = toLocalDateKey();
  const tomorrow = addDaysToKey(today, 1);
  const week = weekKeys(today);
  const todayList = useProBookings({ from: today, to: today, limit: 50 }, !!salon);
  const nextList = useProBookings({ from: tomorrow, to: addDaysToKey(today, NEXT_DAYS), limit: 30 }, !!salon);
  const pending = useProPendingBookings(!!salon);
  const pageStats = useProPageStats(week[0]!, week[6]!, !!salon);
  const unread = useUnreadNotifications(!!salon);
  const [staffId, setStaffId] = useStaffFilter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const now = useNow();
  const { setStatus } = useProBookingMutations();
  // Lien PARTAGÉ (`/s/…`, le seul qui porte l'aperçu WhatsApp) et lien COURT du QR (`salondz.com/…`).
  const share = usePublicUrl(salon?.slug ?? '');
  const label = useLabelUrl(salon?.slug ?? '');

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  /* ------------------------------------------------------------------ données */
  const members = salon?.staff.filter((m) => m.isActive) ?? [];
  const team = members.length > 1;
  const meStaffId = members.find((m) => m.userId && m.userId === me.data?.profile?.id)?.id ?? null;
  const filterOn = team && staffId && members.some((m) => m.id === staffId) ? staffId : null;
  const mine = <T extends { staffId: string | null }>(list: T[]) => (filterOn ? list.filter((b) => b.staffId === filterOn) : list);

  const allToday = (todayList.data?.items ?? []).filter((b) => b.status !== 'cancelled').sort(byStart);
  const day = mine(allToday);
  const upcoming = day.filter((b) => ms(b.endsAt) > now && (b.status === 'pending' || b.status === 'confirmed'));
  const past = day.filter((b) => !upcoming.includes(b));
  const liveCount = upcoming.filter((b) => b.status === 'confirmed' && ms(b.startsAt) <= now).length;
  const women = salon?.genderTarget === 'women';
  const doneCount = day.filter((b) => rowKey(b, now) === 'done').length;
  const revenue = day.filter((b) => b.status === 'confirmed' || b.status === 'completed').reduce((s, b) => s + b.priceDa, 0);
  const toValidate = mine(pending.data?.items ?? []).length;
  const counts: Record<string, number> = {};
  for (const b of allToday) counts[b.staffId] = (counts[b.staffId] ?? 0) + 1;

  const nextAll = mine((nextList.data?.items ?? []).filter((b) => b.status === 'pending' || b.status === 'confirmed')).sort(byStart);
  const nextShown = nextAll.slice(0, NEXT_SHOWN);
  const tomorrowCount = nextAll.filter((b) => dayOf(b.startsAt) === tomorrow).length;

  // Ce que l'accueil MONTRE vaut lecture : la journée et les prochains jours affichés.
  useSeenOnDisplay(
    [...day, ...nextShown].map((b) => b.id),
    !!salon && !todayList.isFetching && !nextList.isFetching,
  );

  // Créneaux encore libres aujourd'hui : la prestation la plus courte (la plus facile à caser) sert
  // d'étalon, et le membre filtré s'il y en a un — c'est son agenda qu'on regarde.
  const services = (salon?.services ?? []).filter((s) => s.isActive);
  const shortest = [...services].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const freeToday = useAvailability(salon?.id ?? '', {
    serviceId: shortest?.id ?? '',
    date: today,
    ...(filterOn ? { staffId: filterOn } : {}),
  });
  const leftToday = (freeToday.data?.slots ?? []).filter((s) => ms(s.startsAt) > now).length;

  const profile = proSalon?.owner ?? me.data?.profile;
  const avatar = (profile && 'avatarUrl' in profile ? profile.avatarUrl : null) ?? salon?.logoUrl ?? salon?.coverUrl ?? null;
  const dateLine = cap(
    new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date()),
  );

  const openWa = (phone: string | null, text?: string) => {
    if (!phone) return;
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`, '_blank', 'noopener');
  };

  /* ------------------------------------------------------------------ 1. en-tête */
  const header = (
    <header className="prh-hd">
      <Link to="/pro/profil" className="prh-id" aria-label={`${salon?.name ?? t('Profil du salon')} · ${t('Profil du salon')}`}>
        <Avatar src={avatar} name={salon?.name ?? 'S'} size={48} />
        <span className="prh-id-t">
          <span className="prh-id-n">{salon?.name ?? ' '}</span>
          <span className="prh-id-d">{dateLine}</span>
        </span>
      </Link>
      {/* Sur ordinateur, l'en-tête de l'espace pro porte déjà la cloche et « + Rendez-vous ». */}
      {!desktop && (
        <>
          <Link
            to="/pro/notifications"
            className="prh-ib"
            aria-label={unread ? `${t('Notifications')} · ${unread}` : t('Notifications')}
          >
            <I icon={Bell} size={20} strokeWidth={1.8} />
            {unread > 0 && <span className="prh-ib-d" aria-hidden />}
          </Link>
          <Link to="/pro/rendez-vous/nouveau" className="prh-ib ink" aria-label={t('Nouveau rendez-vous')} title={t('Nouveau rendez-vous')}>
            <I icon={Plus} size={22} strokeWidth={2} />
          </Link>
        </>
      )}
    </header>
  );

  /* ------------------------------------------------------------------ 2. bandeau du jour */
  const ready = !!todayList.data;
  const kpis = (
    <section className="prh-kpi" aria-label={t('Aujourd’hui')}>
      <div className="prh-kpi-r">
        <Link to="/pro/agenda" className="prh-k">
          <span className="prh-k-v" dir="ltr">
            {!ready ? '–' : day.length ? (
              <>
                {doneCount}
                <small>/{day.length}</small>
              </>
            ) : (
              0
            )}
          </span>
          <span className="prh-k-l">{ready && !day.length ? t('Rendez-vous') : t('Terminés')}</span>
        </Link>
        <Link to="/pro/reservations" className={`prh-k${toValidate ? ' pd' : ''}`}>
          <span className="prh-k-v" dir="ltr">{pending.data ? toValidate : '–'}</span>
          <span className="prh-k-l">{t('À valider')}</span>
        </Link>
        <Link to="/pro/chiffre-affaires" className="prh-k" aria-label={`${t("Chiffre d'affaires du jour")} : ${formatDA(revenue)}`}>
          <span className="prh-k-v" dir="ltr">
            {ready ? formatDA(revenue, { withSymbol: false }) : '–'}
            <small>DA</small>
          </span>
          <span className="prh-k-l">{t('CA du jour')}</span>
        </Link>
      </div>
      {day.length > 0 && (
        <div
          className="prh-bar"
          role="img"
          aria-label={[
            past.length ? t('{n} rendez-vous passé(s)', { n: past.length }) : null,
            upcoming.length ? t('{n} à venir', { n: upcoming.length }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          {day.map((b) => {
            const k = rowKey(b, now);
            return (
              <i
                key={b.id}
                className={k === 'done' ? 'd' : k === 'live' ? 'l' : k === 'pending' ? 'p' : k === 'noshow' ? 'x' : ''}
                style={{ flexGrow: Math.max(15, b.durationMinutes) } as CSSProperties}
              />
            );
          })}
        </div>
      )}
    </section>
  );

  /* ------------------------------------------------------------------ 3. actions rapides */
  const actions = salon && (
    <nav className="prh-qa" aria-label={t('Actions rapides')}>
      <button type="button" className="prh-q" onClick={() => setSheet({ kind: 'share' })}>
        <span className="prh-q-i" aria-hidden>
          <I icon={Link2} size={20} strokeWidth={1.9} />
        </span>
        <span className="prh-q-l">{t('Mon lien')}</span>
      </button>
      <button type="button" className="prh-q" onClick={() => setSheet({ kind: 'qr' })}>
        <span className="prh-q-i" aria-hidden>
          <I icon={QrCode} size={20} strokeWidth={1.9} />
        </span>
        <span className="prh-q-l">{t('Code QR')}</span>
      </button>
      <button type="button" className="prh-q" onClick={() => setSheet({ kind: 'dispo' })}>
        <span className="prh-q-i" aria-hidden>
          <I icon={CalendarClock} size={20} strokeWidth={1.9} />
        </span>
        <span className="prh-q-l">{t('Mes disponibilités')}</span>
      </button>
    </nav>
  );

  /* ------------------------------------------------------------------ 4. ma journée */
  const showStaff = team && !filterOn;
  // Journée finie : on montre ce qui a été fait. Sinon, le passé se replie en une ligne.
  const pastOpen = showPast || !upcoming.length;
  const dayBlock = (
    <section aria-labelledby="prh-day">
      <div className="prh-sh">
        <h2 id="prh-day">{t('Ma journée')}</h2>
        {ready && day.length > 0 && (
          <span className="prh-sh-x">
            {!upcoming.length
              ? t('Journée terminée')
              : [
                  liveCount === 1 ? t('1 en cours') : liveCount > 1 ? t('{n} en cours', { n: liveCount }) : null,
                  upcoming.length - liveCount ? t('{n} à venir', { n: upcoming.length - liveCount }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </span>
        )}
      </div>
      {todayList.isPending && <Skeleton className="h-[11rem] w-full !rounded-[var(--radius-card)]" />}
      {todayList.isError && <ErrorMessage error={todayList.error} retry={() => todayList.refetch()} />}
      {ready &&
        (day.length ? (
          <div className="prh-card prh-day">
            <ol className="prh-tl">
              {!pastOpen && past.length > 0 && (
                <li className="prh-r done">
                  <button type="button" className="prh-r-b prh-fold" aria-expanded={false} onClick={() => setShowPast(true)}>
                    <span className="prh-r-h" aria-hidden />
                    <span className="prh-r-p" aria-hidden />
                    <span className="prh-fold-t">
                      {past.length === 1 ? t('1 rendez-vous passé') : t('{n} rendez-vous passés', { n: past.length })}
                    </span>
                    <span className="prh-fold-e" aria-hidden>
                      <I icon={ChevronDown} size={18} strokeWidth={2} />
                    </span>
                  </button>
                </li>
              )}
              {pastOpen &&
                past.map((b) => <DayRow key={b.id} b={b} now={now} showStaff={showStaff} meStaffId={meStaffId} onOpen={setPeek} />)}
              {upcoming.map((b, i) => (
                <DayRow
                  key={b.id}
                  b={b}
                  now={now}
                  showStaff={showStaff}
                  meStaffId={meStaffId}
                  focus={i === 0}
                  onOpen={setPeek}
                  onMessage={() => setSheet({ kind: 'msg', b, tpl: 0 })}
                  confirm={
                    i === 0 && b.status === 'pending'
                      ? {
                          run: () => setStatus.mutate({ id: b.id, status: 'confirmed' }),
                          busy: setStatus.isPending,
                          error: setStatus.error,
                        }
                      : undefined
                  }
                />
              ))}
            </ol>
            {leftToday > 0 && (
              // Le seul conseil de la journée, et seulement quand il sert : remplir ce qui reste.
              <button type="button" className="prh-tip" onClick={() => setSheet({ kind: 'dispo' })}>
                <I icon={Sparkles} size={16} strokeWidth={2} />
                <span>
                  {leftToday === 1 ? t('Encore 1 créneau libre aujourd’hui') : t('Encore {n} créneaux libres aujourd’hui', { n: leftToday })}
                </span>
                <b>{t('Partager')}</b>
              </button>
            )}
            {!upcoming.length && tomorrowCount > 0 && (
              <p className="prh-tip">
                <I icon={CalendarDays} size={16} strokeWidth={2} />
                <span>{t('Demain : {n} rendez-vous.', { n: tomorrowCount })}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="prh-card prh-empty">
            <span className="prh-empty-i" aria-hidden>
              <I icon={CalendarDays} size={22} strokeWidth={1.8} />
            </span>
            <b>{t('Aucun rendez-vous aujourd’hui')}</b>
            <p>
              {leftToday === 1
                ? t('Il vous reste 1 créneau libre aujourd’hui.')
                : leftToday > 1
                  ? t('Il vous reste {n} créneaux libres aujourd’hui.', { n: leftToday })
                  : t('Partagez vos disponibilités pour remplir votre agenda.')}
            </p>
            <div className="prh-empty-a col">
              <Button sm onClick={() => setSheet({ kind: 'dispo' })}>
                <I icon={Send} size={16} strokeWidth={2} /> {t('Envoyer mes disponibilités')}
              </Button>
              <Link to="/pro/rendez-vous/nouveau" className="btn g sm">
                <I icon={Plus} size={16} strokeWidth={2} /> {t('Ajouter un rendez-vous')}
              </Link>
            </div>
          </div>
        ))}
    </section>
  );

  /* ------------------------------------------------------------------ 5. votre page */
  const ps = pageStats.data;
  const maxViews = Math.max(1, ...(ps?.byDay.map((d) => d.views) ?? [1]));
  const pageBlock = ps && (
    <section aria-labelledby="prh-page">
      <div className="prh-sh">
        <h2 id="prh-page">{t('Votre page')}</h2>
        <span className="prh-sh-x">{t('Cette semaine')}</span>
      </div>
      <div className="prh-card prh-pg">
        <div className="prh-pg-m">
          <div className="prh-pg-n">
            <div>
              <b dir="ltr">{ps.total}</b>
              <span>{ps.total === 1 ? t('visite') : t('visites')}</span>
            </div>
            <div>
              <b dir="ltr">{ps.bookings}</b>
              <span>{ps.bookings === 1 ? t('réservation') : t('réservations')}</span>
            </div>
          </div>
          <div className="prh-pg-b" role="img" aria-label={`${t('Visites par jour')} : ${ps.byDay.map((d) => d.views).join(', ')}`}>
            {ps.byDay.map((d) => (
              <span key={d.date}>
                <i
                  className={d.date === today ? 'on' : d.date > today ? 'fut' : ''}
                  style={{ height: `${d.date > today ? 3 : Math.max(3, Math.round((d.views / maxViews) * 34))}px` }}
                />
                <small aria-hidden>
                  {new Intl.DateTimeFormat(formatLocale(), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${d.date}T12:00:00Z`))}
                </small>
              </span>
            ))}
          </div>
        </div>
        {ps.total === 0 ? (
          <button type="button" className="prh-tip" onClick={() => setSheet({ kind: 'share' })}>
            <I icon={Sparkles} size={16} strokeWidth={2} />
            <span>{t('Partagez votre lien pour recevoir vos premières visites.')}</span>
            <b>{t('Partager')}</b>
          </button>
        ) : (
          ps.bookings === 0 &&
          ps.total >= 5 && (
            <Link to="/pro/profil/horaires" className="prh-tip">
              <I icon={Sparkles} size={16} strokeWidth={2} />
              <span>{t('Des visites, pas encore de réservation : vérifiez vos horaires.')}</span>
              <I icon={ChevronRight} size={16} strokeWidth={2} className="rtl:rotate-180" />
            </Link>
          )
        )}
      </div>
    </section>
  );

  /* ------------------------------------------------------------------ 6. à venir */
  const nextBlock = (
    <section aria-labelledby="prh-next">
      <div className="prh-sh">
        <h2 id="prh-next">{t('À venir')}</h2>
        <Link to="/pro/agenda" className="prh-sh-l">
          {t('Voir l’agenda')}
          <I icon={ChevronRight} size={15} strokeWidth={2.2} className="rtl:rotate-180" />
        </Link>
      </div>
      {nextList.isPending && <Skeleton className="h-[8rem] w-full !rounded-[var(--radius-card)]" />}
      {nextList.isError && <ErrorMessage error={nextList.error} retry={() => nextList.refetch()} />}
      {nextList.data &&
        (nextShown.length ? (
          <div className="prh-card prh-nx">
            {nextShown.map((b) => (
              <button key={b.id} type="button" className="prh-nx-r" onClick={() => setPeek(b.id)}>
                <span className="prh-nx-d">
                  <small>{relativeDayLabelDZ(dayOf(b.startsAt), today)}</small>
                  <b dir="ltr">{formatTimeDZ(b.startsAt)}</b>
                </span>
                <span className="prh-r-c">
                  <span className="prh-r-n">{b.clientName}</span>
                  <span className="prh-r-s">
                    {b.serviceName}
                    {showStaff && b.staff ? ` · ${b.staffId === meStaffId ? t('Vous') : b.staff.displayName}` : ''}
                  </span>
                </span>
                <span className="prh-r-e">
                  <span className="prh-r-pr" dir="ltr">
                    {formatDA(b.priceDa)}
                  </span>
                  {b.status === 'pending' && <span className="prh-st pending">{t('À valider')}</span>}
                </span>
              </button>
            ))}
            {nextAll.length > NEXT_SHOWN && (
              <Link to="/pro/reservations" className="prh-tip">
                <span>
                  {nextAll.length - NEXT_SHOWN === 1
                    ? t('Et 1 autre rendez-vous')
                    : t('Et {n} autres rendez-vous', { n: nextAll.length - NEXT_SHOWN })}
                </span>
                <I icon={ChevronRight} size={16} strokeWidth={2} className="rtl:rotate-180" />
              </Link>
            )}
          </div>
        ) : (
          <div className="prh-card prh-empty sm">
            <span className="prh-empty-i" aria-hidden>
              <I icon={CalendarDays} size={20} strokeWidth={1.8} />
            </span>
            <b>{t('Rien de prévu les prochains jours')}</b>
            <p>{t('Vos prochains rendez-vous s’afficheront ici dès qu’ils seront pris.')}</p>
            {day.length > 0 && (
              <div className="prh-empty-a">
                <Button variant="g" sm auto onClick={() => setSheet({ kind: 'dispo' })}>
                  <I icon={Send} size={16} strokeWidth={2} /> {t('Envoyer mes disponibilités')}
                </Button>
              </div>
            )}
          </div>
        ))}
    </section>
  );

  return (
    <Screen bottom={NAV_PAD} gap={18} className="prh">
      {header}
      <NotificationsNudge role="pro" />
      {salon && <QuickCloseBanner />}
      <div className="prh-g">
        <div className="prh-m">
          {team && salon && (
            <StaffFilter staff={salon.staff} value={filterOn} onChange={setStaffId} counts={counts} meStaffId={meStaffId} />
          )}
          {kpis}
          {!desktop && actions}
          {dayBlock}
        </div>
        <div className="prh-s">
          {desktop && actions}
          {pageBlock}
          {nextBlock}
        </div>
      </div>

      {toast && <Toast icon={Check}>{toast}</Toast>}
      {sheet?.kind === 'share' && salon && (
        <ShareSheet name={salon.name} url={share.url} short={share.short} logo={salon.logoUrl} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'qr' && salon && (
        <QrSheet url={`${label.url}?src=qr`} name={salon.name} slug={salon.slug} women={women} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'dispo' && salon && (
        <DispoSheet
          salon={salon}
          url={share.url}
          short={label.short}
          women={women}
          today={today}
          now={now}
          onClose={() => setSheet(null)}
          onDone={(text) => {
            setSheet(null);
            if (text) setToast(text);
          }}
        />
      )}
      {sheet?.kind === 'msg' && salon && (
        <MessageSheet
          b={sheet.b}
          tpl={sheet.tpl}
          salon={salon}
          onTpl={(tpl) => setSheet({ ...sheet, tpl })}
          onClose={() => setSheet(null)}
          onDone={(text) => {
            setSheet(null);
            setToast(text);
          }}
          onSend={(text) => {
            openWa(sheet.b.clientPhone, text);
            setSheet(null);
          }}
        />
      )}
      {peek && <BookingPeekSheet id={peek} onClose={() => setPeek(null)} />}
    </Screen>
  );
}

/* ================================================================== une ligne de la journée */

/**
 * Une ligne de la frise : heure de début et de fin, point sur le rail (sa FORME et sa couleur disent
 * l'état : creux = à venir, plein = passé ou en cours ; vert = confirmé ou terminé, abricot = à
 * valider, noir = en cours), client, prestation, prix et statut. La ligne `focus` (le prochain
 * rendez-vous, ou celui en cours) ajoute le délai et les gestes : appeler, message prêt, et
 * « Confirmer » si c'est une demande.
 */
function DayRow({
  b,
  now,
  showStaff,
  meStaffId,
  focus,
  onOpen,
  onMessage,
  confirm,
}: {
  b: BookingWithStaff;
  now: number;
  showStaff: boolean;
  meStaffId: string | null;
  focus?: boolean;
  onOpen: (id: string) => void;
  onMessage?: () => void;
  /** Le prochain rendez-vous est une DEMANDE : la valider d'ici (une seule mutation, portée par l'accueil). */
  confirm?: { run: () => void; busy: boolean; error: unknown };
}) {
  const k = rowKey(b, now);
  return (
    <li className={`prh-r ${k}${focus ? ' focus' : ''}`}>
      <button
        type="button"
        className="prh-r-b"
        onClick={() => onOpen(b.id)}
        aria-label={`${formatTimeDZ(b.startsAt)} – ${formatTimeDZ(b.endsAt)}, ${b.clientName}, ${b.serviceName}, ${formatDA(b.priceDa)}, ${rowLabel(k)}`}
      >
        <span className="prh-r-h">
          <b dir="ltr">{formatTimeDZ(b.startsAt)}</b>
          <span dir="ltr">{formatTimeDZ(b.endsAt)}</span>
        </span>
        <span className="prh-r-p" aria-hidden />
        <span className="prh-r-c">
          <span className="prh-r-n">{b.clientName}</span>
          <span className="prh-r-s">
            {b.serviceName}
            {showStaff && b.staff ? ` · ${b.staffId === meStaffId ? t('Vous') : b.staff.displayName}` : ''}
          </span>
        </span>
        <span className="prh-r-e">
          <span className="prh-r-pr" dir="ltr">
            {formatDA(b.priceDa)}
          </span>
          <span className={`prh-st ${k}`}>{rowLabel(k)}</span>
        </span>
      </button>
      {focus && (
        <div className="prh-r-f">
          <span className={`prh-when${k === 'live' ? ' live' : k === 'pending' ? ' pd' : ''}`}>
            {k === 'live' ? t('Fin à {time}', { time: formatTimeDZ(b.endsAt) }) : cap(untilLabelFR(b.startsAt, now))}
          </span>
          <span className="flex-1" />
          {b.clientPhone && (
            <>
              <a href={`tel:${b.clientPhone}`} className="prh-r-a" aria-label={t('Appeler {name}', { name: b.clientName })} title={t('Appeler')}>
                <I icon={Phone} size={18} strokeWidth={1.9} />
              </a>
              <button
                type="button"
                className="prh-r-a wa"
                aria-label={t('Message à {first}', { first: b.clientName.split(' ')[0] ?? b.clientName })}
                title={t('Message')}
                onClick={onMessage}
              >
                <I icon={MessageCircle} size={18} strokeWidth={1.9} />
              </button>
            </>
          )}
        </div>
      )}
      {confirm && (
        // Une demande est le prochain rendez-vous : la valider est LE geste du moment.
        <div className="prh-r-ok">
          <Button sm loading={confirm.busy} onClick={confirm.run}>
            <I icon={Check} size={16} strokeWidth={2.2} /> {t('Confirmer la demande')}
          </Button>
        </div>
      )}
      {confirm?.error != null && (
        <div className="prh-r-err">
          <ErrorMessage error={confirm.error} />
        </div>
      )}
    </li>
  );
}

/* ================================================================== feuilles */

function SheetHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="prh-shh">
      <div className="min-w-0 flex-1">
        <h2 className="h2">{title}</h2>
        {sub && (
          <p className="prh-shh-s" dir="auto">
            {sub}
          </p>
        )}
      </div>
      <button type="button" className="rx" aria-label={t('Fermer')} onClick={onClose}>
        <I icon={X} size={18} />
      </button>
    </div>
  );
}

/** Code QR de la page (lien court + `?src=qr`, pour compter d'où viennent les visites). */
function QrSheet({ url, name, slug, women, onClose }: { url: string; name: string; slug: string; women: boolean; onClose: () => void }) {
  const qr = useQr(url, 560);
  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal label={t('Code QR de votre page')} className="prh-sheet">
        <SheetHead
          title={t('Code QR de votre page')}
          sub={women ? t('Vos clientes le scannent pour réserver chez {name}.', { name }) : t('Vos clients le scannent pour réserver chez {name}.', { name })}
          onClose={onClose}
        />
        <div className="prh-qr">
          {qr ? <img src={qr} alt={t('Code QR de votre page')} width={220} height={220} /> : <Skeleton className="h-[220px] w-[220px]" />}
        </div>
        <div className="g2">
          <Link to="/pro/qr" className="btn g" onClick={onClose}>
            {t('Étiquettes')}
          </Link>
          <a className={`btn${qr ? '' : ' off'}`} href={qr ?? undefined} download={`salondz-qr-${slug}.png`}>
            <I icon={Download} size={18} strokeWidth={2} /> {t('Télécharger')}
          </a>
        </div>
      </BottomSheet>
    </>
  );
}

/**
 * « Mes disponibilités » : un message prêt à envoyer aux clientes qui demandent « dispo ? » en
 * message privé, d'après les VRAIS créneaux de la prestation et du jour choisis — ou la même chose
 * en IMAGE pour une story ou un statut (dessinée dans le navigateur).
 */
function DispoSheet({
  salon,
  url,
  short,
  women,
  today,
  now,
  onClose,
  onDone,
}: {
  salon: SalonOwnerView;
  url: string;
  short: string;
  women: boolean;
  today: string;
  now: number;
  onClose: () => void;
  onDone: (toast: string | null) => void;
}) {
  const services = salon.services.filter((s) => s.isActive);
  const [svc, setSvc] = useState(services[0]?.id ?? '');
  const [day, setDay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const days: (string | null)[] = [null, ...Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i))];
  const date = day ?? today;
  const av = useAvailability(salon.id, { serviceId: svc, date });
  const service = services.find((s) => s.id === svc);
  const dayName = (d: string) =>
    d === today
      ? t('aujourd’hui')
      : d === addDaysToKey(today, 1)
        ? t('demain')
        : new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const dayChip = (d: string | null) =>
    d === null
      ? t('Prochaines dispos')
      : d === today
        ? t('Aujourd’hui')
        : d === addDaysToKey(today, 1)
          ? t('Demain')
          : new Intl.DateTimeFormat(formatLocale(), { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const slotsOf = (list: string[]) => joinTimes(list.slice(0, 5).map((x) => hfr(x)));

  // Les heures du jour choisi (ou, pour « Prochaines dispos », celles d'aujourd'hui puis du
  // prochain jour libre) : le message ET l'image en partent.
  const daySlots = av.data ? av.data.slots.filter((s) => ms(s.startsAt) > now).map((s) => formatTimeDZ(s.startsAt)) : [];
  const nextFree = day === null ? av.data?.nextAvailable ?? null : null;
  let parts = '';
  if (av.data) {
    const a = daySlots.length ? `${dayName(date)} ${t('à')} ${slotsOf(daySlots)}` : '';
    const b = nextFree ? `${dayName(nextFree.date)} ${t('à')} ${slotsOf(nextFree.slots.map((x) => x.slice(0, 5)))}` : '';
    parts = [a, b].filter(Boolean).join(`, ${t('puis')} `);
  }
  const message = parts
    ? t('Salam 😊 Pour {svc}, mes disponibilités : {when}. Réservez directement ici 👉', { svc: service?.name ?? '', when: parts })
    : t('Salam 😊 Pour {svc}, je n’ai plus de créneau ce jour-là. Réservez le prochain directement ici 👉', { svc: service?.name ?? '' });
  const full = `${message} ${url}`;

  const story = daySlots.length
    ? { date, times: daySlots }
    : nextFree
      ? { date: nextFree.date, times: nextFree.slots.map((x) => x.slice(0, 5)) }
      : null;
  const storyTimes = !story
    ? []
    : story.times.length <= 4
      ? story.times
      : [0, 1, 2, 3].map((i) => story.times[Math.round((i * (story.times.length - 1)) / 3)]!);
  const makeStory = async () => {
    if (!story) return;
    setBusy(true);
    try {
      const blob = await drawStory({
        photo: salon.coverUrl ?? salon.photos[0]?.url ?? null,
        dayLabel: cap(story.date === today ? t('Aujourd’hui') : story.date === addDaysToKey(today, 1) ? t('Demain') : dayName(story.date)),
        subtitle: t('créneaux libres'),
        times: storyTimes,
        salon: salon.name,
        link: short,
      });
      if (blob) {
        const shared = await shareImage(blob, `salondz-creneaux-${salon.slug}.png`, `${t('Réservez ici')} 👉 ${url}`);
        onDone(shared ? null : t('Image enregistrée'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal label={t('Envoyer mes disponibilités')} className="prh-sheet">
        <SheetHead
          title={t('Envoyer mes disponibilités')}
          sub={
            women
              ? t('Un message prêt à envoyer aux clientes qui vous demandent vos dispos.')
              : t('Un message prêt à envoyer aux clients qui vous demandent vos dispos.')
          }
          onClose={onClose}
        />
        {services.length > 1 && (
          <div className="prh-f">
            <span className="prh-lbl">{t('Prestation')}</span>
            <div className="pills bleed">
              {services.map((s) => (
                <Pill key={s.id} on={s.id === svc} aria-pressed={s.id === svc} onClick={() => setSvc(s.id)}>
                  {s.name}
                </Pill>
              ))}
            </div>
          </div>
        )}
        <div className="prh-f">
          <span className="prh-lbl">{t('Jour')}</span>
          <div className="pills bleed">
            {days.map((d) => (
              <Pill key={d ?? 'next'} on={d === day} aria-pressed={d === day} onClick={() => setDay(d)}>
                {dayChip(d)}
              </Pill>
            ))}
          </div>
        </div>
        <p className="prh-msg" aria-live="polite">
          {av.isPending && !!svc ? '…' : message}{' '}
          <span className="whitespace-nowrap" dir="ltr">
            {url}
          </span>
        </p>
        <div className="g2">
          <Button
            variant="g"
            onClick={() => {
              void navigator.clipboard?.writeText(full);
              onDone(t('Message copié !'));
            }}
          >
            <I icon={Copy} size={18} strokeWidth={2} /> {t('Copier')}
          </Button>
          <Button
            onClick={() => {
              if (navigator.share) {
                void navigator.share({ text: full }).catch(() => undefined);
                onDone(null);
              } else {
                void navigator.clipboard?.writeText(full);
                onDone(t('Message copié !'));
              }
            }}
          >
            <I icon={Send} size={18} strokeWidth={2} /> {t('Partager')}
          </Button>
        </div>
        <button type="button" className="prh-story" disabled={!story || busy} onClick={() => void makeStory()}>
          <I icon={ImageIcon} size={18} strokeWidth={1.9} />
          <span>{t('En image, pour une story ou un statut')}</span>
          {busy ? <span className="btn-spin" aria-hidden /> : <I icon={ChevronRight} size={16} strokeWidth={2} className="rtl:rotate-180" />}
        </button>
      </BottomSheet>
    </>
  );
}

/** Message prêt pour un client du jour : rappel, retard, plus tôt, adresse — copié ou envoyé par WhatsApp. */
function MessageSheet({
  b,
  tpl,
  salon,
  onTpl,
  onClose,
  onDone,
  onSend,
}: {
  b: BookingWithStaff;
  tpl: number;
  salon: SalonOwnerView;
  onTpl: (n: number) => void;
  onClose: () => void;
  onDone: (toast: string) => void;
  onSend: (text: string) => void;
}) {
  const first = b.clientName.split(' ')[0] ?? b.clientName;
  const start = formatTimeDZ(b.startsAt);
  const address = [salon.address, salon.city].filter(Boolean).join(', ');
  const texts = [
    t('Salam {first} 😊 Petit rappel : votre rendez-vous {svc} chez {salon} est aujourd’hui à {time}. À tout à l’heure !', { first, svc: b.serviceName, salon: salon.name, time: hfr(start) }),
    t('Salam {first}, nous avons environ 15 minutes de retard aujourd’hui. Pouvez-vous venir à {time} ? Merci de votre patience 🙏', { first, time: hfr(start, 15) }),
    t('Salam {first} 😊 Un créneau s’est libéré plus tôt : vous pouvez venir dès {time} si cela vous arrange. Dites-moi !', { first, time: hfr(start, -30) }),
    t('Salam {first}, voici l’adresse du salon : {address}. Votre rendez-vous est à {time}, à tout à l’heure !', { first, address, time: hfr(start) }),
  ];
  const names = [t('Rappel'), t('Retard'), t('Plus tôt'), t('Adresse')];
  const text = texts[tpl] ?? texts[0]!;
  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal label={t('Message à {first}', { first })} className="prh-sheet">
        <SheetHead title={t('Message à {first}', { first })} sub={`${b.serviceName} · ${t('aujourd’hui à {time}', { time: start })}`} onClose={onClose} />
        <div className="prh-f">
          <span className="prh-lbl">{t('Modèle')}</span>
          <div className="pills bleed">
            {names.map((n, i) => (
              <Pill key={n} on={i === tpl} aria-pressed={i === tpl} onClick={() => onTpl(i)}>
                {n}
              </Pill>
            ))}
          </div>
        </div>
        <p className="prh-msg">{text}</p>
        <div className="g2">
          <Button
            variant="g"
            onClick={() => {
              void navigator.clipboard?.writeText(text);
              onDone(t('Message copié !'));
            }}
          >
            <I icon={Copy} size={18} strokeWidth={2} /> {t('Copier')}
          </Button>
          <Button disabled={!b.clientPhone} onClick={() => onSend(text)}>
            <I icon={MessageCircle} size={18} strokeWidth={2} /> WhatsApp
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
