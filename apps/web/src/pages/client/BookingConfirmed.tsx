/** C-F 12 — Rendez-vous confirmé (ou demande envoyée) ; C-F 13 — feuille « Ajouter au calendrier » (Google Agenda, fichier .ics). */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Calendar, Check, ChevronRight, Download } from 'lucide-react';
import { useBooking } from '@salondz/api-client';
import { formatDA, formatDateShortDZ, formatDZPhone, formatTimeDZ, wilayaName } from '@salondz/constants';
import { Avatar, BottomSheet, Button, I, StatusBadge } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';
import type { BookingWithSalon } from '@salondz/types';

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function calendarLinks(b: BookingWithSalon) {
  const title = `${b.serviceName} · ${b.salon.name}`;
  const location = [b.salon.address, b.salon.city].filter(Boolean).join(', ');
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${icsDate(b.startsAt)}/${icsDate(b.endsAt)}&location=${encodeURIComponent(location)}&details=${encodeURIComponent('Réservé via Salon DZ')}`;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Salon DZ//FR', 'BEGIN:VEVENT', `UID:${b.id}@salondz`, `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(b.startsAt)}`, `DTEND:${icsDate(b.endsAt)}`, `SUMMARY:${title}`, `LOCATION:${location}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return { google, icsHref: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` };
}

export function CalendarSheet({ booking, onClose }: { booking: BookingWithSalon; onClose: () => void }) {
  const links = calendarLinks(booking);
  return (
    <>
      <div className="dim" onClick={onClose} />
      <BottomSheet>
        <div className="h2 text-center !text-[22px]">Ajouter au calendrier</div>
        <div className="flex flex-col">
          <a href={links.google} target="_blank" rel="noreferrer" className="li !py-5">
            <span className="flex items-center gap-4">
              <span className="ib lg">
                <I icon={Calendar} size={20} />
              </span>
              <span className="text-[19px]">Google Agenda</span>
            </span>
            <I icon={ChevronRight} size={18} className="text-disabled" />
          </a>
          <a href={links.icsHref} download={`rendez-vous-${booking.id.slice(0, 8)}.ics`} className="li !py-5">
            <span className="flex items-center gap-4">
              <span className="ib lg">
                <I icon={Download} size={20} />
              </span>
              <span className="text-[19px]">Télécharger le fichier .ics</span>
            </span>
            <I icon={ChevronRight} size={18} className="text-disabled" />
          </a>
        </div>
        <Button variant="g" onClick={onClose}>
          Plus tard
        </Button>
      </BottomSheet>
    </>
  );
}

export function BookingConfirmed() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const booking = useBooking(id);
  const [cal, setCal] = useState(false);
  if (booking.isPending) return <Splash />;
  if (booking.isError) return <ErrorMessage error={booking.error} retry={() => booking.refetch()} />;
  const b = booking.data;
  const confirmed = b.status === 'confirmed';

  return (
    <Screen className="min-h-dvh justify-center" gap={16}>
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-[148px] w-[148px] items-center justify-center rounded-full bg-ok-bg text-ok-fg">
          <I icon={Check} size={56} />
        </div>
        <h1 className="h1 !text-[34px]">
          {confirmed ? 'Rendez-vous' : 'Demande'}
          <br />
          {confirmed ? 'confirmé' : 'envoyée'}
        </h1>
      </div>
      <div className="crd !gap-0">
        <div className="mb-2 flex items-center gap-3.5">
          <Avatar src={b.salon.coverUrl} name={b.salon.name} size={88} />
          <span className="min-w-0">
            <span className="block text-[22px] font-bold tracking-[-0.4px]">{b.salon.name}</span>
            <span className="block text-[16px] text-muted">
              {b.salon.city}
              {b.salon.phone ? ` · ${formatDZPhone(b.salon.phone)}` : ''}
            </span>
          </span>
        </div>
        <div className="li !py-4 text-[18px]">
          <span className="text-muted">Prestation</span>
          <span className="font-semibold">{b.serviceName}</span>
        </div>
        <div className="li !py-4 text-[18px]">
          <span className="text-muted">Date et heure</span>
          <span className="font-semibold">
            {formatDateShortDZ(b.startsAt)} · {formatTimeDZ(b.startsAt)}
          </span>
        </div>
        <div className="li !py-4 text-[18px]">
          <span className="text-muted">Total</span>
          <span className="font-semibold">{formatDA(b.priceDa)}</span>
        </div>
        {!confirmed && (
          <div className="pt-3">
            <StatusBadge status={b.status} md />
          </div>
        )}
      </div>
      <p className="p text-center">{confirmed ? 'Un rappel vous sera envoyé la veille.' : 'Le salon confirme votre demande sur WhatsApp.'}</p>
      <Button variant="g" onClick={() => setCal(true)}>
        Ajouter au calendrier
      </Button>
      <Button onClick={() => navigate(`/rendez-vous/${b.id}`, { replace: true })}>Voir le rendez-vous</Button>
      {cal && <CalendarSheet booking={b} onClose={() => setCal(false)} />}
      <span className="sr-only">{wilayaName(16)}</span>
    </Screen>
  );
}
