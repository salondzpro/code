/**
 * Détail d'un rendez-vous côté client (structure de C-F 15) : salon, contact, puis l'essentiel en grand
 * (Aujourd'hui / Demain / date, heure, prix) et la liste des prestations — même lecture que la fiche pro.
 * Reporter / Annuler. C-F 17 — feuille « Annuler ce rendez-vous ? » (avec la règle anti-abus) ; C-F 18 — annulation confirmée.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  CalendarClock,
  MessageCircle,
  Navigation,
  Phone,
  RotateCcw,
  Star,
  XCircle,
} from 'lucide-react';
import { useBooking, useCancelBooking, useMe } from '@salondz/api-client';
import {
  CANCEL_ABUSE_BLOCK_DAYS,
  CANCEL_ABUSE_MAX,
  CANCEL_ABUSE_WINDOW_DAYS,
  CLIENT_CANCEL_MIN_HOURS,
  MAX_CLIENT_RESCHEDULES,
  formatDA,
  formatDateLongDZ,
  formatDZPhone,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
} from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import {
  Avatar,
  BottomSheet,
  Button,
  I,
  InfoBox,
  Input,
  LinkButton,
  StatusBadge,
  TopBar,
} from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LateRule } from '@/components/LateRule';
import { Splash } from '@/pages/auth/Splash';
import { GoogleCalendarButton } from './BookingConfirmed';
import { directionsUrl } from './Bookings';

export function BookingDetail() {
  const { id = '' } = useParams();
  const booking = useBooking(id);
  const cancel = useCancelBooking();
  const me = useMe();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);

  if (booking.isPending) return <Splash />;
  if (booking.isError)
    return <ErrorMessage error={booking.error} retry={() => booking.refetch()} />;
  const b = booking.data;
  const active = b.status === 'pending' || b.status === 'confirmed';
  const hoursLeft = Math.floor((new Date(b.startsAt).getTime() - Date.now()) / 3_600_000);
  // Règles du salon (même source que l'API) : délai d'annulation, report client autorisé.
  const minHours = b.salon.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS;
  const canModify = active && hoursLeft >= minHours;
  const rescheduled = b.clientReschedules >= MAX_CLIENT_RESCHEDULES;
  const canReschedule = canModify && b.salon.allowClientReschedule !== false && !rescheduled;
  const wa = b.salon.phone ? `https://wa.me/${b.salon.phone.replace(/\D/g, '')}` : null;
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
  const cancels = me.data?.standing?.cancellations ?? 0;

  if (done) {
    // C-F 18 — Annulation confirmée
    return (
      <Screen className="min-h-dvh justify-center" gap={16}>
        <div className="text-center">
          <h1 className="h1">Rendez-vous annulé</h1>
          <p className="p mt-3">
            {b.salon.name} a été prévenu sur WhatsApp. Aucun frais ne vous est appliqué.
          </p>
        </div>
        <div className="crd !gap-0">
          <div className="li !py-4 text-[0.875rem]">
            <span>{b.serviceName}</span>
            <span className="text-muted">{formatDA(b.priceDa)}</span>
          </div>
          <div className="li !py-4 text-[0.875rem]">
            <span>{formatDateLongDZ(b.startsAt)}</span>
            <span className="text-muted">{formatTimeDZ(b.startsAt)} · annulé</span>
          </div>
        </div>
        <LinkButton to={`/s/${b.salon.slug}/prestations`}>
          <I icon={RotateCcw} size={18} /> Réserver un autre créneau
        </LinkButton>
        <LinkButton to="/rendez-vous" variant="g">
          Retour à mes rendez-vous
        </LinkButton>
      </Screen>
    );
  }

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar
        backTo="/rendez-vous"
        right={
          <StatusBadge status={b.status} md cancelledBy={b.cancelledBy} kind={b.cancellationKind} />
        }
      />
      <div className="flex items-center gap-4">
        <Avatar src={b.salon.coverUrl} name={b.salon.name} size={128} />
        <div className="min-w-0">
          <h1 className="h1 !text-[1.625rem]">{b.salon.name}</h1>
          {b.salon.phone && (
            <p className="mt-1 text-[0.8125rem] text-muted">{formatDZPhone(b.salon.phone)}</p>
          )}
        </div>
      </div>
      <div className="g2">
        {b.salon.phone && (
          <a href={`tel:${b.salon.phone}`} className="btn g !py-[1.125rem] !text-[1.125rem]">
            <I icon={Phone} size={20} /> Appeler
          </a>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="btn g !py-[1.125rem] !text-[1.125rem]"
          >
            <I icon={MessageCircle} size={20} /> WhatsApp
          </a>
        )}
      </div>
      {/* L'essentiel en grand : quand, à quelle heure, combien — rassurant et lisible d'un coup d'œil. */}
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
      {active && <LateRule startsAt={b.startsAt} />}
      {b.notes && (
        <div className="sf">
          <span className="s block">Votre note</span>
          <span className="block text-[0.9375rem]">« {b.notes} »</span>
        </div>
      )}
      {b.cancellationReason && (
        <p className="text-[0.9375rem] text-danger">Motif : {b.cancellationReason}</p>
      )}
      <div className="flex flex-col gap-2.5">
        {active && (
          <a href={directionsUrl(b)} target="_blank" rel="noreferrer" className="btn g">
            <I icon={Navigation} size={18} /> Itinéraire
          </a>
        )}
        {canReschedule && (
          <div className="g2">
            <Link to={`/rendez-vous/${b.id}/reporter`} className="btn g">
              <I icon={CalendarClock} size={18} /> Reporter
            </Link>
            <Button variant="d" onClick={() => setCancelling(true)}>
              <I icon={XCircle} size={18} /> Annuler
            </Button>
          </div>
        )}
        {canModify && !canReschedule && (
          <Button variant="d" onClick={() => setCancelling(true)}>
            <I icon={XCircle} size={18} /> Annuler
          </Button>
        )}
        {active && !canModify && (
          <p className="p text-center text-[0.875rem]">
            Report et annulation en ligne possibles jusqu'à {minHours} h avant. Contactez le salon.
          </p>
        )}
        {canModify && rescheduled && b.salon.allowClientReschedule !== false && (
          <p className="p text-center text-[0.875rem]">
            Déjà reporté une fois. Pour le déplacer encore, contactez le salon.
          </p>
        )}
        {b.status === 'completed' && b.reviewRating == null && (
          <LinkButton to={`/rendez-vous/${b.id}/noter`}>
            <I icon={Star} size={18} /> Noter la prestation
          </LinkButton>
        )}
        {b.status === 'completed' && b.reviewRating != null && (
          <InfoBox>
            Merci ! Vous avez noté ce rendez-vous {b.reviewRating}/5. Votre avis est visible sur la
            page du salon.
          </InfoBox>
        )}
        {active && <GoogleCalendarButton booking={b} />}
      </div>

      {cancelling && (
        <>
          <div className="dim" onClick={() => setCancelling(false)} />
          <BottomSheet>
            <div className="text-center">
              <div className="text-[1.25rem] font-bold tracking-[-0.4px]">
                Annuler ce rendez-vous ?
              </div>
              <p className="p mt-2">
                Annulation gratuite — il reste {hoursLeft} h avant le rendez-vous. Le créneau sera
                libéré immédiatement.
              </p>
            </div>
            <InfoBox>
              {cancels >= CANCEL_ABUSE_MAX - 1
                ? `Attention : ce serait votre ${cancels + 1}ᵉ annulation en ${CANCEL_ABUSE_WINDOW_DAYS} jours. Au-delà de ${CANCEL_ABUSE_MAX}, la réservation en ligne est suspendue ${CANCEL_ABUSE_BLOCK_DAYS} jours.`
                : `Pour respecter le travail des salons, au-delà de ${CANCEL_ABUSE_MAX} annulations en ${CANCEL_ABUSE_WINDOW_DAYS} jours la réservation en ligne est suspendue ${CANCEL_ABUSE_BLOCK_DAYS} jours.`}
            </InfoBox>
            <div className="crd !flex-row items-center justify-between !py-3">
              <span className="text-[0.9375rem]">Motif (optionnel)</span>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Empêchement"
                className="!w-auto !bg-transparent !p-0 text-right"
                maxLength={200}
                aria-label="Motif"
              />
            </div>
            <ErrorMessage error={cancel.error} />
            <Button
              className="!bg-danger !text-white"
              disabled={cancel.isPending}
              onClick={async () => {
                await cancel.mutateAsync({ id: b.id, reason: reason.trim() || undefined });
                setCancelling(false);
                setDone(true);
              }}
            >
              {cancel.isPending ? 'Annulation…' : 'Annuler le rendez-vous'}
            </Button>
            <Button variant="g" onClick={() => setCancelling(false)}>
              Garder le rendez-vous
            </Button>
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}
