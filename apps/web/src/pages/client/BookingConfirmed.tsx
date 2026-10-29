/** C-F 12 — Rendez-vous confirmé (ou demande envoyée). Le même écran sert juste après la réservation (`BookingReview`). */
import { useNavigate, useParams } from 'react-router';
import { Calendar, CalendarCheck, Navigation } from 'lucide-react';
import { useBooking } from '@salondz/api-client';
import { formatDZPhone, SHOW_SALON_CONTACT_TO_CLIENTS } from '@salondz/constants';
import { BottomSheet, Button, I } from '@/components/ui';
import { BookingSummary, ConfirmHero } from '@/components/BookingSummary';
import { directionsUrl } from './Bookings';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { PageLoading } from '@/components/PageLoading';
import type { BookingWithSalon } from '@salondz/types';
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
 * La confirmation, affichée PAR-DESSUS le récapitulatif au moment où la réservation est prise
 * (`BookingReview`) comme à l'ouverture de son adresse : même carte, à la même place, qui passe au
 * vert pendant que la coche se dessine — on ne change pas de page, on voit la réservation se faire.
 */
export function ConfirmedView({ booking: b }: { booking: BookingWithSalon }) {
  const navigate = useNavigate();
  const confirmed = b.status === 'confirmed';
  const lines = b.items?.length
    ? b.items.map((it) => ({ id: it.id, name: it.serviceName, minutes: it.durationMinutes, priceDa: it.priceDa }))
    : [{ id: b.id, name: b.serviceName, minutes: b.durationMinutes, priceDa: b.priceDa }];
  const area = [b.salon.address, b.salon.city].filter(Boolean).join(', ');

  return (
    <Screen bottom={SHEET_PAD} gap={12}>
      <ConfirmHero
        pending={!confirmed}
        title={confirmed ? t('Rendez-vous confirmé') : t('Demande envoyée')}
        sub={confirmed ? t('Vous serez rappelé(e) 1 h puis 30 min avant.') : t('Le salon répond à votre demande. Vous recevrez une notification.')}
      />
      <BookingSummary
        className="bk-flash"
        salon={{ name: b.salon.name, logoUrl: b.salon.logoUrl, coverUrl: b.salon.coverUrl, area: SHOW_SALON_CONTACT_TO_CLIENTS && b.salon.phone ? `${area} · ${formatDZPhone(b.salon.phone)}` : area }}
        status={b.status}
        startsAt={b.startsAt}
        endsAt={b.endsAt}
        lines={lines}
        staffName={b.staff?.displayName}
        priceDa={b.priceDa}
        payNote={t('Paiement sur place')}
      />
      <BottomSheet>
        <div className="bk-in-2 flex flex-col gap-2">
          <Button onClick={() => navigate(`/rendez-vous/${b.id}`, { replace: true })}>
            <I icon={CalendarCheck} size={18} /> {t('Voir le rendez-vous')}
          </Button>
          <div className="g2">
            <a href={directionsUrl(b)} target="_blank" rel="noreferrer" className="btn g sm">
              <I icon={Navigation} size={18} /> {t('Itinéraire')}
            </a>
            <a href={googleCalendarUrl(b)} target="_blank" rel="noreferrer" className="btn g sm">
              <I icon={Calendar} size={18} /> {t('Calendrier')}
            </a>
          </div>
        </div>
      </BottomSheet>
    </Screen>
  );
}
