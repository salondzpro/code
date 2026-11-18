/** C-F 12 — Rendez-vous confirmé (ou demande envoyée). Le même écran sert juste après la réservation (`BookingReview`). */
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Landmark } from 'lucide-react';
import { useBooking } from '@salondz/api-client';
import { DepositCard } from '@/components/DepositCard';
import { depositPayNote } from '@/lib/deposit';
import { formatDA } from '@salondz/constants';
import { Button, I, TopBar } from '@/components/ui';
import { AppHandoffCard, AppHandoffSheet } from '@/components/AppHandoff';
import { BookingSummary } from '@/components/BookingSummary';
import { ICONE } from '@/lib/actionIcons';
import { directionsUrl } from './Bookings';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { PageLoading } from '@/components/PageLoading';
import type { BookingWithSalon } from '@salondz/types';
import { cibleCarte } from '@/lib/maps';
import { t } from '@/i18n';

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
  useEffect(() => {
    try {
      navigator.vibrate?.(confirmed ? [18, 60, 18] : 18);
    } catch {
      /* pas de vibreur */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen gap={14}>
      {/* Navigation en haut, même après la réservation (18 nov. 2026) : on n'est jamais coincé. */}
      <TopBar backTo={`/s/${b.salon.slug}`} title={b.salon.name} />
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
            <svg viewBox="0 0 24 24" width="30" height="30">
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
        </div>
      )}
      {state === 'dep' && <DepositCard booking={b} />}
      <BookingSummary
        className="cf-card"
        salon={{ name: b.salon.name, logoUrl: b.salon.logoUrl, coverUrl: b.salon.coverUrl }}
        status={b.status}
        startsAt={b.startsAt}
        lines={lines}
        priceDa={b.priceDa}
        payNote={
          state === 'dep'
            ? t('Reste {montant} sur place', { montant: formatDA(Math.max(0, b.priceDa - (b.depositAmount ?? 0))) })
            : depositPayNote(b)
        }
      />
      {state !== 'dep' && <DepositCard booking={b} />}
      {/* DEUX BOUTONS sur une ligne, juste sous la carte (16 nov. 2026, comme la fiche du rendez-vous) :
          plus de panneau du bas, plus de « Calendrier ». */}
      <div className="cf-acts flex gap-2.5">
        <Button icon={ICONE.voirRdv} sm className="flex-1 whitespace-nowrap" onClick={() => navigate(`/rendez-vous/${b.id}`, { replace: true })}>
          {t('Mon rendez-vous')}
        </Button>
        <a href={directionsUrl(b)} target={cibleCarte(directionsUrl(b))} rel="noreferrer" className="btn g sm flex-1">
          <I icon={ICONE.itineraire} size={18} /> {t('Itinéraire')}
        </a>
      </div>
      {/* Passation vers l'application (façon Uber) : la carte ici, et une fenêtre une fois par réservation. */}
      <AppHandoffCard />
      <AppHandoffSheet bookingId={b.id} />
    </Screen>
  );
}
