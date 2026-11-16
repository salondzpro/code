/** C-F 12 — Rendez-vous confirmé (ou demande envoyée). Le même écran sert juste après la réservation (`BookingReview`). */
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Calendar, Landmark, Navigation } from 'lucide-react';
import { useBooking } from '@salondz/api-client';
import { DepositCard } from '@/components/DepositCard';
import { depositPayNote } from '@/lib/deposit';
import { formatDA, formatDZPhone, SHOW_SALON_CONTACT_TO_CLIENTS } from '@salondz/constants';
import { BottomSheet, Button, I } from '@/components/ui';
import { BookingSummary } from '@/components/BookingSummary';
import { ICONE } from '@/lib/actionIcons';
import { directionsUrl } from './Bookings';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { PageLoading } from '@/components/PageLoading';
import type { BookingWithSalon } from '@salondz/types';
import { cibleCarte } from '@/lib/maps';
import { t } from '@/i18n';

function icsDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Lien « Ajouter à votre calendrier Google » (le fichier .ics n'est plus proposé : trop technique pour la V1). */
export function googleCalendarUrl(b: BookingWithSalon): string {
  const title = `${b.serviceName} · ${b.salon.name}`;
  const location = [b.salon.address, b.salon.city].filter(Boolean).join(', ');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${icsDate(b.startsAt)}/${icsDate(b.endsAt)}&location=${encodeURIComponent(location)}&details=${encodeURIComponent('Réservé via Salon DZ')}`;
}

/** Bouton commun (confirmation + détails) : tout en bas, avec icône. */
export function GoogleCalendarButton({ booking }: { booking: BookingWithSalon }) {
  return (
    <a href={googleCalendarUrl(booking)} target="_blank" rel="noreferrer" className="btn g">
      <I icon={Calendar} size={18} /> {t("Ajouter à votre calendrier Google")}
    </a>
  );
}

export function BookingConfirmed() {
  const { id = '' } = useParams();
  const booking = useBooking(id);
  if (booking.isPending) return <PageLoading />;
  if (booking.isError)
    return <ErrorMessage error={booking.error} retry={() => booking.refetch()} />;
  return <ConfirmedView booking={booking.data} />;
}

/**
 * La confirmation (refonte du 15 nov. 2026, « animation premium, compact ») : affichée à la place du
 * récapitulatif au moment où la réservation est prise, et à l'ouverture de son adresse. Un grand
 * insigne centré qui s'anime selon l'état décidé par le salon :
 *   confirmé → vert, coche qui se dessine, deux ondes ;
 *   demande envoyée (validation manuelle) → orange, horloge dont l'aiguille tourne ;
 *   versement à faire → orange, « Plus qu'une étape », la carte du versement dessous.
 * Puis la carte du rendez-vous et les actions. Sous `prefers-reduced-motion`, rien ne bouge.
 */
export function ConfirmedView({ booking: initial }: { booking: BookingWithSalon }) {
  const navigate = useNavigate();
  // Le cache suit le rendez-vous (justificatif envoyé, versement validé) ; la réponse de la création sert d'amorce.
  const b = useBooking(initial.id).data ?? initial;
  const confirmed = b.status === 'confirmed';
  const deposit = b.status === 'pending' && !!b.depositAmount && !!b.depositStatus && b.depositStatus !== 'accepted';
  const state = confirmed ? 'ok' : deposit ? 'dep' : 'wait';
  const lines = b.items?.length
    ? b.items.map((it) => ({ id: it.id, name: it.serviceName, minutes: it.durationMinutes, priceDa: it.priceDa }))
    : [{ id: b.id, name: b.serviceName, minutes: b.durationMinutes, priceDa: b.priceDa }];
  const area = [b.salon.address, b.salon.city].filter(Boolean).join(', ');
  useEffect(() => {
    try {
      navigator.vibrate?.(confirmed ? [18, 60, 18] : 18);
    } catch {
      /* pas de vibreur */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen bottom={SHEET_PAD} gap={14}>
      {state === 'dep' ? (
        // Versement : en-tête compact, le parcours étape par étape tout de suite visible (sans défiler).
        <div className="cf-mini" role="status">
          <span className="cf-mini-ic" aria-hidden>
            <I icon={Landmark} size={20} />
          </span>
          <span className="min-w-0">
            <b>{t('Créneau réservé')}</b>
            {b.depositStatus !== 'submitted' && <small>{t('Plus qu’une étape pour confirmer')}</small>}
          </span>
        </div>
      ) : (
        <div className={`cf ${state}`} role="status">
          <span className="cf-badge" aria-hidden>
            <i className="cf-wave" />
            <i className="cf-wave w2" />
            <svg viewBox="0 0 24 24" width="40" height="40">
              {state === 'ok' ? (
                <path className="cf-draw" d="M5 12.5l4.2 4.2L19 7" pathLength={24} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <>
                  <circle className="cf-draw" cx="12" cy="12" r="8.5" pathLength={24} fill="none" stroke="currentColor" strokeWidth="2.2" />
                  <path className="cf-hand" d="M12 12V7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  <path d="M12 12l3 1.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </>
              )}
            </svg>
          </span>
          <h1 className="cf-t">{state === 'ok' ? t('Rendez-vous confirmé') : t('Demande envoyée')}</h1>
          {state === 'wait' && <p className="cf-s">{t('Le salon vous répond bientôt.')}</p>}
        </div>
      )}
      {state === 'dep' && <DepositCard booking={b} />}
      <BookingSummary
        className="cf-card"
        salon={{ name: b.salon.name, logoUrl: b.salon.logoUrl, coverUrl: b.salon.coverUrl, area: SHOW_SALON_CONTACT_TO_CLIENTS && b.salon.phone ? `${area} · ${formatDZPhone(b.salon.phone)}` : area }}
        status={b.status}
        startsAt={b.startsAt}
        endsAt={b.endsAt}
        lines={lines}
        staffName={b.staff?.displayName}
        priceDa={b.priceDa}
        payNote={
          state === 'dep'
            ? t('Reste {montant} sur place', { montant: formatDA(Math.max(0, b.priceDa - (b.depositAmount ?? 0))) })
            : (depositPayNote(b) ?? t('Paiement sur place'))
        }
      />
      {state !== 'dep' && <DepositCard booking={b} />}
      <BottomSheet>
        <div className="cf-acts flex flex-col gap-2">
          <Button icon={ICONE.voirRdv} onClick={() => navigate(`/rendez-vous/${b.id}`, { replace: true })}>
            {t('Voir le rendez-vous')}
          </Button>
          <div className="g2">
            <a href={directionsUrl(b)} target={cibleCarte(directionsUrl(b))} rel="noreferrer" className="btn g sm">
              <I icon={Navigation} size={16} /> {t('Itinéraire')}
            </a>
            <a href={googleCalendarUrl(b)} target="_blank" rel="noreferrer" className="btn g sm">
              <I icon={Calendar} size={16} /> {t('Calendrier')}
            </a>
          </div>
        </div>
      </BottomSheet>
    </Screen>
  );
}
