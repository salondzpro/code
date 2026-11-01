/**
 * PRO-F 22 — Accueil professionnel. Refonte du 1er nov. 2026 (« SalonDZ × mew3id », accueil 11 du
 * canevas https://claude.ai/artifact/91Wa36xH7wKniVgraxyKUo) : un accueil CLAIR et simple.
 *
 * Ordre de lecture (téléphone) :
 *   1. « Bonjour » et la date, sur le fond de page (plus de bandeau d'encre), « Arrêt / Pause » à droite ;
 *   2. les PROCHAINES ARRIVÉES : une carte par rendez-vous du jour encore à venir, qu'on fait glisser
 *      de côté — heure → fin, « dans 1 h 20 », client, prestation et prix, membre de l'équipe, note,
 *      et les gestes sous le pouce (appeler, WhatsApp, ouvrir). La dernière carte dit « C'est tout
 *      pour aujourd'hui » et propose de partager son lien. Filtre par membre pour une équipe ;
 *   3. trois chiffres du jour : rendez-vous, demandes à valider (→ Réservations), chiffre d'affaires ;
 *   4. la JOURNÉE DE L'ÉQUIPE en rubans (une ligne par membre, le trait « maintenant » à l'accent) —
 *      seulement pour une équipe : une professionnelle seule a déjà tout dans ses cartes ;
 *   5. le lien de réservation (copier, partager, QR) et la semaine en barres.
 * À partir de 1 024 px, deux colonnes : le travail du jour à gauche, le lien et la semaine à droite.
 *
 * Un rendez-vous s'ouvre en FENÊTRE (`BookingPeekSheet`), comme dans l'agenda. Ce que l'écran montre
 * est marqué VU (`useSeenOnDisplay`) : les pastilles baissent sans qu'il faille ouvrir chaque fiche.
 * SalonDZ n'envoie jamais de WhatsApp lui-même : le bouton ouvre la conversation (wa.me) chez le pro.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Bell, CalendarCheck, ChevronRight, Eye, MessageCircle, Phone, QrCode, Share2, Copy } from 'lucide-react';
import {
  useMe,
  useProBookings,
  useProPendingBookings,
  useProSalon,
  useProStats,
  useProStatsRange,
  useSeenOnDisplay,
  useUnreadNotifications,
} from '@salondz/api-client';
import {
  categoryTone,
  dayOfWeekFromKey,
  formatDA,
  formatLocale,
  formatTimeDZ,
  toLocalDateKey,
  untilLabelFR,
  weekKeys,
} from '@salondz/constants';
import type { BookingWithStaff, SalonOwnerView } from '@salondz/types';
import { Avatar, Button, I, LinkButton, Skeleton, StatusBadge } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { NotificationsNudge } from '@/components/NotificationsNudge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { toneVar } from '@/components/ProBookingCards';
import { StaffFilter } from '@/components/StaffFilter';
import { BookingPeekSheet } from '@/components/BookingPeekSheet';
import { QuickCloseBanner, QuickCloseButton } from '@/components/QuickClose';
import { useStaffFilter } from '@/lib/proPrefs';
import { ShareSheet, useCopy, usePublicUrl } from './Link';
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
  const [staffId, setStaffId] = useStaffFilter();
  const members = salon?.staff.filter((m) => m.isActive) ?? [];
  const team = members.length > 1;
  const byStaff = <T extends { staffId: string | null }>(list: T[]) =>
    staffId && team ? list.filter((b) => b.staffId === staffId) : list;
  // `owner` n'existe que lorsqu'un administrateur pilote ce salon : on salue alors le professionnel,
  // pas l'administrateur dont `me` est le compte.
  const firstName = ((proSalon?.owner ?? me.data?.profile)?.fullName ?? salon?.name ?? '').split(' ')[0];
  const now = useNow();
  const [share, setShare] = useState(false);
  const link = usePublicUrl(salon?.slug ?? '');
  const [copied, copy] = useCopy();
  const nonLues = useUnreadNotifications(!!salon);

  const allToday = (todayList.data?.items ?? [])
    .filter((b) => b.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const todays = byStaff(allToday);
  const isOpen = (b: BookingWithStaff) => b.status === 'pending' || b.status === 'confirmed';
  const upcoming = todays.filter((b) => new Date(b.endsAt).getTime() > now && isOpen(b));
  const toneOf = (b: BookingWithStaff) =>
    categoryTone(salon?.services.find((s) => s.id === b.serviceId)?.categoryId);
  const pendingCount = stats.data?.pendingCount ?? byStaff(pending.data?.items ?? []).length;

  // Ce que l'accueil MONTRE vaut lecture : la journée affichée. Les demandes ne sont pas listées
  // ici : on ne les marque pas vues, sinon l'onglet « Réservations » s'éteindrait trop tôt.
  useSeenOnDisplay(
    todays.map((b) => b.id),
    !!salon && !todayList.isFetching && !pending.isFetching,
  );

  const dateLine = new Intl.DateTimeFormat(formatLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Algiers',
  }).format(new Date());

  /* ---------------------------------------------------------------- prochaines arrivées */

  const arrivals = (
    <section className="flex flex-col gap-2.5" aria-label={t('Prochaines arrivées')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="h2">{t('Prochaines arrivées')}</h2>
        <Link to="/pro/agenda" className="pha-more">
          {t('Agenda')} <I icon={ChevronRight} size={15} className="rtl:rotate-180" />
        </Link>
      </div>
      {team && salon && <StaffFilter staff={salon.staff} value={staffId} onChange={setStaffId} />}
      {todayList.isPending && <Skeleton className="h-[13rem] w-full !rounded-[var(--radius-card)]" />}
      {todayList.isError && <ErrorMessage error={todayList.error} retry={() => todayList.refetch()} />}
      {todayList.data && (
        <div className="pac-row pills bleed" role="list">
          {upcoming.map((b, i) => (
            <Arrival
              key={b.id}
              b={b}
              first={i === 0}
              now={now}
              team={team}
              salon={salon}
              tone={toneVar(toneOf(b))}
              onOpen={() => setPeek(b.id)}
            />
          ))}
          <article className="pac pac-end" role="listitem">
            <span className="pac-ico" aria-hidden>
              <I icon={CalendarCheck} size={20} />
            </span>
            <span className="pac-end-t">
              {upcoming.length ? t('C’est tout pour aujourd’hui') : t('Aucune arrivée prévue aujourd’hui')}
            </span>
            <span className="pac-end-p">{t('Partagez votre lien pour remplir les créneaux libres.')}</span>
            <span className="flex-1" />
            <Button sm onClick={() => setShare(true)}>
              <I icon={Share2} size={16} /> {t('Partager mon lien')}
            </Button>
            <LinkButton to="/pro/agenda" variant="g" sm>
              {t('Ouvrir l’agenda')}
            </LinkButton>
          </article>
        </div>
      )}
    </section>
  );

  /* ---------------------------------------------------------------- chiffres du jour */

  const left = upcoming.length;
  const kpis = (
    <div className="pak" aria-label={t('Votre journée')}>
      <Link to="/pro/agenda" className="pak-c">
        <span className="pak-v">{todayList.data ? todays.length : '–'}</span>
        <span className="pak-l">{t('Aujourd’hui')}</span>
        <span className="pak-s">{todayList.data ? (left ? t('{n} à venir', { n: left }) : todays.length ? t('Terminé') : t('Libre')) : ' '}</span>
      </Link>
      <Link to="/pro/reservations" className={`pak-c ${pendingCount ? 'warn' : ''}`}>
        <span className="pak-v">{stats.isPending ? '–' : pendingCount}</span>
        <span className="pak-l">{t('À valider')}</span>
        <span className="pak-s">{pendingCount ? t('Répondre') : t('Rien en attente')}</span>
      </Link>
      <Link to="/pro/chiffre-affaires" className="pak-c">
        <span className="pak-v whitespace-nowrap">
          <bdi dir="ltr">{stats.isPending ? '–' : amount(stats.data?.todayRevenueDa ?? 0)}</bdi>
        </span>
        <span className="pak-l">{t('DA ce jour')}</span>
        <span className="pak-s">{t('Encaissé')}</span>
      </Link>
    </div>
  );

  /* ---------------------------------------------------------------- lien de réservation */

  const linkCard = salon && (
    <section className="crd pal" aria-label={t('Votre lien de réservation')}>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[0.857rem] text-muted">{t('Votre lien de réservation')}</span>
          <span className="pal-u" dir="ltr">
            {link.short}
          </span>
        </span>
        <Link to="/pro/lien" className="hdr-b soft" aria-label={t('Code QR')} title={t('Code QR')}>
          <I icon={QrCode} size={18} />
        </Link>
      </span>
      <span className="grid grid-cols-2 gap-2">
        <button type="button" className="btn sm soft" onClick={() => copy(link.url)}>
          <I icon={Copy} size={16} /> {copied ? t('Lien copié') : t('Copier')}
        </button>
        <Button sm onClick={() => setShare(true)}>
          <I icon={Share2} size={16} /> {t('Partager')}
        </Button>
      </span>
    </section>
  );

  /* ---------------------------------------------------------------- semaine */

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

  return (
    <Screen bottom={NAV_PAD} gap={16} width="page">
      {/* Les notifications décident si l'application sert à quelque chose quand elle est fermée :
          une demande manquée est un client perdu. Le bandeau ne revient qu'à intervalle. */}
      <NotificationsNudge role="pro" />
      {salon && <QuickCloseBanner />}

      <header className="pah">
        <div className="min-w-0">
          <h1 className="pah-hi">{firstName ? t('Bonjour, {name}', { name: firstName }) : t('Votre journée')}</h1>
          <p className="pah-date">{dateLine}</p>
        </div>
        {salon && <QuickCloseButton openingHours={salon.openingHours} />}
        <Link to="/pro/notifications" className="hdr-b relative lg:!hidden" aria-label={nonLues ? `${t('Notifications')} · ${nonLues}` : t('Notifications')}>
          <I icon={Bell} size={20} strokeWidth={1.8} />
          {nonLues > 0 && <span className="nvd !left-auto !-right-1 !-top-1" aria-hidden>{nonLues > 9 ? '9+' : nonLues}</span>}
        </Link>
      </header>
      {stats.isError && <ErrorMessage error={stats.error} retry={() => stats.refetch()} />}

      <div className="phg">
        <div className="phg-m">
          {arrivals}
          {/* Sur téléphone, le lien vient juste sous les arrivées (voulu par le propriétaire) ; sur
              ordinateur, il est dans la colonne de droite. La semaine, elle, reste sur ordinateur. */}
          <div className="contents lg:hidden">{linkCard}</div>
          {kpis}
          {team && salon && todayList.data && (
            <TeamDay salon={salon} bookings={allToday} now={now} today={today} onOpen={setPeek} />
          )}
        </div>
        <div className="phg-s">
          {linkCard}
          {revenue}
        </div>
      </div>

      {share && salon && (
        <ShareSheet name={salon.name} url={link.url} short={link.short} logo={salon.logoUrl} onClose={() => setShare(false)} />
      )}
      {peek && <BookingPeekSheet id={peek} onClose={() => setPeek(null)} />}
    </Screen>
  );
}

