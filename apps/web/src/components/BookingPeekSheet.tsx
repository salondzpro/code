/**
 * Détail d'un rendez-vous en fenêtre, ouvert depuis l'agenda.
 *
 * Pourquoi une fenêtre et pas une page : dans un agenda, on ouvre un rendez-vous pour
 * vérifier ou décider, puis on revient immédiatement au planning. Une page dédiée fait
 * perdre le contexte — le jour affiché, la position dans la journée, le défilement — et
 * impose un aller-retour pour chaque rendez-vous d'une matinée chargée. La fenêtre garde
 * l'agenda derrière elle et se referme sur la décision.
 *
 * Le rendez-vous est relu par son identifiant plutôt que passé en entier : la fenêtre
 * affiche donc toujours l'état courant, même si l'agenda a été chargé il y a dix minutes.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlarmClock,
  ArrowRight,
  Check,
  CheckCircle2,
  MessageCircle,
  Phone,
  Scissors,
  StickyNote,
  UserRound,
  UserX,
  XCircle,
} from 'lucide-react';
import { useProBooking, useProBookingMutations } from '@salondz/api-client';
import {
  formatDA,
  formatDateLongDZ,
  formatDZPhone,
  formatTimeDZ,
  isLate,
  LATE_TOLERANCE_MINUTES,
  relativeDayLabelDZ,
  SALON_CANCEL_REASONS_FR,
  reasonOptions,
  toLocalDateKey,
} from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { ErrorMessage } from './ErrorMessage';
import { FactRow } from './BookingFacts';
import { PickerField } from './Picker';
import { Avatar, BottomSheet, Button, I, Skeleton, StatusBadge } from './ui';
import { t } from '@/i18n';

export function BookingPeekSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const booking = useProBooking(id);
  const { setStatus, cancel } = useProBookingMutations();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const b = booking.data;

  // Le salon décide, puis revient à son planning : chaque action referme la fenêtre.
  const act = async (p: Promise<unknown>) => {
    await p;
    onClose();
  };

  const active = b ? b.status === 'pending' || b.status === 'confirmed' : false;
  const past = b ? new Date(b.startsAt).getTime() < Date.now() : false;
  const late = !!b && active && isLate(b.startsAt);
  const lines = b?.items?.length
    ? b.items
    : b
      ? [
          {
            id: b.id,
            serviceName: b.serviceName,
            durationMinutes: b.durationMinutes,
            priceDa: b.priceDa,
          },
        ]
      : [];
  const wa = b?.clientPhone ? `https://wa.me/${b.clientPhone.replace(/\D/g, '')}` : null;

  return (
    <>
      <div className="dim" onClick={onClose} />
      <BottomSheet className="max-h-[88vh] overflow-y-auto">
        {booking.isPending && <Skeleton className="h-[12rem] w-full !rounded-[var(--radius-card)]" />}
        {booking.isError && (
          <ErrorMessage error={booking.error} retry={() => booking.refetch()} />
        )}
        {b && (
          <>
            {/* L'essentiel d'abord : quand, combien, dans quel état. */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-[0.857rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  {relativeDayLabelDZ(toLocalDateKey(new Date(b.startsAt)))}
                </span>
                <span className="mono block text-[2.286rem] font-semibold leading-none tracking-[-1px]">
                  {formatTimeDZ(b.startsAt)}
                  <span className="text-[1.143rem] font-normal text-muted">
                    {' '}
                    – {formatTimeDZ(b.endsAt)}
                  </span>
                </span>
              </div>
              <div className="flex flex-none flex-col items-end gap-1.5">
                <StatusBadge status={b.status} cancelledBy={b.cancelledBy} lg />
                <span className="text-[1.429rem] font-semibold leading-none">
                  {formatDA(b.priceDa)}
                </span>
              </div>
            </div>
            <span className="text-[0.857rem] text-muted">
              {formatDateLongDZ(b.startsAt)} · {formatDuration(b.durationMinutes)}
              {b.staff ? ` · ${b.staff.displayName}` : ''}
            </span>

            {/* Qui, et comment le joindre : côté salon, le numéro reste visible. */}
            <div className="crd !gap-2.5">
              <div className="flex items-center gap-3">
                <Avatar name={b.clientName} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[1.143rem] font-semibold">
                    {b.clientName}
                  </span>
                  {b.clientPhone && (
                    <span className="mono block text-[0.857rem] text-muted">
                      {formatDZPhone(b.clientPhone)}
                    </span>
                  )}
                  {/* Rendez-vous pris par un tiers : le salon doit savoir qui appeler. */}
                  {!!b.bookedByName && (
                    <span className="block truncate text-[0.857rem] text-muted">
                      {t("Réservé par")}{' '}{b.bookedByName}
                    </span>
                  )}
                </span>
              </div>
              {b.clientPhone && (
                <div className="g2">
                  <a href={`tel:${b.clientPhone}`} className="btn g sm">
                    <I icon={Phone} size={16} /> {t("Appeler")}
                  </a>
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" className="btn g sm">
                      <I icon={MessageCircle} size={16} /> {t("WhatsApp")}
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="crd !gap-0 !py-1">
              {lines.map((it) => (
                <FactRow
                  key={it.id}
                  icon={Scissors}
                  title={it.serviceName}
                  sub={lines.length > 1 ? formatDuration(it.durationMinutes) : undefined}
                  right={
                    lines.length > 1 ? (
                      <span className="text-[1rem] font-semibold">{formatDA(it.priceDa)}</span>
                    ) : undefined
                  }
                />
              ))}
              {b.staff && <FactRow icon={UserRound} title={`Avec ${b.staff.displayName}`} />}
              {b.notes && <FactRow icon={StickyNote} title={t("Note du client")} sub={`« ${b.notes} »`} />}
              {b.cancellationReason && (
                <FactRow icon={XCircle} tone="danger" title={t("Motif")} sub={b.cancellationReason} />
              )}
            </div>

            <ErrorMessage error={setStatus.error ?? cancel.error} />

            {/* Décisions, dans l'ordre où elles se présentent réellement. */}
            {b.status === 'pending' && (
              <Button
                variant="ok"
                disabled={setStatus.isPending}
                onClick={() => void act(setStatus.mutateAsync({ id: b.id, status: 'confirmed' }))}
              >
                <I icon={Check} size={18} /> {t("Confirmer le rendez-vous")}
              </Button>
            )}
            {active && past && (
              <div className="g2">
                <Button
                  disabled={setStatus.isPending}
                  onClick={() => void act(setStatus.mutateAsync({ id: b.id, status: 'completed' }))}
                >
                  <I icon={CheckCircle2} size={18} /> {t("Terminé")}
                </Button>
                <Button
                  variant="d"
                  disabled={setStatus.isPending}
                  onClick={() => void act(setStatus.mutateAsync({ id: b.id, status: 'no_show' }))}
                >
                  <I icon={UserX} size={18} /> {t("Absent")}
                </Button>
              </div>
            )}
            {late && (
              <Button
                variant="d"
                disabled={cancel.isPending}
                onClick={() =>
                  void act(cancel.mutateAsync({ id: b.id, reason: 'Retard', late: true }))
                }
              >
                <I icon={AlarmClock} size={18} /> {t("Annuler pour retard (plus de")}{' '}
                {LATE_TOLERANCE_MINUTES} {t("min)")}
              </Button>
            )}
            {active && !cancelling && (
              <div className="g2">
                <Button
                  variant="g"
                  onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}
                >
                  {t("Reporter")}
                </Button>
                <Button variant="d" onClick={() => setCancelling(true)}>
                  {t("Annuler")}
                </Button>
              </div>
            )}
            {cancelling && (
              <div className="crd !gap-2.5 !border-danger-line">
                <span className="text-[1rem] font-semibold">{t("Annuler ce rendez-vous ?")}</span>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[1rem]">{t("Motif (optionnel)")}</span>
                  <PickerField
                    label={t("Motif")}
                    title={t("Pourquoi annuler ?")}
                    options={reasonOptions(SALON_CANCEL_REASONS_FR)}
                    value={reason || null}
                    onChange={setReason}
                    placeholder={t("Choisir")}
                    inline
                  />
                </div>
                <div className="g2">
                  <Button
                    variant="d"
                    disabled={cancel.isPending}
                    onClick={() =>
                      void act(cancel.mutateAsync({ id: b.id, reason: reason || undefined }))
                    }
                  >
                    {t("Annuler le rendez-vous")}
                  </Button>
                  <Button variant="g" onClick={() => setCancelling(false)}>
                    {t("Garder")}
                  </Button>
                </div>
              </div>
            )}

            <button
              type="button"
              className="flex items-center justify-center gap-1.5 py-1 text-[1rem] font-semibold"
              onClick={() => navigate(`/pro/rendez-vous/${b.id}`)}
            >
              {t("Fiche complète et historique")}{' '}<I icon={ArrowRight} size={16} />
            </button>
          </>
        )}
      </BottomSheet>
    </>
  );
}
