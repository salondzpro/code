/** C-F 12 — Rendez-vous confirmé (ou demande envoyée) ; « Ajouter à votre calendrier Google » en bas (lien direct, sans feuille). */
import { useNavigate, useParams } from 'react-router';
import { Calendar, Check } from 'lucide-react';
import { useBooking } from '@salondz/api-client';
import {
  formatDA,
  formatDateShortDZ,
  formatDZPhone,
  formatTimeDZ,
  wilayaName,
} from '@salondz/constants';
import { Avatar, Button, I, StatusBadge } from '@/components/ui';
import { LateRule } from '@/components/LateRule';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';
import type { BookingWithSalon } from '@salondz/types';

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
      <I icon={Calendar} size={18} /> Ajouter à votre calendrier Google
    </a>
  );
}

export function BookingConfirmed() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const booking = useBooking(id);
  if (booking.isPending) return <Splash />;
  if (booking.isError)
    return <ErrorMessage error={booking.error} retry={() => booking.refetch()} />;
  const b = booking.data;
  const confirmed = b.status === 'confirmed';

  return (
    <Screen className="min-h-dvh justify-center" gap={16}>
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-[9.25rem] w-[9.25rem] items-center justify-center rounded-full bg-ok-bg text-ok-fg">
          <I icon={Check} size={56} />
        </div>
        <h1 className="h1">
          {confirmed ? 'Rendez-vous' : 'Demande'}
          <br />
          {confirmed ? 'confirmé' : 'envoyée'}
        </h1>
      </div>
      <div className="crd !gap-0">
        <div className="mb-2 flex items-center gap-3.5">
          <Avatar src={b.salon.coverUrl} name={b.salon.name} size={88} />
          <span className="min-w-0">
            <span className="block text-[1.125rem] font-bold tracking-[-0.4px]">
              {b.salon.name}
            </span>
            <span className="block text-[0.8125rem] text-muted">
              {b.salon.city}
              {b.salon.phone ? ` · ${formatDZPhone(b.salon.phone)}` : ''}
            </span>
          </span>
        </div>
        <div className="li !py-4 text-[0.875rem]">
          <span className="text-muted">Prestation</span>
          <span className="font-semibold">{b.serviceName}</span>
        </div>
        <div className="li !py-4 text-[0.875rem]">
          <span className="text-muted">Date et heure</span>
          <span className="font-semibold">
            {formatDateShortDZ(b.startsAt)} · {formatTimeDZ(b.startsAt)}
          </span>
        </div>
        <div className="li !py-4 text-[0.875rem]">
          <span className="text-muted">Total</span>
          <span className="font-semibold">{formatDA(b.priceDa)}</span>
        </div>
        {!confirmed && (
          <div className="pt-3">
            <StatusBadge status={b.status} md />
          </div>
        )}
      </div>
      <LateRule startsAt={b.startsAt} />
      <p className="p text-center">
        {confirmed
          ? 'Un rappel vous sera envoyé la veille.'
          : 'Le salon confirme votre demande sur WhatsApp.'}
      </p>
      <Button onClick={() => navigate(`/rendez-vous/${b.id}`, { replace: true })}>
        Voir le rendez-vous
      </Button>
      <GoogleCalendarButton booking={b} />
      <span className="sr-only">{wilayaName(16)}</span>
    </Screen>
  );
}
