/**
 * C-F 11 — Récapitulatif, lu en trois secondes : quand (jour, heure → fin) et combien en grand, puis les
 * prestations, le salon, « Bon à savoir » (retard, annulation), « Confirmer la réservation ».
 * Blocage par le salon ou suspension anti-abus : dit tout en haut, bouton grisé — jamais découvert après un clic.
 */
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Ban, CalendarCheck, Phone } from 'lucide-react';
import {
  ApiError,
  useBookingStanding,
  useCreateBooking,
  useSalon,
  useUpdateProfile,
} from '@salondz/api-client';
import {
  ARRIVAL_ADVANCE_MINUTES,
  CLIENT_CANCEL_MIN_HOURS,
  LATE_TOLERANCE_MINUTES,
  formatDA,
  formatDateLongDZ,
  formatTimeDZ,
  lateRule,
  minutesToTime,
  relativeDayLabelDZ,
  timeToMinutes,
  toLocalDateKey,
  wilayaName,
} from '@salondz/constants';
import { clearDraft, readDraft } from '@/lib/bookingDraft';
import { formatDuration } from '@/lib/format';
import { Avatar, BottomSheet, Button, I, TopBar } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';

export function BookingReview() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const salon = useSalon(slug);
  const create = useCreateBooking();
  const updateProfile = useUpdateProfile();
  const standing = useBookingStanding(salon.data?.id ?? '');
  // Instantané du brouillon : la création invalide des requêtes (re-rendu) avant la navigation,
  // il ne faut pas relire un brouillon déjà effacé et retomber sur la page du salon.
  const [draft] = useState(() => readDraft(slug));
  const [slotError, setSlotError] = useState<string | null>(null);

  if (!draft.startsAt || !draft.name || draft.serviceIds.length === 0)
    return <Navigate to={`/s/${slug}`} replace />;
  if (salon.isPending) return <Splash />;
  const s = salon.data;
  if (!s) return null;
  const chosen = draft.serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean);
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);
  const start = formatTimeDZ(draft.startsAt);
  const end = minutesToTime(timeToMinutes(start) + minutes);
  const late = lateRule(draft.startsAt);
  const cannotBook = !!standing.data && !standing.data.canBook;
  const blockedMessage = cannotBook ? standing.data?.message : null;

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
      if (
        err instanceof ApiError &&
        (err.code === 'SLOT_TAKEN' ||
          err.code === 'TOO_SOON' ||
          err.code === 'OUTSIDE_OPENING_HOURS' ||
          err.code === 'ALREADY_BOOKED')
      ) {
        setSlotError(err.message);
      }
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo={`/s/${slug}/reserver/coordonnees`} right="Étape 3 sur 3" />
      <h1 className="h1">Récapitulatif</h1>

      {/* Impossible de réserver : dit d'abord, en grand, avec la solution (appeler). */}
      {blockedMessage && (
        <div
          className="flex flex-col gap-3 rounded-[1.25rem] border border-danger-line bg-cancel-bg p-4"
          role="alert"
        >
          <span className="flex items-center gap-2.5 text-[1.125rem] font-bold text-cancel-fg">
            <I icon={Ban} size={22} /> Réservation en ligne impossible
          </span>
          <p className="text-[1rem] text-cancel-fg">{blockedMessage}</p>
          {s.phone && (
            <a href={`tel:${s.phone}`} className="btn g sm !py-[1.125rem] !text-[1rem]">
              <I icon={Phone} size={18} /> Appeler le salon
            </a>
          )}
        </div>
      )}

      {/* L'essentiel en grand : quand, à quelle heure, combien. */}
      <div className={`crd !gap-3 ${blockedMessage ? 'opacity-60' : '!border-ink'}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[1.25rem] font-bold tracking-[-0.3px]">
            {relativeDayLabelDZ(toLocalDateKey(new Date(draft.startsAt)))}
          </span>
          <span className="text-[0.9375rem] text-muted">
            {formatDateLongDZ(draft.startsAt).replace(/^\w/, (c) => c.toUpperCase())}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <span className="mono text-[2.5rem] font-bold leading-none tracking-[-1px]">
            {start}{' '}
            <span className="text-[1.125rem] font-medium tracking-normal text-muted">→ {end}</span>
          </span>
          <span className="text-[1.75rem] font-bold leading-none tracking-[-0.7px]">
            {formatDA(price)}
          </span>
        </div>
        <span className="text-[1rem] text-muted">
          {formatDuration(minutes)} au total ·{' '}
          {s.depositRequired ? 'acompte demandé sur place' : 'paiement sur place, aucun acompte'}
        </span>
      </div>

      <div className="crd !gap-0">
        <div className="li !py-3">
          <span className="text-[1.0625rem] font-bold">
            {chosen.length} prestation{chosen.length > 1 ? 's' : ''}
          </span>
          <span className="text-[1rem] font-semibold">{formatDA(price)}</span>
        </div>
        {chosen.map((sv) => (
          <div key={sv!.id} className="li !py-3">
            <span className="text-[1.0625rem] font-semibold">{sv!.name}</span>
            <span className="text-[0.9375rem] text-muted">
              {formatDuration(sv!.durationMinutes)} · {formatDA(sv!.priceDa)}
            </span>
          </div>
        ))}
      </div>

      <div className="crd">
        <div className="flex items-center gap-3.5">
          <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={56} />
          <span className="min-w-0">
            <span className="block text-[1.0625rem] font-bold tracking-[-0.3px]">{s.name}</span>
            <span className="block truncate text-[0.9375rem] text-muted">
              {[s.address, s.zone ?? s.city, wilayaName(s.wilayaCode)].filter(Boolean).join(', ')}
            </span>
          </span>
        </div>
      </div>

      <div className="crd !gap-2">
        <span className="flex items-center gap-2 text-[0.8125rem] font-bold uppercase tracking-[0.08em] text-muted">
          <I icon={CalendarCheck} size={15} /> Bon à savoir
        </span>
        <ul className="ml-1 flex list-disc flex-col gap-1.5 pl-4 text-[1rem]">
          <li>
            Arrivez à <b>{late.arriveAt}</b> ({ARRIVAL_ADVANCE_MINUTES} min avant). Retard toléré
            jusqu'à <b>{late.lateUntil}</b> ({LATE_TOLERANCE_MINUTES} min).
          </li>
          <li>
            Annulation ou report gratuits jusqu'à {s.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS} h
            avant.
          </li>
          <li>Confirmation par WhatsApp et rappel avant le rendez-vous.</li>
        </ul>
      </div>

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
        <Button
          onClick={() => void confirm()}
          disabled={create.isPending || cannotBook || standing.isPending}
        >
          {cannotBook
            ? 'Réservation en ligne impossible'
            : create.isPending
              ? 'Réservation…'
              : 'Confirmer la réservation'}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