/** Une arrivée : la carte qu'on fait glisser. La première (la plus proche) est soulignée à l'accent. */
function Arrival({
  b,
  first,
  now,
  team,
  salon,
  tone,
  onOpen,
}: {
  b: BookingWithStaff;
  first: boolean;
  now: number;
  team: boolean;
  salon: SalonOwnerView | null;
  tone: string;
  onOpen: () => void;
}) {
  const live = new Date(b.startsAt).getTime() <= now;
  const member = salon?.staff.find((m) => m.id === b.staffId);
  const phone = b.clientPhone?.replace(/\D/g, '');
  return (
    <article
      className={`pac ${first ? 'first' : ''}`}
      role="listitem"
      style={{ ['--tone' as string]: tone } as CSSProperties}
      aria-label={`${b.clientName}, ${b.serviceName}, ${formatTimeDZ(b.startsAt)}`}
    >
      <button type="button" className="pac-top" onClick={onOpen}>
        <Avatar name={b.clientName} size={40} />
        <span className="min-w-0 flex-1">
          <span className="pac-name">{b.clientName}</span>
          <span className={`pac-when ${first ? 'on' : ''}`}>
            <span className="dot" aria-hidden />
            {live ? t('En cours') : untilLabelFR(b.startsAt, now)}
          </span>
        </span>
        <span className="pac-time" dir="ltr">
          <b>{formatTimeDZ(b.startsAt)}</b>
          <span>→ {formatTimeDZ(b.endsAt)}</span>
        </span>
      </button>
      <div className="pac-mid">
        <span className="pac-line">
          <span className="truncate">{b.serviceName}</span>
          <b dir="ltr">{formatDA(b.priceDa)}</b>
        </span>
        {(team || b.status !== 'confirmed') && (
          <span className="pac-line sub">
            {team && b.staff ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <Avatar src={member?.avatarUrl} name={b.staff.displayName} size={20} />
                <span className="truncate">{t('Avec {name}', { name: b.staff.displayName })}</span>
              </span>
            ) : (
              <span />
            )}
            {b.status !== 'confirmed' && <StatusBadge status={b.status} />}
          </span>
        )}
      </div>
      {b.notes && <p className="pac-note">{b.notes}</p>}
      <span className="flex-1" />
      <div className="pac-act">
        {phone ? (
          <>
            <a href={`tel:${b.clientPhone}`} className="pac-b" aria-label={t('Appeler {name}', { name: b.clientName })}>
              <I icon={Phone} size={18} />
              {t('Appeler')}
            </a>
            <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="pac-b wa" aria-label={`WhatsApp ${b.clientName}`}>
              <I icon={MessageCircle} size={18} />
              WhatsApp
            </a>
          </>
        ) : null}
        <button type="button" className="pac-b acc" onClick={onOpen}>
          <I icon={Eye} size={18} />
          {t('Ouvrir')}
        </button>
      </div>
    </article>
  );
}

