/**
 * PRO-F 22 — Accueil professionnel = EXACTEMENT la maquette 11 du canevas
 * (https://claude.ai/artifact/91Wa36xH7wKniVgraxyKUo, `Accueil11.dc.html`), demandée « sans rien
 * changer » par le propriétaire le 1er nov. 2026. Les valeurs (tailles, arrondis, ombres) sont
 * celles de la maquette, dans les classes `h11-*` d'index.css ; les données sont les vraies :
 *
 *   1. bonjour (avatar, « Bonjour » en italique, date) et la cloche ;
 *   2. PROCHAINES ARRIVÉES : une carte par rendez-vous du jour à venir, à glisser de côté — client,
 *      « dans 1 h 20 », heure → fin, prestation et prix, membre (équipe), fidélité, note, et quatre
 *      gestes : Appeler, WhatsApp, Rappel (messages prêts), Plus (fiche, reporter, retard, annuler).
 *      Carte de fin : créneaux libres restants, rendez-vous de demain, partager ses créneaux ;
 *   3. le LIEN de réservation : copier, code QR (fenêtre « Réservez votre créneau »), envoyer ses
 *      disponibilités (message prérempli d'après les vrais créneaux) ;
 *   4. VOTRE PAGE : visites de la semaine, réservations en ligne, visites par jour, provenance ;
 *   5. la STORY des créneaux libres de demain, à partager (image dessinée dans le navigateur) ;
 *   6. la JOURNÉE DE L'ÉQUIPE en rubans — seulement pour une équipe.
 * Filtre par membre et mention du membre : seulement à partir de deux personnes (95 % des pros
 * travaillent seuls). SalonDZ n'envoie jamais de WhatsApp lui-même : wa.me s'ouvre chez le pro.
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { Bell, CalendarCheck, CalendarClock, Check, Clock, Copy, Download, FileText, Instagram, Link2, MessageCircle, MoreHorizontal, Phone, QrCode, Send, Sparkles, UserRound, Users, X, XCircle, BellRing } from 'lucide-react';
import {
  useAvailability,
  useMe,
  useProBookings,
  useProClients,
  useProPageStats,
  useProPendingBookings,
  useProSalon,
  useSeenOnDisplay,
  useUnreadNotifications,
} from '@salondz/api-client';
import { addDaysToKey, formatDA, formatLocale, formatTimeDZ, toLocalDateKey, untilLabelFR, weekKeys } from '@salondz/constants';
import type { BookingWithStaff, ProClient, SalonOwnerView, Staff } from '@salondz/types';
import { Avatar, I, Skeleton } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { NotificationsNudge } from '@/components/NotificationsNudge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { BookingPeekSheet } from '@/components/BookingPeekSheet';
import { QuickCloseBanner } from '@/components/QuickClose';
import { useStaffFilter } from '@/lib/proPrefs';
import { drawStory, shareImage } from '@/lib/storyImage';
import { useCopy, useLabelUrl, useQr } from './Link';
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
const elide = (name: string) => (/^[aeiouyéèêâîôûh]/i.test(name) ? `d’${name}` : `de ${name}`);

type Toast = { text: string; kind: 'ok' | 'call' | 'wa' } | null;
type Sheet =
  | { kind: 'qr' }
  | { kind: 'dispo' }
  | { kind: 'msg'; b: BookingWithStaff; tpl: number }
  | { kind: 'more'; b: BookingWithStaff }
  | null;

export function ProHome() {
  const me = useMe();
  const proSalon = useProSalon().data;
  const salon = proSalon?.salon ?? null;
  const today = toLocalDateKey();
  const tomorrow = addDaysToKey(today, 1);
  const week = weekKeys(today);
  const todayList = useProBookings({ from: today, to: today, limit: 50 }, !!salon);
  const tomorrowList = useProBookings({ from: tomorrow, to: tomorrow, limit: 50 }, !!salon);
  const pending = useProPendingBookings();
  const pageStats = useProPageStats(week[0]!, week[6]!, !!salon);
  const clients = useProClients();
  const nonLues = useUnreadNotifications(!!salon);
  const [staffId, setStaffId] = useStaffFilter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [, copy] = useCopy();
  const now = useNow();
  const link = useLabelUrl(salon?.slug ?? '');

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const profile = proSalon?.owner ?? me.data?.profile;
  const firstName = (profile?.fullName ?? salon?.name ?? '').split(' ')[0];
  const members = salon?.staff.filter((m) => m.isActive) ?? [];
  const team = members.length > 1;
  const meStaffId = members.find((m) => m.userId && m.userId === me.data?.profile?.id)?.id ?? null;
  const filterOn = team && staffId && members.some((m) => m.id === staffId) ? staffId : null;

  const allToday = (todayList.data?.items ?? [])
    .filter((b) => b.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const shown = filterOn ? allToday.filter((b) => b.staffId === filterOn) : allToday;
  const upcoming = shown.filter(
    (b) => new Date(b.endsAt).getTime() > now && (b.status === 'pending' || b.status === 'confirmed'),
  );
  const tomorrowCount = (tomorrowList.data?.items ?? []).filter((b) => b.status !== 'cancelled').length;
  useSeenOnDisplay(
    shown.map((b) => b.id),
    !!salon && !todayList.isFetching && !pending.isFetching,
  );

  // Créneaux libres : la prestation la plus courte (la plus « facile à caser ») sert d'étalon.
  const services = (salon?.services ?? []).filter((s) => s.isActive);
  const shortest = [...services].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const freeToday = useAvailability(salon?.id ?? '', { serviceId: shortest?.id ?? '', date: today });
  const freeTomorrow = useAvailability(salon?.id ?? '', { serviceId: shortest?.id ?? '', date: tomorrow });
  const leftToday = (freeToday.data?.slots ?? []).filter((s) => new Date(s.startsAt).getTime() > now);

  const clientOf = (b: BookingWithStaff): ProClient | undefined =>
    (clients.data?.items ?? []).find(
      (c) => (b.clientId && c.clientId === b.clientId) || (!!b.clientPhone && c.phone === b.clientPhone),
    );

  const dateLine = new Intl.DateTimeFormat(formatLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Algiers',
  }).format(new Date());

  const picked = members.find((m) => m.id === filterOn);
  const endTitle = !filterOn
    ? t('C’est tout pour aujourd’hui')
    : filterOn === meStaffId
      ? t('C’est tout pour vous aujourd’hui')
      : t('C’est tout pour {name} aujourd’hui', { name: picked?.displayName ?? '' });
  const lastEnd = upcoming.length ? formatTimeDZ(upcoming[upcoming.length - 1]!.endsAt) : null;

  const openWa = (phone: string | null, text?: string) => {
    if (!phone) return;
    const n = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`, '_blank', 'noopener');
  };

  /* -------------------------------------------------------------- 1. bonjour */
  const avatar = (profile && 'avatarUrl' in profile ? profile.avatarUrl : null) ?? salon?.logoUrl ?? salon?.coverUrl ?? null;
  const header = (
    <header className="h11-hd">
      <Avatar src={avatar} name={firstName || 'S'} size={44} />
      <div className="min-w-0 flex-1">
        <span className="h11-hi">
          <span className="h11-serif">{t('Bonjour')}</span> {firstName}
        </span>
        <span className="h11-date">{dateLine}</span>
      </div>
      <Link
        to="/pro/notifications"
        className="h11-bell"
        aria-label={nonLues ? `${t('Notifications')} · ${nonLues}` : t('Notifications')}
      >
        <I icon={Bell} size={20} strokeWidth={1.8} />
        {nonLues > 0 && <span className="h11-bell-dot" aria-hidden />}
      </Link>
    </header>
  );

  /* -------------------------------------------------------------- 2. arrivées */
  const staffChip = (m: Staff | null) => {
    const on = (m?.id ?? null) === filterOn;
    const label = !m ? t('Toute l’équipe') : m.id === meStaffId ? t('Vous') : m.displayName;
    return (
      <button
        key={m?.id ?? 'all'}
        type="button"
        className={`h11-sc${on ? ' on' : ''}${m?.avatarUrl ? ' img' : ''}${!m ? ' all' : ''}`}
        aria-pressed={on}
        aria-label={label}
        title={label}
        onClick={() => setStaffId(m?.id ?? null)}
      >
        {!m ? <I icon={Users} size={15} strokeWidth={2.1} /> : m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : m.displayName.charAt(0).toUpperCase()}
      </button>
    );
  };

  const arrivals = (
    <section className="h11-arr" aria-label={t('Prochaines arrivées')}>
      <div className="h11-arr-h">
        <h2>{t('Prochaines arrivées')}</h2>
        {team && (
          <div className="h11-sf" role="group" aria-label={t('Filtrer par membre de l’équipe')}>
            {staffChip(null)}
            {members.map((m) => staffChip(m))}
          </div>
        )}
      </div>
      {todayList.isPending && <Skeleton className="mx-[4px] h-[13rem] !rounded-[24px]" />}
      {todayList.isError && <ErrorMessage error={todayList.error} retry={() => todayList.refetch()} />}
      {todayList.data && (
        <div className="h11-row">
          {upcoming.map((b, i) => {
            const c = clientOf(b);
            const visits = c?.completedCount ?? null;
            const isNew = visits === 0;
            const tag = visits === null ? null : isNew ? t('Nouvelle cliente') : visits >= 5 ? t('Fidèle · {n} visites', { n: visits }) : t('{n} visite(s)', { n: visits });
            const note = b.notes || c?.notes || null;
            const live = new Date(b.startsAt).getTime() <= now;
            const member = salon?.staff.find((m) => m.id === b.staffId);
            const noPhone = !b.clientPhone;
            return (
              <article key={b.id} className={`h11-card${i === 0 ? ' first' : ''}`} aria-label={`${b.clientName}, ${b.serviceName}, ${formatTimeDZ(b.startsAt)}`}>
                <button type="button" className="h11-top" onClick={() => setPeek(b.id)}>
                  <span className="h11-av">{b.clientName.trim().charAt(0).toUpperCase()}</span>
                  <span className="h11-who">
                    <span className="h11-name">{b.clientName}</span>
                    <span className={`h11-when${i === 0 ? ' on' : ''}`}>
                      <i aria-hidden />
                      {live ? t('En cours') : untilLabelFR(b.startsAt, now)}
                    </span>
                  </span>
                  <span className="h11-time" dir="ltr">
                    <b>{formatTimeDZ(b.startsAt)}</b>
                    <span>→ {formatTimeDZ(b.endsAt)}</span>
                  </span>
                </button>
                <div className="h11-mid">
                  <div className="h11-line">
                    <span className="h11-svc">{b.serviceName}</span>
                    <span className="h11-price" dir="ltr">{formatDA(b.priceDa)}</span>
                  </div>
                  <div className="h11-sub">
                    {team && b.staff ? (
                      <span className="h11-by">
                        <Avatar src={member?.avatarUrl} name={b.staff.displayName} size={22} />
                        <span>{b.staffId === meStaffId ? t('Avec vous') : t('Avec {name}', { name: b.staff.displayName })}</span>
                      </span>
                    ) : (
                      <span />
                    )}
                    {b.status === 'pending' ? (
                      <span className="h11-tag pd">{t('À valider')}</span>
                    ) : (
                      tag && <span className={`h11-tag${isNew ? ' new' : ''}`}>{tag}</span>
                    )}
                  </div>
                </div>
                {note && (
                  <div className="h11-note">
                    <I icon={FileText} size={14} strokeWidth={2} />
                    <span>{note}</span>
                  </div>
                )}
                <div className="flex-1" />
                <div className="h11-act">
                  <a
                    href={b.clientPhone ? `tel:${b.clientPhone}` : undefined}
                    className={`h11-tile${noPhone ? ' off' : ''}`}
                    aria-disabled={noPhone || undefined}
                    aria-label={t('Appeler {name}', { name: b.clientName })}
                    onClick={() => b.clientPhone && setToast({ text: `${t('Appel')} : ${b.clientName}`, kind: 'call' })}
                  >
                    <I icon={Phone} size={18} strokeWidth={1.9} />
                    {t('Appeler')}
                  </a>
                  <button
                    type="button"
                    className={`h11-tile wa${noPhone ? ' off' : ''}`}
                    disabled={noPhone}
                    aria-label={t('WhatsApp avec {name}', { name: b.clientName })}
                    onClick={() => openWa(b.clientPhone)}
                  >
                    <I icon={MessageCircle} size={18} strokeWidth={1.9} />
                    WhatsApp
                  </button>
                  <button type="button" className="h11-tile s" aria-label={t('Envoyer un rappel à {name}', { name: b.clientName })} onClick={() => setSheet({ kind: 'msg', b, tpl: 0 })}>
                    <I icon={BellRing} size={18} strokeWidth={1.9} />
                    {t('Rappel')}
                  </button>
                  <button type="button" className="h11-tile" aria-label={t('Plus d’options pour {name}', { name: b.clientName })} onClick={() => setSheet({ kind: 'more', b })}>
                    <I icon={MoreHorizontal} size={18} strokeWidth={2.4} />
                    {t('Plus')}
                  </button>
                </div>
              </article>
            );
          })}
          <article className="h11-card end" aria-label={t('Fin de journée')}>
            <div className="h11-end-h">
              <span className="h11-end-i">
                <I icon={CalendarCheck} size={20} strokeWidth={1.9} />
              </span>
              <span className="h11-end-t">{upcoming.length ? endTitle : t('Aucune arrivée prévue aujourd’hui')}</span>
            </div>
            <span className="h11-end-p">
              {[
                freeToday.data
                  ? lastEnd
                    ? t('Après {time}, il vous reste {n} créneau(x) libre(s).', { time: hfr(lastEnd), n: leftToday.length })
                    : t('Il vous reste {n} créneau(x) libre(s) aujourd’hui.', { n: leftToday.length })
                  : null,
                tomorrowList.data ? t('Demain : {n} rendez-vous.', { n: tomorrowCount }) : null,
              ]
                .filter(Boolean)
                .join(' ')}
            </span>
            <div className="flex-1" />
            <button type="button" className="h11-b grad" onClick={() => setSheet({ kind: 'dispo' })}>
              {t('Partager mes créneaux libres')}
            </button>
          </article>
        </div>
      )}
    </section>
  );

  /* -------------------------------------------------------------- 3. lien */
  const linkCard = salon && (
    <section className="h11-link" aria-label={t('Votre lien de réservation')}>
      <div className="flex min-w-0 flex-col gap-px">
        <span className="h11-link-l">{t('Votre lien de réservation')}</span>
        <span className="h11-link-u" dir="ltr">
          {link.short}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="h11-b soft"
          onClick={() => {
            copy(link.url);
            setToast({ text: t('Lien copié !'), kind: 'ok' });
          }}
        >
          <I icon={Copy} size={17} strokeWidth={2} /> {t('Copier')}
        </button>
        <button type="button" className="h11-b grad" onClick={() => setSheet({ kind: 'qr' })}>
          <I icon={QrCode} size={17} strokeWidth={2} /> {t('Code QR')}
        </button>
      </div>
    </section>
  );

  /* -------------------------------------------------------------- 4. votre page */
  const ps = pageStats.data;
  const maxViews = Math.max(1, ...(ps?.byDay.map((d) => d.views) ?? [1]));
  const pageCard = ps && (
    <section className="h11-page" aria-label={t('Votre page')}>
      <div className="h11-page-h">
        <h2>{t('Votre page')}</h2>
        <span>{t('Cette semaine')}</span>
      </div>
      <div className="h11-page-c">
        <div className="h11-kp">
          <div>
            <b>{ps.total}</b>
            <span>{t('visites')}</span>
          </div>
          <div>
            <b className="acc">{ps.bookings}</b>
            <span>{t('réservations')}</span>
          </div>
        </div>
        <div className="h11-bars">
          <span className="h11-bars-l">{t('Visites par jour')}</span>
          <div className="h11-bars-r" role="img" aria-label={`${t('Visites par jour')} : ${ps.byDay.map((d) => d.views).join(', ')}`}>
            {ps.byDay.map((d) => (
              <div key={d.date} className="h11-bar">
                <div>
                  <i className={d.date === today ? 'on' : ''} style={{ height: `${Math.max(3, Math.round((d.views / maxViews) * 24))}px` }} />
                </div>
                <span>
                  {new Intl.DateTimeFormat(formatLocale(), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${d.date}T12:00:00Z`))}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="h11-src">
          <span>
            <I icon={Link2} size={12} strokeWidth={2} />
            {t('Lien')} <b>{ps.bySource.link + ps.bySource.other}</b>
          </span>
          <span>
            <I icon={Instagram} size={12} strokeWidth={2} />
            Instagram <b>{ps.bySource.instagram}</b>
          </span>
          <span>
            <I icon={QrCode} size={12} strokeWidth={2} />
            {t('Code QR')} <b>{ps.bySource.qr}</b>
          </span>
        </div>
        <div className="h11-bravo">
          <I icon={Sparkles} size={14} strokeWidth={2} />
          <span>{ps.total ? t('Bravo, continuez à partager votre lien.') : t('Partagez votre lien pour recevoir vos premières visites.')}</span>
        </div>
      </div>
    </section>
  );

  /* -------------------------------------------------------------- 5. story */
  const storySlots = (() => {
    const d = freeTomorrow.data;
    if (!d) return null;
    const list = d.slots.length ? d.slots.map((s) => formatTimeDZ(s.startsAt)) : d.nextAvailable?.slots.map((s) => s.slice(0, 5)) ?? [];
    const date = d.slots.length ? tomorrow : d.nextAvailable?.date ?? null;
    // Trois heures étalées sur la journée : la première, celle du milieu, la dernière.
    const pick = list.length <= 3 ? list : [list[0]!, list[Math.floor(list.length / 2)]!, list[list.length - 1]!];
    return { times: pick, date };
  })();
  const storyDay =
    storySlots?.date === tomorrow || !storySlots?.date
      ? t('Demain')
      : new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${storySlots.date}T12:00:00Z`));
  const [storyBusy, setStoryBusy] = useState(false);
  const shareStory = async () => {
    if (!salon || !storySlots?.times.length) return;
    setStoryBusy(true);
    try {
      const blob = await drawStory({
        photo: salon.coverUrl ?? salon.photos[0]?.url ?? null,
        dayLabel: storyDay.charAt(0).toUpperCase() + storyDay.slice(1),
        subtitle: t('créneaux libres'),
        times: storySlots.times,
        salon: salon.name,
        link: link.short,
      });
      if (blob) {
        const shared = await shareImage(blob, `salondz-creneaux-${salon.slug}.png`, `${t('Réservez ici')} 👉 ${link.url}`);
        if (!shared) setToast({ text: t('Image enregistrée'), kind: 'ok' });
      }
    } finally {
      setStoryBusy(false);
    }
  };
  const storyCard = salon && (
    <section className="h11-story" aria-label={t('Prête à partager')}>
      <div className="h11-story-p">
        {(salon.coverUrl ?? salon.photos[0]?.url) && <img src={salon.coverUrl ?? salon.photos[0]!.url} alt="" />}
        <div className="h11-story-g" />
        <div className="h11-story-t">
          <span className="h11-serif">{storyDay.charAt(0).toUpperCase() + storyDay.slice(1)}</span>
          <b>{t('créneaux libres')}</b>
        </div>
        <div className="h11-story-s" dir="ltr">
          {(storySlots?.times.length ? storySlots.times : ['–']).map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <span className="h11-story-n">{salon.name}</span>
      </div>
      <div className="h11-story-r">
        <span className="h11-story-k">{t('Prête à partager')}</span>
        <span className="h11-story-h">{t('Vos créneaux libres de demain, en story')}</span>
        <span className="h11-story-d">{t('Générée d’après votre agenda, avec votre lien de réservation.')}</span>
        <div className="flex-1" />
        <button type="button" className="h11-pill ig" disabled={storyBusy || !storySlots?.times.length} onClick={() => void shareStory()}>
          {t('Story Instagram')}
        </button>
        <button type="button" className="h11-pill wa" disabled={storyBusy || !storySlots?.times.length} onClick={() => void shareStory()}>
          {t('Statut WhatsApp')}
        </button>
      </div>
    </section>
  );

  return (
    <Screen bottom={NAV_PAD} gap={16} width="page" className="h11">
      {header}
      <NotificationsNudge role="pro" />
      {salon && <QuickCloseBanner />}
      <div className="phg">
        <div className="phg-m">
          {arrivals}
          <div className="contents lg:hidden">{linkCard}</div>
          {pageCard}
          {storyCard}
          {team && salon && todayList.data && <TeamDay salon={salon} bookings={allToday} now={now} today={today} onOpen={setPeek} meStaffId={meStaffId} />}
        </div>
        <div className="phg-s">{linkCard}</div>
      </div>

      {toast &&
        createPortal(
          <div role="status" className={`h11-toast ${toast.kind}`}>
            <span>
              <I icon={toast.kind === 'call' ? Phone : toast.kind === 'wa' ? MessageCircle : Check} size={13} strokeWidth={3} />
            </span>
            {toast.text}
          </div>,
          document.body,
        )}
      {sheet?.kind === 'qr' && salon && <QrDialog url={`${link.url}?src=qr`} name={salon.name} slug={salon.slug} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'dispo' && salon && (
        <DispoSheet
          salon={salon}
          url={link.url}
          today={today}
          now={now}
          onClose={() => setSheet(null)}
          onDone={(text) => {
            setSheet(null);
            setToast({ text, kind: 'ok' });
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
          onCopy={(text) => {
            copy(text);
            setSheet(null);
            setToast({ text: t('Message copié !'), kind: 'ok' });
          }}
          onSend={(text) => {
            openWa(sheet.b.clientPhone, text);
            setSheet(null);
            setToast({ text: t('WhatsApp s’ouvre avec le message'), kind: 'wa' });
          }}
        />
      )}
      {sheet?.kind === 'more' && (
        <MoreSheet
          b={sheet.b}
          team={team}
          clientKey={clientOf(sheet.b)?.clientKey ?? null}
          onClose={() => setSheet(null)}
          onLate={() => setSheet({ kind: 'msg', b: sheet.b, tpl: 1 })}
          onOpen={() => {
            setSheet(null);
            setPeek(sheet.b.id);
          }}
        />
      )}
      {peek && <BookingPeekSheet id={peek} onClose={() => setPeek(null)} />}
    </Screen>
  );
}

/* ================================================================== feuilles et fenêtre */

function Overlay({ onClose, children, center }: { onClose: () => void; children: ReactNode; center?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return createPortal(
    <>
      <button type="button" className="h11-veil" aria-label={t('Fermer')} onClick={onClose} />
      <div className={center ? 'h11-dlg-w' : 'h11-sheet-w'}>{children}</div>
    </>,
    document.body,
  );
}

function SheetHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <>
      <span className="h11-grab" aria-hidden />
      <div className="h11-sh-h">
        <div className="min-w-0">
          <h3>{title}</h3>
          {sub && <p dir="auto">{sub}</p>}
        </div>
        <button type="button" className="rx" aria-label={t('Fermer')} onClick={onClose}>
          <I icon={X} size={18} />
        </button>
      </div>
    </>
  );
}

function Chips<T>({ items, value, onPick, label }: { items: { key: T; label: string }[]; value: T; onPick: (k: T) => void; label: (k: T) => string }) {
  return (
    <div className="h11-chips">
      {items.map((c) => (
        <button key={String(c.key)} type="button" className={`h11-chip${c.key === value ? ' on' : ''}`} aria-pressed={c.key === value} onClick={() => onPick(c.key)}>
          {c.label || label(c.key)}
        </button>
      ))}
    </div>
  );
}

function QrDialog({ url, name, slug, onClose }: { url: string; name: string; slug: string; onClose: () => void }) {
  const qr = useQr(url, 520);
  return (
    <Overlay onClose={onClose} center>
      <div role="dialog" aria-modal="true" aria-label={t('Code QR de votre page')} className="h11-dlg">
        <button type="button" className="rx h11-dlg-x" aria-label={t('Fermer')} onClick={onClose}>
          <I icon={X} size={18} />
        </button>
        <h3>{t('Réservez votre créneau')}</h3>
        <p>{t('Scannez ce code pour accéder à {name}', { name })}</p>
        <div className="h11-qr">{qr ? <img src={qr} alt={t('Code QR de votre page')} width={220} height={220} /> : <Skeleton className="h-[220px] w-[220px]" />}</div>
        <p>{t('Scannez ce code pour accéder directement à la page de réservation de {name}.', { name })}</p>
        <a className="h11-b grad h11-dl" href={qr ?? undefined} download={`salondz-qr-${slug}.png`}>
          <I icon={Download} size={20} strokeWidth={2} /> {t('Télécharger le QR Code')}
        </a>
      </div>
    </Overlay>
  );
}

function DispoSheet({
  salon,
  url,
  today,
  now,
  onClose,
  onDone,
}: {
  salon: SalonOwnerView;
  url: string;
  today: string;
  now: number;
  onClose: () => void;
  onDone: (toast: string) => void;
}) {
  const services = salon.services.filter((s) => s.isActive);
  const [svc, setSvc] = useState(services[0]?.id ?? '');
  const days = useMemo(() => [null, ...Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i))], [today]);
  const [day, setDay] = useState<string | null>(null);
  const date = day ?? today;
  const av = useAvailability(salon.id, { serviceId: svc, date });
  const service = services.find((s) => s.id === svc);
  const dayName = (d: string) =>
    d === today ? t('aujourd’hui') : d === addDaysToKey(today, 1) ? t('demain') : new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const dayChip = (d: string | null) =>
    d === null
      ? t('Prochaines dispos')
      : d === today
        ? t('Aujourd’hui')
        : d === addDaysToKey(today, 1)
          ? t('Demain')
          : new Intl.DateTimeFormat(formatLocale(), { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const slotsOf = (list: string[]) => joinTimes(list.slice(0, 5).map((x) => hfr(x)));
  let parts = '';
  if (av.data) {
    const todaySlots = av.data.slots.filter((s) => new Date(s.startsAt).getTime() > now).map((s) => formatTimeDZ(s.startsAt));
    if (day === null) {
      const a = todaySlots.length ? `${dayName(today)} ${t('à')} ${slotsOf(todaySlots)}` : '';
      const n = av.data.nextAvailable;
      const b = n ? `${dayName(n.date)} ${t('à')} ${slotsOf(n.slots.map((x) => x.slice(0, 5)))}` : '';
      parts = [a, b].filter(Boolean).join(`, ${t('puis')} `);
    } else {
      parts = todaySlots.length ? `${dayName(date)} ${t('à')} ${slotsOf(todaySlots)}` : '';
    }
  }
  const message = parts
    ? t('Salam 😊 Pour {svc}, mes disponibilités : {when}. Réservez directement ici 👉', { svc: service?.name ?? '', when: parts })
    : t('Salam 😊 Pour {svc}, je n’ai plus de créneau ce jour-là. Réservez le prochain directement ici 👉', { svc: service?.name ?? '' });
  const full = `${message} ${url}`;
  return (
    <Overlay onClose={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('Envoyer mes disponibilités')} className="h11-sheet">
        <SheetHead title={t('Envoyer mes disponibilités')} sub={t('Un message prêt à envoyer aux clientes qui vous demandent vos dispos en DM.')} onClose={onClose} />
        <span className="h11-sh-l">{t('Prestation')}</span>
        <Chips items={services.map((s) => ({ key: s.id, label: s.name }))} value={svc} onPick={setSvc} label={() => ''} />
        <span className="h11-sh-l">{t('Jour')}</span>
        <Chips items={days.map((d) => ({ key: d, label: dayChip(d) }))} value={day} onPick={setDay} label={() => ''} />
        <span className="h11-sh-l">{t('Message')}</span>
        <p className="h11-msg">
          {av.isPending ? '…' : message} <span className="whitespace-nowrap" dir="ltr">{url}</span>
        </p>
        <div className="h11-sh-a">
          <button
            type="button"
            className="h11-b lg soft"
            onClick={() => {
              void navigator.clipboard?.writeText(full);
              onDone(t('Message copié !'));
            }}
          >
            <I icon={Copy} size={20} strokeWidth={2} /> {t('Copier')}
          </button>
          <button
            type="button"
            className="h11-b lg grad"
            onClick={() => {
              if (navigator.share) {
                void navigator.share({ text: full }).catch(() => undefined);
                onClose();
              } else {
                void navigator.clipboard?.writeText(full);
                onDone(t('Message copié !'));
              }
            }}
          >
            <I icon={Send} size={20} strokeWidth={2} /> {t('Partager')}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function MessageSheet({
  b,
  tpl,
  salon,
  onTpl,
  onClose,
  onCopy,
  onSend,
}: {
  b: BookingWithStaff;
  tpl: number;
  salon: SalonOwnerView;
  onTpl: (n: number) => void;
  onClose: () => void;
  onCopy: (text: string) => void;
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
    <Overlay onClose={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('Message à {first}', { first })} className="h11-sheet">
        <SheetHead title={t('Message à {first}', { first })} sub={`${b.serviceName} · ${t('aujourd’hui à {time}', { time: start })}`} onClose={onClose} />
        <span className="h11-sh-l">{t('Modèle')}</span>
        <Chips items={names.map((n, i) => ({ key: i, label: n }))} value={tpl} onPick={onTpl} label={() => ''} />
        <span className="h11-sh-l">{t('Message')}</span>
        <p className="h11-msg">{text}</p>
        <div className="h11-sh-a">
          <button type="button" className="h11-b lg soft" onClick={() => onCopy(text)}>
            <I icon={Copy} size={20} strokeWidth={2} /> {t('Copier')}
          </button>
          <button type="button" className="h11-b lg grad" disabled={!b.clientPhone} onClick={() => onSend(text)}>
            <I icon={MessageCircle} size={20} strokeWidth={2} /> WhatsApp
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function MoreSheet({
  b,
  team,
  clientKey,
  onClose,
  onLate,
  onOpen,
}: {
  b: BookingWithStaff;
  team: boolean;
  clientKey: string | null;
  onClose: () => void;
  onLate: () => void;
  onOpen: () => void;
}) {
  const first = b.clientName.split(' ')[0] ?? b.clientName;
  const sub = `${b.serviceName} · ${formatTimeDZ(b.startsAt)} → ${formatTimeDZ(b.endsAt)}${team && b.staff ? ` · ${t('avec {name}', { name: b.staff.displayName })}` : ''}`;
  const Row = ({ icon, label, to, onClick, danger }: { icon: typeof Clock; label: string; to?: string; onClick?: () => void; danger?: boolean }) => {
    const inner = (
      <>
        <span className={`h11-mr-i${danger ? ' dg' : ''}`}>
          <I icon={icon} size={18} strokeWidth={2} />
        </span>
        <span className="flex-1">{label}</span>
      </>
    );
    return to ? (
      <Link to={to} className={`h11-mr${danger ? ' dg' : ''}`} onClick={onClose}>
        {inner}
      </Link>
    ) : (
      <button type="button" className={`h11-mr${danger ? ' dg' : ''}`} onClick={onClick}>
        {inner}
      </button>
    );
  };
  return (
    <Overlay onClose={onClose}>
      <div role="dialog" aria-modal="true" aria-label={b.clientName} className="h11-sheet">
        <span className="h11-grab" aria-hidden />
        <div className="h11-sh-h">
          <div className="min-w-0">
            <h3>{b.clientName}</h3>
            <p dir="auto">{sub}</p>
          </div>
        </div>
        <div className="h11-mrs">
          {clientKey ? (
            <Row icon={UserRound} label={t('Voir la fiche {first}', { first: elide(first) })} to={`/pro/clients/${encodeURIComponent(clientKey)}`} />
          ) : (
            <Row icon={UserRound} label={t('Voir le rendez-vous')} onClick={onOpen} />
          )}
          <Row icon={CalendarClock} label={t('Reporter le rendez-vous')} to={`/pro/rendez-vous/${b.id}/reporter`} />
          <Row icon={Clock} label={t('Prévenir d’un retard')} onClick={onLate} />
          <Row icon={XCircle} label={t('Annuler le rendez-vous')} onClick={onOpen} danger />
        </div>
        <button type="button" className="h11-b lg neu" onClick={onClose}>
          {t('Fermer')}
        </button>
      </div>
    </Overlay>
  );
}

/* ================================================================== journée de l'équipe */

function TeamDay({
  salon,
  bookings,
  now,
  today,
  onOpen,
  meStaffId,
}: {
  salon: SalonOwnerView;
  bookings: BookingWithStaff[];
  now: number;
  today: string;
  onOpen: (id: string) => void;
  meStaffId: string | null;
}) {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const hours = salon.openingHours.filter((h) => h.dayOfWeek === dow && !h.isClosed);
  const toMin = (hm: string) => {
    const [h, m] = hm.split(':').map(Number);
    return h! * 60 + (m ?? 0);
  };
  const minOf = (iso: string) => toMin(formatTimeDZ(iso));
  let start = hours.length ? Math.min(...hours.map((h) => toMin(h.opensAt))) : 10 * 60;
  let end = hours.length ? Math.max(...hours.map((h) => toMin(h.closesAt))) : 20 * 60;
  for (const b of bookings) {
    start = Math.min(start, minOf(b.startsAt));
    end = Math.max(end, minOf(b.endsAt));
  }
  start = Math.floor(start / 120) * 120;
  end = Math.max(start + 240, Math.ceil(end / 120) * 120);
  const span = end - start;
  const pct = (m: number) => `${((m - start) / span) * 100}%`;
  const nowMin = minOf(new Date(now).toISOString());
  const marks: number[] = [];
  for (let m = start; m <= end; m += 120) marks.push(m);
  const members = salon.staff.filter((m) => m.isActive);
  return (
    <section className="h11-team" aria-label={t('La journée de l’équipe')}>
      <div className="h11-team-g" dir="ltr">
        {members.map((m) => (
          <div key={m.id} className="contents">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.id === meStaffId ? t('Vous') : m.displayName} className="h11-team-a" />
            ) : (
              <span className="h11-team-a ini">{m.displayName.charAt(0).toUpperCase()}</span>
            )}
            <div className="h11-team-t">
              {bookings
                .filter((b) => b.staffId === m.id)
                .map((b) => {
                  const done = new Date(b.endsAt).getTime() <= now || b.status === 'completed' || b.status === 'no_show';
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`h11-team-b${done ? ' done' : b.status === 'pending' ? ' pd' : ''}`}
                      style={{ left: pct(minOf(b.startsAt)), width: `max(6px, ${((minOf(b.endsAt) - minOf(b.startsAt)) / span) * 100}%)` } as CSSProperties}
                      aria-label={`${m.displayName} · ${formatTimeDZ(b.startsAt)} · ${b.clientName}`}
                      onClick={() => onOpen(b.id)}
                    />
                  );
                })}
            </div>
          </div>
        ))}
        {nowMin >= start && nowMin <= end && (
          <span className="h11-team-now" aria-hidden style={{ ['--f' as string]: ((nowMin - start) / span).toFixed(4) } as CSSProperties} />
        )}
      </div>
      <div className="h11-team-h" dir="ltr" aria-hidden>
        <span />
        <div>
          {marks.map((m) => (
            <span key={m}>{Math.floor(m / 60)}h</span>
          ))}
        </div>
      </div>
    </section>
  );
}
