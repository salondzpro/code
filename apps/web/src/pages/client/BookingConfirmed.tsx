/** C-F 12 — Rendez-vous confirmé (ou demande envoyée) ; « Ajouter à votre calendrier Google » en bas (lien direct, sans feuille). */
import { useNavigate, useParams } from 'react-router';
import {
  Banknote,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Check,
  Hourglass,
  Navigation,
  Scissors,
  UserRound,
} from 'lucide-react';
import { useBooking } from '@salondz/api-client';
import {
  formatDA,
  formatDateLongDZ,
  formatDZPhone,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
  wilayaName,
  SHOW_SALON_CONTACT_TO_CLIENTS,
} from '@salondz/constants';
import { Avatar, Button, I, StatusBadge } from '@/components/ui';
import { LateRule } from '@/components/LateRule';
import { FactRow } from '@/components/BookingFacts';
import { directionsUrl } from './Bookings';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';
import { formatDuration } from '@/lib/format';
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
  const lines = b.items?.length
    ? b.items
    : [
        {
          id: b.id,
          serviceName: b.serviceName,
          durationMinutes: b.durationMinutes,
          priceDa: b.priceDa,
        },
      ];

  const dayKey = toLocalDateKey(new Date(b.startsAt));
  const dayLabel = relativeDayLabelDZ(dayKey);
  const dateLong = formatDateLongDZ(b.startsAt).replace(/^\w/, (c) => c.toUpperCase());
  const address = [b.salon.address, b.salon.city].filter(Boolean).join(', ');

  // Pas de centrage vertical : il poussait la coche vers le milieu et laissait un grand vide
  // en haut, alors que la page se lit de haut en bas comme toutes les autres.
  return (
    <Screen gap={12}>
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <div
          className={`flex h-[5rem] w-[5rem] items-center justify-center rounded-full ${confirmed ? 'bg-ok-bg text-ok-fg' : 'bg-pending-bg text-pending-fg'}`}
        >
          <I icon={confirmed ? Check : Hourglass} size={36} />
        </div>
        <h1 className="h1">{confirmed ? 'Rendez-vous confirmé' : 'Demande envoyée'}</h1>
        <p className="p">
          {confirmed
            ? 'Un rappel vous sera envoyé la veille.'
            : 'Le salon répond à votre demande. Vous recevrez une notification.'}
        </p>
      </div>

      {/* Où : le salon, son adresse — et l'état de la réservation. */}
      <div className="crd !flex-row items-center gap-3.5">
        <Avatar src={b.salon.logoUrl ?? b.salon.coverUrl} name={b.salon.name} size={56} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.143rem] font-semibold tracking-[-0.3px]">
            {b.salon.name}
          </span>
          <span className="block truncate text-[0.857rem] text-muted">
            {address || b.salon.city}
            {SHOW_SALON_CONTACT_TO_CLIENTS && b.salon.phone
              ? ` · ${formatDZPhone(b.salon.phone)}`
              : ''}
          </span>
        </span>
        <StatusBadge status={b.status} md />
      </div>

      {/* Quoi, quand, avec qui, combien : une ligne par fait. */}
      <div className="crd !gap-0 !py-1">
        <FactRow
          icon={CalendarDays}
          title={/^\p{L}+\. \d/u.test(dayLabel) ? dateLong : `${dayLabel} · ${dateLong}`}
          sub={`${formatTimeDZ(b.startsAt)} – ${formatTimeDZ(b.endsAt)} · ${formatDuration(b.durationMinutes)}`}
          right={
            <span className="mono text-[1.429rem] font-semibold tracking-[-0.5px]">
              {formatTimeDZ(b.startsAt)}
            </span>
          }
        />
        {lines.map((it) => (
          <FactRow
            key={it.id}
            icon={Scissors}
            title={it.serviceName}
            sub={it.durationMinutes ? formatDuration(it.durationMinutes) : undefined}
            right={
              lines.length > 1 ? (
                <span className="text-[1rem] font-semibold">{formatDA(it.priceDa)}</span>
              ) : undefined
            }
          />
        ))}
        {b.staff?.displayName && <FactRow icon={UserRound} title={`Avec ${b.staff.displayName}`} />}
        <FactRow icon={Banknote} title={formatDA(b.priceDa)} sub="Paiement sur place" />
      </div>
      <LateRule startsAt={b.startsAt} />
      <Button onClick={() => navigate(`/rendez-vous/${b.id}`, { replace: true })}>
        <I icon={CalendarCheck} size={18} /> Voir le rendez-vous
      </Button>
      <div className="g2">
        <a href={directionsUrl(b)} target="_blank" rel="noreferrer" className="btn g">
          <I icon={Navigation} size={18} /> Itinéraire
        </a>
        <a href={googleCalendarUrl(b)} target="_blank" rel="noreferrer" className="btn g">
          <I icon={Calendar} size={18} /> Calendrier
        </a>
      </div>
      <span className="sr-only">{wilayaName(16)}</span>
    </Screen>
  );
}
