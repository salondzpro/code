/**
 * PRO-F 22 — Accueil professionnel, sur le modèle de mew3id (refonte demandée le 4 nov. 2026 :
 * « très facile, moins d'écriture ») :
 *
 *   1. l'en-tête violet : bonjour, cloche, et le grand rond du jour (rendez-vous, prochaine cliente) ;
 *   2. le LIEN de réservation, posé à cheval sur l'en-tête : copier, code QR, envoyer ses disponibilités ;
 *   3. les PROCHAINS RENDEZ-VOUS, en cartes à glisser ; une carte ouvre la fenêtre du rendez-vous ;
 *   4. VOTRE PAGE : visites, réservations et visites par jour ;
 *   5. les créneaux de demain à partager : Instagram, Snapchat, WhatsApp.
 * Une carte = une heure, un nom, une prestation. Tout le reste est dans la fenêtre du rendez-vous.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { Bell, CalendarClock, Check, Copy, Download, MessageCircle, Phone, QrCode, Send, X } from 'lucide-react';
import {
  useAvailability,
  useMe,
  useProBookings,
  useProPageStats,
  useProPendingBookings,
  useProSalon,
  useSeenOnDisplay,
  useUnreadNotifications,
} from '@salondz/api-client';
import { addDaysToKey, formatLocale, formatTimeDZ, toLocalDateKey, weekKeys } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { Avatar, I, Skeleton } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { NotificationsNudge } from '@/components/NotificationsNudge';
import { ErrorMessage } from '@/components/ErrorMessage';
import { BookingPeekSheet } from '@/components/BookingPeekSheet';
import { QuickCloseBanner } from '@/components/QuickClose';
import { drawStory, shareImage } from '@/lib/storyImage';
import { InstagramLogo, SnapchatLogo } from '@/components/BrandIcons';
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

  // Créneaux libres : la prestation la plus courte (la plus « facile à caser ») sert d'étalon.
  const services = (salon?.services ?? []).filter((s) => s.isActive);
  const shortest = [...services].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const freeTomorrow = useAvailability(salon?.id ?? '', { serviceId: shortest?.id ?? '', date: tomorrow });

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
  const next = upcoming[0];

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
  const shareStory = async (text?: string) => {
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
        const shared = await shareImage(blob, `salondz-creneaux-${salon.slug}.png`, text);
        if (!shared) setToast({ text: t('Image enregistrée'), kind: 'ok' });
      }
    } finally {
      setStoryBusy(false);
    }
  };
  const storyOff = storyBusy || !storySlots?.times.length;

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
          <Link to="/pro/notifications" className="h12-bell" aria-label={nonLues ? `${t('Notifications')} · ${nonLues}` : t('Notifications')}>
            <I icon={Bell} size={20} strokeWidth={1.8} />
            {nonLues > 0 && <i aria-hidden />}
          </Link>
        </div>
        <Link to="/pro/agenda" className="h12-day">
          <span className="h12-ring">
            <svg viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="45" pathLength="100" />
              {done > 0 && <circle className="on" cx="50" cy="50" r="45" pathLength="100" strokeDasharray={`${(done / total) * 100} 100`} />}
            </svg>
            <b>{total}</b>
          </span>
          <span className="min-w-0">
            <b>{t('rendez-vous aujourd’hui')}</b>
            <span>
              {next ? (
                <>
                  <span dir="ltr">{formatTimeDZ(next.startsAt)}</span> · {next.clientName}
                </>
              ) : (
                t('Plus rien de prévu')
              )}
            </span>
          </span>
        </Link>
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
            <I icon={CalendarClock} size={17} strokeWidth={2} /> {t('Envoyer mes disponibilités')}
          </button>
        </section>
      )}

      <NotificationsNudge role="pro" />
      {salon && <QuickCloseBanner />}

      {todayList.isPending && <Skeleton className="h-[6rem] w-full !rounded-[var(--radius-card)]" />}
      {todayList.isError && <ErrorMessage error={todayList.error} retry={() => todayList.refetch()} />}
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="h12-h">{t('Prochains rendez-vous')}</h2>
          <div className="h12-row bleed">
            {upcoming.map((b) => (
              <button key={b.id} type="button" className="h12-c" onClick={() => setPeek(b.id)}>
                <span className="h12-ct">
                  <b dir="ltr">{formatTimeDZ(b.startsAt)}</b>
                  {b.status === 'pending' && <em>{t('À valider')}</em>}
                </span>
                <span className="h12-cn">{b.clientName}</span>
                <span className="h12-cs">
                  {b.serviceName}
                  {team && b.staff ? ` · ${b.staff.displayName}` : ''}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {ps && (
        <section className="flex flex-col gap-2" aria-label={t('Votre page')}>
          <h2 className="h12-h">
            {t('Votre page')} <span>{t('Cette semaine')}</span>
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

      {salon && !!storySlots?.times.length && (
        <section className="h12-card" aria-label={t('Partager mes créneaux')}>
          <span className="h12-cn">{t('Partager mes créneaux')}</span>
          <span className="h12-cs" dir="ltr">
            {storyDay.charAt(0).toUpperCase() + storyDay.slice(1)} · {storySlots.times.join(' · ')}
          </span>
          <div className="h12-sh">
            <button type="button" disabled={storyOff} onClick={() => void shareStory()}>
              <InstagramLogo size={20} /> Instagram
            </button>
            <button type="button" disabled={storyOff} onClick={() => void shareStory()}>
              <SnapchatLogo size={20} /> Snapchat
            </button>
            <button type="button" disabled={storyOff} onClick={() => void shareStory(`${t('Réservez ici')} 👉 ${link.url}`)}>
              <I icon={MessageCircle} size={20} className="text-[#128c4f]" /> WhatsApp
            </button>
          </div>
        </section>
      )}

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
              onDone(t('Message copié'));
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
                onDone(t('Message copié'));
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
