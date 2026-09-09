/** C-F 12 — Rendez-vous confirmé (ou demande envoyée) ; « Ajouter à votre calendrier Google » en bas (lien direct, sans feuille). */
import { useNavigate, useParams } from 'react-router';
import { Calendar, CalendarCheck, Check } from 'lucide-react';
import { useBooking } from '@salondz/api-client';
import {
  formatDA,
  formatDateLongDZ,
  formatDZPhone,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
  wilayaName,
} from '@salondz/constants';
import { Avatar, Button, I, StatusBadge } from '@/components/ui';
import { LateRule } from '@/components/LateRule';
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
      <div className="crd">
        <div className="flex items-center gap-3.5">
          <Avatar src={b.salon.logoUrl ?? b.salon.coverUrl} name={b.salon.name} size={88} />
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
        {!confirmed && (
          <div className="pt-3">
            <StatusBadge status={b.status} md />
          </div>
        )}
      </div>
      {/* L'essentiel en grand : quand, à quelle heure, combien — même lecture que la fiche de rendez-vous. */}
      <div className="crd !gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[1rem] font-bold">
            {relativeDayLabelDZ(toLocalDateKey(new Date(b.startsAt)))}
          </span>
          <span className="text-[0.875rem] text-muted">
            {formatDateLongDZ(b.startsAt).replace(/^\w/, (c) => c.toUpperCase())}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <span className="mono text-[2rem] font-bold leading-none tracking-[-0.9px]">
            {formatTimeDZ(b.startsAt)}{' '}
            <span className="text-[1rem] font-medium text-muted">– {formatTimeDZ(b.endsAt)}</span>
          </span>
          <span className="text-[1.5rem] font-bold leading-none tracking-[-0.6px]">
            {formatDA(b.priceDa)}
          </span>
        </div>
        <span className="text-[0.8125rem] text-muted">
          {formatDuration(b.durationMinutes)} au total · paiement sur place
        </span>
      </div>
      <div className="crd !gap-0">
        <div className="li !py-3">
          <span className="text-[1rem] font-bold">
            {lines.length} prestation{lines.length > 1 ? 's' : ''}
          </span>
          <span className="text-[0.875rem] text-muted">{formatDA(b.priceDa)}</span>
        </div>
        {lines.map((it) => (
          <div key={it.id} className="li !py-3">
            <span className="text-[1rem] font-semibold">{it.serviceName}</span>
            <span className="text-[0.875rem] text-muted">
              {it.durationMinutes
                ? `${formatDuration(it.durationMinutes)} · ${formatDA(it.priceDa)}`
                : formatDA(it.priceDa)}
            </span>
          </div>
        ))}
      </div>
      <LateRule startsAt={b.startsAt} />
      <p className="p text-center">
        {confirmed
          ? 'Un rappel vous sera envoyé la veille.'
          : 'Le salon confirme votre demande sur WhatsApp.'}
      </p>
      <Button onClick={() => navigate(`/rendez-vous/${b.id}`, { replace: true })}>
        <I icon={CalendarCheck} size={18} /> Voir le rendez-vous
      </Button>
      <GoogleCalendarButton booking={b} />
      <span className="sr-only">{wilayaName(16)}</span>
    </Screen>
  );
}
