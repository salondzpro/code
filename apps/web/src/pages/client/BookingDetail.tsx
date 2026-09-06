/**
 * Détail d'un rendez-vous côté client (structure de C-F 15) : salon, contact, lignes, note,
 * Reporter / Annuler. C-F 17 — feuille « Annuler ce rendez-vous ? » ; C-F 18 — annulation confirmée.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useBooking, useCancelBooking } from '@salondz/api-client';
import { CLIENT_CANCEL_MIN_HOURS, formatDA, formatDateLongDZ, formatDateShortDZ, formatDZPhone, formatTimeDZ } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { Avatar, BottomSheet, Button, Input, LinkButton, StatusBadge, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';
import { CalendarSheet } from './BookingConfirmed';
import { directionsUrl } from './Bookings';

export function BookingDetail() {
  const { id = '' } = useParams();
  const booking = useBooking(id);
  const cancel = useCancelBooking();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [cal, setCal] = useState(false);
  const [done, setDone] = useState(false);

  if (booking.isPending) return <Splash />;
  if (booking.isError) return <ErrorMessage error={booking.error} retry={() => booking.refetch()} />;
  const b = booking.data;
  const active = b.status === 'pending' || b.status === 'confirmed';
  const hoursLeft = Math.floor((new Date(b.startsAt).getTime() - Date.now()) / 3_600_000);
  // Règles du salon (même source que l'API) : délai d'annulation, report client autorisé.
  const minHours = b.salon.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS;
  const canModify = active && hoursLeft >= minHours;
  const canReschedule = canModify && b.salon.allowClientReschedule !== false;
  const wa = b.salon.phone ? `https://wa.me/${b.salon.phone.replace(/\D/g, '')}` : null;

  if (done) {
    // C-F 18 — Annulation confirmée
    return (
      <Screen className="min-h-dvh justify-center" gap={16}>
        <div className="text-center">
          <h1 className="h1 !text-[32px]">Rendez-vous annulé</h1>
          <p className="p mt-3">{b.salon.name} a été prévenu sur WhatsApp. Aucun frais ne vous est appliqué.</p>
        </div>
        <div className="crd !gap-0">
          <div className="li !py-4 text-[18px]">
            <span>{b.serviceName}</span>
            <span className="text-muted">{formatDA(b.priceDa)}</span>
          </div>
          <div className="li !py-4 text-[18px]">
            <span>{formatDateLongDZ(b.startsAt)}</span>
            <span className="text-muted">{formatTimeDZ(b.startsAt)} · annulé</span>
          </div>
        </div>
        <LinkButton to={`/s/${b.salon.slug}/prestations`}>Réserver un autre créneau</LinkButton>
        <LinkButton to="/rendez-vous" variant="g">
          Retour à mes rendez-vous
        </LinkButton>
      </Screen>
    );
  }

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo="/rendez-vous" right={<StatusBadge status={b.status} md />} />
      <div className="flex items-center gap-4">
        <Avatar src={b.salon.coverUrl} name={b.salon.name} size={128} />
        <div className="min-w-0">
          <h1 className="h1 !text-[30px]">{b.salon.name}</h1>
          {b.salon.phone && <p className="mt-1 text-[17px] text-muted">{formatDZPhone(b.salon.phone)}</p>}
        </div>
      </div>
      <div className="g2">
        {b.salon.phone && (
          <a href={`tel:${b.salon.phone}`} className="btn g !py-[18px] !text-[18px]">
            Appeler
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="btn g !py-[18px] !text-[18px]">
            WhatsApp
          </a>
        )}
      </div>
      <div className="crd !gap-0">
        {(b.items?.length ? b.items : [{ id: b.id, serviceName: b.serviceName, durationMinutes: b.durationMinutes, priceDa: b.priceDa }]).map((it) => (
          <div key={it.id} className="li !py-4 text-[18px]">
            <span className="text-muted">Prestation</span>
            <span className="font-semibold">{it.serviceName}</span>
          </div>
        ))}
        <div className="li !py-4 text-[18px]">
          <span className="text-muted">Date</span>
          <span className="font-semibold">{formatDateShortDZ(b.startsAt).replace(/^\w/, (c) => c.toUpperCase())}</span>
        </div>
        <div className="li !py-4 text-[18px]">
          <span className="text-muted">Heure</span>
          <span className="mono font-semibold">
            {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)}
          </span>
        </div>
        <div className="li !py-4 text-[18px]">
          <span className="text-muted">Durée</span>
          <span className="font-semibold">{formatDuration(b.durationMinutes)}</span>
        </div>
        <div className="li !py-4 text-[18px]">
          <span className="text-muted">Prix</span>
          <span className="font-semibold">{formatDA(b.priceDa)}</span>
        </div>
      </div>
      {b.notes && (
        <div className="sf">
          <span className="s block">Votre note</span>
          <span className="block text-[19px]">« {b.notes} »</span>
        </div>
      )}
      {b.cancellationReason && <p className="text-[15px] text-danger">Motif : {b.cancellationReason}</p>}
      <div className="flex flex-col gap-2.5">
        {active && (
          <a href={directionsUrl(b)} target="_blank" rel="noreferrer" className="btn g">
            Itinéraire
          </a>
        )}
        {active && (
          <Button variant="g" onClick={() => setCal(true)}>
            Ajouter au calendrier
          </Button>
        )}
        {canReschedule && (
          <div className="g2">
            <Link to={`/rendez-vous/${b.id}/reporter`} className="btn g">
              Reporter
            </Link>
            <Button variant="d" onClick={() => setCancelling(true)}>
              Annuler
            </Button>
          </div>
        )}
        {canModify && !canReschedule && (
          <Button variant="d" onClick={() => setCancelling(true)}>
            Annuler
          </Button>
        )}
        {active && !canModify && <p className="p text-center text-[14px]">Report et annulation en ligne possibles jusqu'à {minHours} h avant. Contactez le salon.</p>}
        {b.status === 'completed' && <LinkButton to={`/rendez-vous/${b.id}/noter`}>Noter la prestation</LinkButton>}
      </div>

      {cal && <CalendarSheet booking={b} onClose={() => setCal(false)} />}

      {cancelling && (
        <>
          <div className="dim" onClick={() => setCancelling(false)} />
          <BottomSheet>
            <div className="text-center">
              <div className="text-[24px] font-bold tracking-[-0.4px]">Annuler ce rendez-vous ?</div>
              <p className="p mt-2">
                Annulation gratuite — il reste {hoursLeft} h avant le rendez-vous. Le créneau sera libéré immédiatement.
              </p>
            </div>
            <div className="crd !flex-row items-center justify-between !py-3">
              <span className="text-[19px]">Motif (optionnel)</span>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Empêchement" className="!w-auto !bg-transparent !p-0 text-right" maxLength={200} aria-label="Motif" />
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
