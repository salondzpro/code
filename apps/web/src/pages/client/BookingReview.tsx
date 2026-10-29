/**
 * C-F 11 — Récapitulatif, lu en trois secondes : quand (jour, heure → fin) et combien en grand, puis les
 * prestations, le salon, « Bon à savoir » (retard, annulation), « Confirmer la réservation ».
 * Blocage par le salon ou suspension anti-abus : dit tout en haut, bouton grisé — jamais découvert après un clic.
 */
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Ban, CalendarCheck, Phone, StickyNote, UserRound } from 'lucide-react';
import type { BookingWithSalon } from '@salondz/types';
import {
  ApiError,
  useBookingStanding,
  useCreateBooking,
  useSalon,
  useUpdateProfile,
} from '@salondz/api-client';
import { CLIENT_CANCEL_MIN_HOURS, formatDZPhone, wilayaName, SHOW_SALON_CONTACT_TO_CLIENTS } from '@salondz/constants';
import { clearDraft, readDraft } from '@/lib/bookingDraft';
import { BottomSheet, Button, I, TopBar } from '@/components/ui';
import { BookingSummary } from '@/components/BookingSummary';
import { ConfirmedView } from './BookingConfirmed';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FactRow } from '@/components/BookingFacts';
import { PageLoading } from '@/components/PageLoading';
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
  const [done, setDone] = useState<BookingWithSalon | null>(null);

  // Réservation prise : l'écran se TRANSFORME en confirmation, sans changer de page.
  if (done) return <ConfirmedView booking={done} />;
  if (!draft.startsAt || !draft.name || draft.serviceIds.length === 0)
    return <Navigate to={`/s/${slug}`} replace />;
  if (salon.isPending) return <PageLoading />;
  // Dernière étape : un écran blanc ici ferait croire à une réservation perdue. On dit ce qui se passe.
  if (salon.isError) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;
  const s = salon.data;
  if (!s) return <ErrorMessage error={new Error('Salon introuvable')} />;
  const chosen = draft.serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean);
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);
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
      if (draft.whatsapp !== undefined) updateProfile.mutate({ remindersEnabled: draft.whatsapp });
      clearDraft(slug);
      // Même entrée d'historique (état du routeur conservé), nouvelle adresse : un rechargement
      // rouvre la confirmation, et « retour » ne ramène pas sur un récapitulatif déjà envoyé.
      window.history.replaceState(window.history.state, '', `/rendez-vous/${b.id}/confirme`);
      setDone(b);
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
  if (done) return <ConfirmedView booking={done} />;

  const area = [s.address, s.zone ?? s.city, wilayaName(s.wilayaCode)].filter(Boolean).join(', ');
  const endsAt = new Date(new Date(draft.startsAt).getTime() + minutes * 60_000).toISOString();

  return (
    <Screen bottom={SHEET_PAD} gap={12}>
      <TopBar backTo={`/s/${slug}/reserver/coordonnees`} right={t('Étape 3 sur 3')} />
      <h1 className="h1 !text-[1.571rem]">{t('Vérifiez et confirmez')}</h1>

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

      {/* Où, quand, quoi, combien : une seule carte, la même que la confirmation qui va la remplacer. */}
      <BookingSummary
        className={blockedMessage ? 'opacity-60' : '!border-ink'}
        salon={{ name: s.name, logoUrl: s.logoUrl, coverUrl: s.coverUrl, area }}
        startsAt={draft.startsAt}
        endsAt={endsAt}
        lines={chosen.map((sv) => ({ id: sv!.id, name: sv!.name, minutes: sv!.durationMinutes, priceDa: sv!.priceDa }))}
        priceDa={price}
        payNote={s.depositRequired ? t('Acompte demandé sur place') : t('Paiement sur place, aucun acompte')}
        extra={
          <>
            {draft.forOther && !!draft.otherName && (
              <FactRow
                icon={UserRound}
                title={t('Pour {name}', { name: draft.otherName })}
                sub={`${draft.otherPhone ? `${formatDZPhone(draft.otherPhone)} · ` : ''}${t("à son nom, avec ses règles d'annulation")}`}
              />
            )}
            {!!draft.notes && <FactRow icon={StickyNote} title={t('Votre note')} sub={`« ${draft.notes} »`} />}
          </>
        }
      />
      <p className="flex items-start gap-2 px-1 text-[0.857rem] text-muted">
        <I icon={CalendarCheck} size={16} className="mt-0.5 flex-none" />
        {t("Annulation ou report gratuits jusqu'à {h} h avant. Rappel 1 h puis 30 min avant.", { h: s.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS })}
      </p>

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
          loading={create.isPending}
          disabled={create.isPending || cannotBook || standing.isPending}
        >
          {cannotBook
            ? t('Réservation en ligne impossible')
            : create.isPending
              ? t('Réservation…')
              : t('Confirmer la réservation')}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
