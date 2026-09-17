/**
 * Détail d'un rendez-vous côté client (structure de C-F 15) : salon, contact, puis l'essentiel en grand
 * (Aujourd'hui / Demain / date, heure, prix) et la liste des prestations — même lecture que la fiche pro.
 * Reporter / Annuler. C-F 17 — feuille « Annuler ce rendez-vous ? » (avec la règle anti-abus) ; C-F 18 — annulation confirmée.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CalendarDays,
  MessageCircle,
  Navigation,
  Phone,
  RotateCcw,
  Scissors,
  Star,
  StickyNote,
  UserRound,
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
  CLIENT_CANCEL_REASONS_FR,
  reasonOptions,
  SHOW_SALON_CONTACT_TO_CLIENTS,
  PENDING_REQUEST_TTL_HOURS,
  formatLocale,
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
  TopBar, Dim } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { PickerField } from '@/components/Picker';
import { ErrorMessage } from '@/components/ErrorMessage';
import { LateRule } from '@/components/LateRule';
import { FactRow } from '@/components/BookingFacts';
import { Splash } from '@/pages/auth/Splash';
import { GoogleCalendarButton } from './BookingConfirmed';
import { directionsUrl } from './Bookings';
import { t } from '@/i18n';

const formatDeadline = (ms: number) =>
  new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Algiers' }).format(new Date(ms));

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
  // Rendez-vous que J'AI pris pour quelqu'un d'autre : il est à cette personne, pas à moi.
  const forSomeoneElse = !!b.bookedBy && b.bookedBy === me.data?.profile.id && b.clientId !== me.data?.profile.id;
  const active = b.status === 'pending' || b.status === 'confirmed';
  const hoursLeft = Math.floor((new Date(b.startsAt).getTime() - Date.now()) / 3_600_000);
  // Règles du salon (même source que l'API) : délai d'annulation, report client autorisé.
  const minHours = b.salon.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS;
  const canModify = active && hoursLeft >= minHours;
  const rescheduled = b.clientReschedules >= MAX_CLIENT_RESCHEDULES;
  const canReschedule = canModify && b.salon.allowClientReschedule !== false && !rescheduled;
  const wa =
    SHOW_SALON_CONTACT_TO_CLIENTS && b.salon.phone
      ? `https://wa.me/${b.salon.phone.replace(/\D/g, '')}`
      : null;
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
    // C-F 18 — Annulation confirmée : même lecture en grand que la fiche, avec le statut « Annulé » bien visible.
    // Pas de centrage plein écran : du contenu utile suit la pastille, le centrage ne faisait
    // que pousser l'ensemble vers le bas de l'écran.
    return (
      <Screen gap={12}>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-[5rem] w-[5rem] items-center justify-center rounded-full bg-cancel-bg text-cancel-fg">
            <I icon={XCircle} size={40} />
          </span>
          <h1 className="h1">{t("Rendez-vous annulé")}</h1>
          <p className="p">
            {b.salon.name} {t("a été prévenu. Aucun frais ne vous est appliqué.")}
          </p>
        </div>
        <div className="crd !gap-3 !border-danger-line">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[1rem] font-bold">
              {relativeDayLabelDZ(toLocalDateKey(new Date(b.startsAt)))}
            </span>
            <StatusBadge status="cancelled" lg cancelledBy="client" />
          </div>
          <div className="flex items-end justify-between gap-3">
            <span className="mono text-[2.286rem] font-bold leading-none tracking-[-0.9px] line-through decoration-danger/60 decoration-2">
              {formatTimeDZ(b.startsAt)}{' '}
              <span className="text-[1rem] font-medium text-muted">– {formatTimeDZ(b.endsAt)}</span>
            </span>
            <span className="text-[1.714rem] font-bold leading-none tracking-[-0.6px] text-muted line-through decoration-danger/60 decoration-2">
              {formatDA(b.priceDa)}
            </span>
          </div>
          <span className="text-[0.857rem] text-muted">
            {formatDateLongDZ(b.startsAt).replace(/^\w/, (c) => c.toUpperCase())} · {b.salon.name}
          </span>
        </div>
        <div className="crd !gap-0">
          <div className="li !py-3">
            <span className="text-[1rem] font-bold">
              {lines.length} {t("prestation")}{lines.length > 1 ? 's' : ''}
            </span>
            <span className="text-[1rem] text-muted">{t("annulée")}{lines.length > 1 ? 's' : ''}</span>
          </div>
          {lines.map((it) => (
            <div key={it.id} className="li !py-3">
              <span className="text-[1rem] font-semibold">{it.serviceName}</span>
              <span className="text-[1rem] text-muted">
                {it.durationMinutes
                  ? `${formatDuration(it.durationMinutes)} · ${formatDA(it.priceDa)}`
                  : formatDA(it.priceDa)}
              </span>
            </div>
          ))}
        </div>
        <LinkButton to={`/s/${b.salon.slug}/prestations`}>
          <I icon={RotateCcw} size={18} /> {t("Réserver un autre créneau")}
        </LinkButton>
        <LinkButton to="/rendez-vous" variant="g">
          <I icon={ArrowLeft} size={18} /> {t("Retour à mes rendez-vous")}
        </LinkButton>
      </Screen>
    );
  }

  const dayKey = toLocalDateKey(new Date(b.startsAt));
  const dayLabel = relativeDayLabelDZ(dayKey);
  const dateLong = formatDateLongDZ(b.startsAt).replace(/^\w/, (c) => c.toUpperCase());
  const address = [b.salon.address, b.salon.city].filter(Boolean).join(', ');

  return (
    <Screen className="min-h-dvh" gap={12}>
      <TopBar backTo="/rendez-vous" />
      {/* Où : le salon et son adresse, l'état de la réservation, de quoi le joindre. */}
      <div className="crd !gap-3">
        <div className="flex items-center gap-3.5">
          <Avatar src={b.salon.logoUrl ?? b.salon.coverUrl} name={b.salon.name} size={56} />
          <span className="min-w-0 flex-1">
            <h1 className="h1 truncate !text-[1.429rem]">{b.salon.name}</h1>
            <span className="block truncate text-[0.857rem] text-muted">
              {address || b.salon.city}
            </span>
          </span>
          <StatusBadge status={b.status} md cancelledBy={b.cancelledBy} kind={b.cancellationKind} />
        </div>
        {/* Validation manuelle : le créneau est bloqué pour les autres tant que le salon n'a pas répondu, et
            la demande expire d'elle-même (le client est prévenu, le créneau libéré). */}
        {b.status === 'pending' && (
          <InfoBox>
            {t('Le salon a jusqu’au {when} pour confirmer. Sans réponse, la demande expire et vous êtes prévenu(e).', {
              when: formatDeadline(Math.min(new Date(b.createdAt).getTime() + PENDING_REQUEST_TTL_HOURS * 3_600_000, new Date(b.startsAt).getTime())),
            })}
          </InfoBox>
        )}
        {SHOW_SALON_CONTACT_TO_CLIENTS && b.salon.phone && (
          <div className="g2">
            <a href={`tel:${b.salon.phone}`} className="btn g sm">
              <I icon={Phone} size={18} /> {t("Appeler")}
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="btn g sm">
                <I icon={MessageCircle} size={18} /> {t("WhatsApp")}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Quoi, quand, avec qui, combien : une ligne par fait — même lecture que la fiche pro. */}
      <div className="crd !gap-0 !py-1">
        <FactRow
          icon={CalendarDays}
          title={/^\p{L}+\. \d/u.test(dayLabel) ? dateLong : `${dayLabel} · ${dateLong}`}
          sub={`${formatTimeDZ(b.startsAt)} – ${formatTimeDZ(b.endsAt)} · ${formatDuration(b.durationMinutes)}`}
          right={
            <span
              className={`mono text-[1.429rem] font-semibold tracking-[-0.5px] ${active ? '' : 'text-muted'}`}
            >
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
        {/* Pris pour quelqu'un d'autre, ou par quelqu'un d'autre : sans cette ligne, on ne
            sait pas de quel rendez-vous il s'agit ni pourquoi il est là. */}
        {forSomeoneElse && (
          <FactRow icon={UserRound} title={`Pour ${b.clientName}`} sub="À son nom, avec ses règles" />
        )}
        {!forSomeoneElse && !!b.bookedByName && (
          <FactRow icon={UserRound} title={`Réservé par ${b.bookedByName}`} />
        )}
        {b.notes && <FactRow icon={StickyNote} title={t("Votre note")} sub={`« ${b.notes} »`} />}
        {b.cancellationReason && (
          <FactRow icon={XCircle} tone="danger" title={t("Motif")} sub={b.cancellationReason} />
        )}
      </div>
      {active && <LateRule startsAt={b.startsAt} />}
      <div className="flex flex-col gap-2.5">
        {active && (
          <a href={directionsUrl(b)} target="_blank" rel="noreferrer" className="btn g">
            <I icon={Navigation} size={18} /> {t("Itinéraire")}
          </a>
        )}
        {canReschedule && (
          <div className="g2">
            <Link to={`/rendez-vous/${b.id}/reporter`} className="btn g">
              <I icon={CalendarClock} size={18} /> {t("Reporter")}
            </Link>
            <Button variant="d" onClick={() => setCancelling(true)}>
              <I icon={XCircle} size={18} /> {t("Annuler")}
            </Button>
          </div>
        )}
        {canModify && !canReschedule && (
          <Button variant="d" onClick={() => setCancelling(true)}>
            <I icon={XCircle} size={18} /> {t("Annuler")}
          </Button>
        )}
        {active && !canModify && (
          <p className="p text-center text-[1rem]">
            {t("Report et annulation en ligne possibles jusqu'à")}{' '}{minHours} {t("h avant. Contactez le salon.")}
          </p>
        )}
        {canModify && rescheduled && b.salon.allowClientReschedule !== false && (
          <p className="p text-center text-[1rem]">
            {t("Déjà reporté une fois. Pour le déplacer encore, contactez le salon.")}
          </p>
        )}
        {b.status === 'completed' && b.reviewRating == null && (
          <LinkButton to={`/rendez-vous/${b.id}/noter`}>
            <I icon={Star} size={18} /> {t("Noter la prestation")}
          </LinkButton>
        )}
        {b.status === 'completed' && b.reviewRating != null && (
          <InfoBox>
            {t("Merci ! Vous avez noté ce rendez-vous")}{' '}{b.reviewRating}{t("/5. Votre avis est visible sur la page du salon.")}
          </InfoBox>
        )}
        {active && <GoogleCalendarButton booking={b} />}
      </div>

      {cancelling && (
        <>
          <Dim onClose={() => setCancelling(false)} />
          <BottomSheet>
            <div className="text-center">
              <div className="text-[1.429rem] font-bold tracking-[-0.4px]">
                {t("Annuler ce rendez-vous ?")}
              </div>
              <p className="p mt-2">
                {t("Annulation gratuite — il reste")}{' '}{hoursLeft} {t("h avant le rendez-vous. Le créneau sera libéré immédiatement.")}
              </p>
            </div>
            <InfoBox>
              {cancels >= CANCEL_ABUSE_MAX - 1
                ? `Attention : ce serait votre ${cancels + 1}ᵉ annulation en ${CANCEL_ABUSE_WINDOW_DAYS} jours. Au-delà de ${CANCEL_ABUSE_MAX}, la réservation en ligne est suspendue ${CANCEL_ABUSE_BLOCK_DAYS} jours.`
                : `Pour respecter le travail des salons, au-delà de ${CANCEL_ABUSE_MAX} annulations en ${CANCEL_ABUSE_WINDOW_DAYS} jours la réservation en ligne est suspendue ${CANCEL_ABUSE_BLOCK_DAYS} jours.`}
            </InfoBox>
            <div className="crd !flex-row items-center justify-between !py-3">
              <span className="text-[1rem]">{t("Motif (optionnel)")}</span>
              <PickerField
                label={t("Motif")}
                title={t("Pourquoi annuler ?")}
                options={reasonOptions(CLIENT_CANCEL_REASONS_FR)}
                value={reason || null}
                onChange={setReason}
                placeholder={t("Choisir")}
                inline
              />
            </div>
            <ErrorMessage error={cancel.error} />
            <Button
              className="!bg-danger !text-white"
              disabled={cancel.isPending}
              onClick={async () => {
                await cancel.mutateAsync({ id: b.id, reason: reason || undefined });
                setCancelling(false);
                setDone(true);
              }}
            >
              {cancel.isPending ? 'Annulation…' : 'Annuler le rendez-vous'}
            </Button>
            <Button variant="g" onClick={() => setCancelling(false)}>
              {t("Garder le rendez-vous")}
            </Button>
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}