/**
 * La journée de l'équipe : une ligne par membre, les rendez-vous en barres le long des heures
 * d'ouverture (passés en gris, confirmés en encre, demandes en pointillé), et le trait
 * « maintenant » à l'accent. Composant voulu tel quel par le propriétaire (maquette 7, puis 11).
 */
function TeamDay({
  salon,
  bookings,
  now,
  today,
  onOpen,
}: {
  salon: SalonOwnerView;
  bookings: BookingWithStaff[];
  now: number;
  today: string;
  onOpen: (id: string) => void;
}) {
  const dow = dayOfWeekFromKey(today);
  const hours = salon.openingHours.filter((h) => h.dayOfWeek === dow && !h.isClosed);
  const toMin = (hm: string) => {
    const [h, m] = hm.split(':').map(Number);
    return h! * 60 + (m ?? 0);
  };
  // Minutes depuis minuit, heure d'Alger (l'affichage des heures suit le même fuseau).
  const minOf = (iso: string) => toMin(formatTimeDZ(iso));
  let start = hours.length ? Math.min(...hours.map((h) => toMin(h.opensAt))) : 9 * 60;
  let end = hours.length ? Math.max(...hours.map((h) => toMin(h.closesAt))) : 20 * 60;
  for (const b of bookings) {
    start = Math.min(start, minOf(b.startsAt));
    end = Math.max(end, minOf(b.endsAt));
  }
  start = Math.floor(start / 60) * 60;
  end = Math.max(start + 120, Math.ceil(end / 60) * 60);
  const span = end - start;
  const pos = (m: number) => `${((m - start) / span) * 100}%`;
  const nowMin = minOf(new Date(now).toISOString());
  const step = span > 8 * 60 ? 120 : 60;
  const marks: number[] = [];
  for (let m = start; m <= end; m += step) marks.push(m);
  const members = salon.staff.filter((m) => m.isActive);

  return (
    <section className="crd ptd" aria-label={t('La journée de l’équipe')}>
      <h2 className="h3">{t('La journée de l’équipe')}</h2>
      {/* L'axe du temps va toujours de gauche à droite, comme dans l'agenda, même en arabe. */}
      <div className="ptd-g" dir="ltr">
        {members.map((m) => (
          <div key={m.id} className="ptd-r">
            <Avatar src={m.avatarUrl} name={m.displayName} size={26} />
            <div className="ptd-t">
              {bookings
                .filter((b) => b.staffId === m.id)
                .map((b) => {
                  const done = new Date(b.endsAt).getTime() <= now || b.status === 'completed' || b.status === 'no_show';
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`ptd-b ${done ? 'done' : b.status === 'pending' ? 'pd' : ''}`}
                      style={{ left: pos(minOf(b.startsAt)), width: `max(0.5rem, ${((minOf(b.endsAt) - minOf(b.startsAt)) / span) * 100}%)` }}
                      onClick={() => onOpen(b.id)}
                      aria-label={`${m.displayName} · ${formatTimeDZ(b.startsAt)} · ${b.clientName}`}
                    />
                  );
                })}
            </div>
          </div>
        ))}
        {nowMin >= start && nowMin <= end && (
          <span className="ptd-now" aria-hidden style={{ ['--f' as string]: ((nowMin - start) / span).toFixed(4) } as CSSProperties} />
        )}
      </div>
      <div className="ptd-h" dir="ltr" aria-hidden>
        {marks.map((m) => (
          <span key={m} style={{ left: pos(m) }}>
            {Math.floor(m / 60)}h
          </span>
        ))}
      </div>
    </section>
  );
}
