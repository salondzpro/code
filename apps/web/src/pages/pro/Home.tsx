/**
 * PRO-F 22 — Accueil professionnel, sur le modèle de mew3id (refonte demandée le 4 nov. 2026 :
 * « très facile, moins d'écriture ») :
 *
 *   1. l'en-tête violet : bonjour, cloche, ronds de stories, rond du jour et PROCHAINS RENDEZ-VOUS en
 *      cartes à glisser ; une carte ouvre la fenêtre du rendez-vous ;
 *   2. le LIEN de réservation, posé à cheval sur l'en-tête : copier, code QR, partager ses disponibilités ;
 *   3. MA PAGE : visites, réservations et visites par jour ;
 *   4. MA STORY : préparée sur place.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { Bell, CalendarClock, Check, Copy, Download, MessageCircle, Phone, QrCode, Send, X } from 'lucide-react';
import {
  useMe,
  useProBookingMutations,
  useProBookings,
  useProPageStats,
  useProPendingBookings,
  useProSalon,
  useSeenOnDisplay,
  useUnreadNotifications,
} from '@salondz/api-client';
import { addDaysToKey, formatDA, formatLocale, formatTimeDZ, toLocalDateKey, weekKeys } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { Avatar, Button, I, Skeleton } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { NotificationsNudge } from '@/components/NotificationsNudge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { BookingPeekSheet } from '@/components/BookingPeekSheet';
import { ClientContact } from '@/components/ClientContact';
import { DispoSheet } from '@/components/DispoSheet';
import { ProStoryRail } from '@/components/ProStories';
import { QuickCloseBanner } from '@/components/QuickClose';
import { StoryCard } from '@/components/StoryCard';
import { NotificationsSheet } from '@/pages/AccountNotifications';
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

type Toast = { text: string; kind: 'ok' | 'call' | 'wa' } | null;
type Sheet = { kind: 'qr' } | { kind: 'dispo' } | null;

export function ProHome() {
  const me = useMe();
  const proSalon = useProSalon().data;
  const salon = proSalon?.salon ?? null;
  const today = toLocalDateKey();
  const tomorrow = addDaysToKey(today, 1);
  const week = weekKeys(today);
  const todayList = useProBookings({ from: today, to: today, limit: 50 }, !!salon);
  const pending = useProPendingBookings();
  const pageStats = useProPageStats(week[0]!, week[6]!, !!salon);
  const nonLues = useUnreadNotifications(!!salon);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const { setStatus } = useProBookingMutations();
  const [bell, setBell] = useState(false);
  const closeSheet = useCallback(() => setSheet(null), []);
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

  const allToday = (todayList.data?.items ?? [])
    .filter((b) => b.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = allToday.filter(
    (b) => new Date(b.endsAt).getTime() > now && (b.status === 'pending' || b.status === 'confirmed'),
  );
  useSeenOnDisplay(
    allToday.map((b) => b.id),
    !!salon && !todayList.isFetching && !pending.isFetching,
  );


  const dateLine = new Intl.DateTimeFormat(formatLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Algiers',
  }).format(new Date());

  // La barre d'état prend la couleur de l'en-tête, le temps de cet écran.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bar-top-bg', 'var(--color-accent)');
    return () => {
      root.style.removeProperty('--bar-top-bg');
    };
  }, []);

  const ps = pageStats.data;
  const maxViews = Math.max(1, ...(ps?.byDay.map((d) => d.views) ?? [1]));
  const total = allToday.length;
  const done = total - upcoming.length;

  return (
    <Screen bottom={NAV_PAD} gap={16} className="h12">
      <header className="h12-top">
        <div className="h12-hd">
          <div className="min-w-0 flex-1">
            <span className="h12-date">{dateLine}</span>
            <span className="h12-hi">
              {t('Bonjour')} {firstName}
            </span>
          </div>
          <button type="button" className="h12-bell" aria-label={nonLues ? `${t('Notifications')} · ${nonLues}` : t('Notifications')} onClick={() => setBell(true)}>
            <I icon={Bell} size={20} strokeWidth={1.8} />
            {nonLues > 0 && <i aria-hidden />}
          </button>
        </div>
        {salon && <ProStoryRail salon={salon} short={link.short} pending={pending.data?.items.length ?? 0} />}
        <div className="h12-mid">
          <Link to="/pro/agenda" className={`h12-day${upcoming.length ? ' col' : ''}`}>
            <span className="h12-ring">
              <svg viewBox="0 0 100 100" aria-hidden>
                <circle cx="50" cy="50" r="45" pathLength="100" />
                {done > 0 && <circle className="on" cx="50" cy="50" r="45" pathLength="100" strokeDasharray={`${(done / total) * 100} 100`} />}
              </svg>
              <b>{total}</b>
            </span>
            <span className="min-w-0">
              <b>{t('rendez-vous aujourd’hui')}</b>
              {!upcoming.length && <span>{t('Plus rien de prévu')}</span>}
            </span>
          </Link>
          {upcoming.length > 0 && (
            <div className="h12-nc" aria-label={t('Prochains rendez-vous')}>
              {upcoming.map((b) => {
                const future = new Date(b.startsAt).getTime() > now;
                return (
                  <article key={b.id} className="h12-nk">
                    <button type="button" className="h12-nb" onClick={() => setPeek(b.id)}>
                      <span className="h12-nt">
                        <b dir="ltr">{formatTimeDZ(b.startsAt)}</b>
                        {b.status === 'pending' && <em>{t('À valider')}</em>}
                      </span>
                      <span className="rp-n">{b.clientName}</span>
                      <span className="h12-ns">
                        <span>{b.serviceName}</span> · <b dir="ltr">{formatDA(b.priceDa)}</b>
                      </span>
                    </button>
                    {b.status === 'pending' && future ? (
                      <div className="ag9-ac">
                        <Button sm className="ag9-n" onClick={() => setPeek(b.id)}>
                          {t('Refuser')}
                        </Button>
                        <Button
                          sm
                          className="ag9-b"
                          loading={setStatus.isPending && setStatus.variables?.id === b.id}
                          onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}
                        >
                          {t('Accepter')}
                        </Button>
                      </div>
                    ) : (
                      <ClientContact booking={b} salon={salon} remind={b.status === 'confirmed' && future} />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {salon && (
        <section className="h12-card h12-link" aria-label={t('Votre lien de réservation')}>
          <span className="h12-l">{t('Votre lien de réservation')}</span>
          <span className="h12-u" dir="ltr">
            {link.short}
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h11-b soft"
              onClick={() => {
                copy(link.url);
                setToast({ text: t('Lien copié'), kind: 'ok' });
              }}
            >
              <I icon={Copy} size={17} strokeWidth={2} /> {t('Copier')}
            </button>
            <button type="button" className="h11-b grad" onClick={() => setSheet({ kind: 'qr' })}>
              <I icon={QrCode} size={17} strokeWidth={2} /> {t('Code QR')}
            </button>
          </div>
          <button type="button" className="h11-b out" onClick={() => setSheet({ kind: 'dispo' })}>
            <I icon={CalendarClock} size={17} strokeWidth={2} /> {t('Partager mes disponibilités')}
          </button>
        </section>
      )}

      <NotificationsNudge role="pro" />
      {salon && <QuickCloseBanner />}

      {setStatus.error && <ErrorMessage error={setStatus.error} />}
      {todayList.isPending && <Skeleton className="h-[6rem] w-full !rounded-[var(--radius-card)]" />}
      {todayList.isError && <ErrorMessage error={todayList.error} retry={() => todayList.refetch()} />}
      {ps && (
        <section className="flex flex-col gap-2" aria-label={t('Ma page')}>
          <h2 className="h12-h">
            {t('Ma page')} <span>{t('Cette semaine')}</span>
          </h2>
          <div className="h12-card">
            <div className="h12-kp">
              <div>
                <b>{ps.total}</b>
                <span>{t('visites')}</span>
              </div>
              <div>
                <b className="acc">{ps.bookings}</b>
                <span>{t('réservations')}</span>
              </div>
            </div>
            <div className="h12-bars" role="img" aria-label={`${t('Visites par jour')} : ${ps.byDay.map((d) => d.views).join(', ')}`}>
              {ps.byDay.map((d) => (
                <div key={d.date}>
                  <i className={d.date === today ? 'on' : ''} style={{ height: `${Math.max(3, Math.round((d.views / maxViews) * 40))}px` }} />
                  <span>
                    {new Intl.DateTimeFormat(formatLocale(), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${d.date}T12:00:00Z`))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {salon && <StoryCard salon={salon} url={link.url} short={link.short} />}

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
          onClose={closeSheet}
          onCopy={(text) => {
            copy(text);
            closeSheet();
            setToast({ text: t('Message copié'), kind: 'ok' });
          }}
        />
      )}
      {bell && <NotificationsSheet onClose={() => setBell(false)} />}
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
