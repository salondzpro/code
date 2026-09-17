/**
 * C-F 11 — Récapitulatif, lu en trois secondes : quand (jour, heure → fin) et combien en grand, puis les
 * prestations, le salon, « Bon à savoir » (retard, annulation), « Confirmer la réservation ».
 * Blocage par le salon ou suspension anti-abus : dit tout en haut, bouton grisé — jamais découvert après un clic.
 */
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Ban, Banknote, CalendarCheck, CalendarDays, Phone, Scissors, UserRound } from 'lucide-react';
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
  formatDZPhone,
  formatDateLongDZ,
  formatTimeDZ,
  lateRule,
  minutesToTime,
  relativeDayLabelDZ,
  timeToMinutes,
  toLocalDateKey,
  wilayaName,
  SHOW_SALON_CONTACT_TO_CLIENTS,
} from '@salondz/constants';
import { clearDraft, readDraft } from '@/lib/bookingDraft';
import { formatDuration } from '@/lib/format';
import { Avatar, BottomSheet, Button, I, TopBar } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FactRow } from '@/components/BookingFacts';
import { Splash } from '@/pages/auth/Splash';
import { t } from '@/i18n';

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
  const dayLabel = relativeDayLabelDZ(toLocalDateKey(new Date(draft.startsAt)));
  const dateLong = formatDateLongDZ(draft.startsAt).replace(/^\w/, (c) => c.toUpperCase());
  // La suspension du compte connecté ne concerne QUE ses propres rendez-vous : pour
  // quelqu'un d'autre, ce sont les règles de cette personne qui comptent, et le serveur
  // les applique sur son compte ou son numéro.
  const cannotBook = !draft.forOther && !!standing.data && !standing.data.canBook;
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
        beneficiary:
          draft.forOther && draft.otherName && draft.otherPhone
            ? { fullName: draft.otherName, phone: draft.otherPhone }
            : undefined,
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
      <h1 className="h1">{t("Récapitulatif")}</h1>

      {/* Impossible de réserver : dit d'abord, en grand, avec la solution (appeler). */}
      {blockedMessage && (
        <div
          className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-danger-line bg-cancel-bg p-4"
          role="alert"
        >
          <span className="flex items-center gap-2.5 text-[1.143rem] font-bold text-cancel-fg">
            <I icon={Ban} size={22} /> {t("Réservation en ligne impossible")}
          </span>
          <p className="text-[1rem] text-cancel-fg">{blockedMessage}</p>
          {SHOW_SALON_CONTACT_TO_CLIENTS && s.phone && (
            <a href={`tel:${s.phone}`} className="btn g sm !text-[1rem]">
              <I icon={Phone} size={18} /> {t("Appeler le salon")}
            </a>
          )}
        </div>
      )}

      {/* Où : le salon et son adresse. */}
      <div className={`crd !flex-row items-center gap-3.5 ${blockedMessage ? 'opacity-60' : ''}`}>
        <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={56} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.143rem] font-semibold tracking-[-0.3px]">
            {s.name}
          </span>
          <span className="block truncate text-[0.857rem] text-muted">
            {[s.address, s.zone ?? s.city, wilayaName(s.wilayaCode)].filter(Boolean).join(', ')}
          </span>
        </span>
      </div>

      {/* Quoi, quand, pour qui, combien : une ligne par fait, lue en trois secondes. */}
      <div className={`crd !gap-0 !py-1 ${blockedMessage ? 'opacity-60' : '!border-ink'}`}>
        <FactRow
          icon={CalendarDays}
          title={/^\p{L}+\. \d/u.test(dayLabel) ? dateLong : `${dayLabel} · ${dateLong}`}
          sub={`${start} – ${end} · ${formatDuration(minutes)}`}
          right={
            <span className="mono text-[1.429rem] font-semibold tracking-[-0.5px]">{start}</span>
          }
        />
        {chosen.map((sv) => (
          <FactRow
            key={sv!.id}
            icon={Scissors}
            title={sv!.name}
            sub={formatDuration(sv!.durationMinutes)}
            right={
              chosen.length > 1 ? (
                <span className="text-[1rem] font-semibold">{formatDA(sv!.priceDa)}</span>
              ) : undefined
            }
          />
        ))}
        {draft.forOther && !!draft.otherName && (
          <FactRow
            icon={UserRound}
            title={`Pour ${draft.otherName}`}
            sub={`${draft.otherPhone ? `${formatDZPhone(draft.otherPhone)} · ` : ''}à son nom, avec ses règles d'annulation`}
          />
        )}
        <FactRow
          icon={Banknote}
          title={formatDA(price)}
          sub={s.depositRequired ? 'Acompte demandé sur place' : 'Paiement sur place, aucun acompte'}
        />
      </div>

      <div className="crd !gap-2">
        <span className="flex items-center gap-2 text-[0.857rem] font-bold uppercase tracking-[0.08em] text-muted">
          <I icon={CalendarCheck} size={16} /> {t("Bon à savoir")}
        </span>
        <ul className="ms-1 flex list-disc flex-col gap-1.5 ps-4 text-[1rem]">
          <li>
            {t("Arrivez à")}{' '}<b>{late.arriveAt}</b> ({ARRIVAL_ADVANCE_MINUTES} {t("min avant). Retard toléré jusqu'à")}{' '}<b>{late.lateUntil}</b> ({LATE_TOLERANCE_MINUTES} {t("min).")}
          </li>
          <li>
            {t("Annulation ou report gratuits jusqu'à")}{' '}{s.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS} {t("h avant.")}
          </li>
          <li>{t("Confirmation et rappel avant le rendez-vous.")}</li>
        </ul>
      </div>

      {slotError && (
        <div className="flex flex-col gap-3">
          <ErrorMessage error={new Error(slotError)} />
          <Button variant="g" onClick={() => navigate(`/s/${slug}/reserver/quand`)}>
            {t("Choisir un autre créneau")}
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
