/** C-F 11 — Récapitulatif : salon, lignes de prestations, date → heure de fin, total, conditions, « Confirmer la réservation ». */
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ApiError, useCreateBooking, useSalon, useUpdateProfile } from '@salondz/api-client';
import { CLIENT_CANCEL_MIN_HOURS, formatDA, formatDateLongDZ, formatTimeDZ, minutesToTime, timeToMinutes, wilayaName } from '@salondz/constants';
import { clearDraft, readDraft } from '@/lib/bookingDraft';
import { formatDuration } from '@/lib/format';
import { Avatar, BottomSheet, Button, InfoBox, TopBar } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';

export function BookingReview() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const salon = useSalon(slug);
  const create = useCreateBooking();
  const updateProfile = useUpdateProfile();
  // Instantané du brouillon : la création invalide des requêtes (re-rendu) avant la navigation,
  // il ne faut pas relire un brouillon déjà effacé et retomber sur la liste des prestations.
  const [draft] = useState(() => readDraft(slug));
  const [slotError, setSlotError] = useState<string | null>(null);

  if (!draft.startsAt || !draft.name || draft.serviceIds.length === 0) return <Navigate to={`/s/${slug}/prestations`} replace />;
  if (salon.isPending) return <Splash />;
  const s = salon.data;
  if (!s) return null;
  const chosen = draft.serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean);
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);
  const start = formatTimeDZ(draft.startsAt);
  const end = minutesToTime(timeToMinutes(start) + minutes);
  const host = window.location.host.replace(/^www\./, '');

  const confirm = async () => {
    setSlotError(null);
    try {
      const b = await create.mutateAsync({
        salonId: s.id,
        serviceIds: draft.serviceIds,
        staffId: null,
        startsAt: draft.startsAt!,
        notes: draft.notes || undefined,
        clientName: draft.name,
        clientPhone: draft.phone,
      });
      if (draft.whatsapp !== undefined) updateProfile.mutate({ whatsappReminders: draft.whatsapp });
      navigate(`/rendez-vous/${b.id}/confirme`, { replace: true });
      clearDraft(slug);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'SLOT_TAKEN' || err.code === 'TOO_SOON' || err.code === 'OUTSIDE_OPENING_HOURS')) {
        setSlotError("Ce créneau vient d'être pris. Choisissez-en un autre.");
      }
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo={`/s/${slug}/reserver/coordonnees`} right="Étape 4 sur 4" />
      <h1 className="h1">Récapitulatif</h1>
      <div className="crd !gap-0">
        <div className="mb-2 flex items-center gap-3.5">
          <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={72} />
          <span className="min-w-0">
            <span className="block text-[22px] font-bold tracking-[-0.4px]">{s.name}</span>
            <span className="block truncate text-[16px] text-muted">
              {s.zone ?? s.city}, {wilayaName(s.wilayaCode)} · {host}/s/{s.slug}
            </span>
          </span>
        </div>
        {chosen.map((sv) => (
          <div key={sv!.id} className="li !py-4 text-[18px]">
            <span>{sv!.name}</span>
            <span className="text-muted">
              {formatDuration(sv!.durationMinutes)} · {formatDA(sv!.priceDa)}
            </span>
          </div>
        ))}
        <div className="li !py-4 text-[18px]">
          <span>{formatDateLongDZ(draft.startsAt)}</span>
          <span className="mono text-muted">
            {start} → {end}
          </span>
        </div>
      </div>
      <div className="crd !gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[22px] font-semibold">Total</span>
          <span className="text-[24px] font-bold">{formatDA(price)}</span>
        </div>
        <span className="p">{s.depositRequired ? 'Acompte demandé sur place · confirmé par le salon' : 'Paiement sur place · aucun acompte demandé'}</span>
      </div>
      <InfoBox>Annulation gratuite jusqu'à {s.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS} h avant. Confirmation par WhatsApp.</InfoBox>
      {slotError && (
        <div className="flex flex-col gap-3">
          <ErrorMessage error={new Error(slotError)} />
          <Button variant="g" onClick={() => navigate(`/s/${slug}/reserver/quand`)}>
            Choisir un autre créneau
          </Button>
        </div>
      )}
      {!slotError && <ErrorMessage error={create.error} />}
      <BottomSheet>
        <Button onClick={() => void confirm()} disabled={create.isPending}>
          {create.isPending ? 'Réservation…' : 'Confirmer la réservation'}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
