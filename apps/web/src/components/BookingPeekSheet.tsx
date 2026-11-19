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
import { ICONE } from '@/lib/actionIcons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useMarkBookingSeen, useMe, useProBooking, useProBookingMutations, useProSalon } from '@salondz/api-client';
import {
  addDaysToKey,
  formatDA,
  formatTimeDZ,
  isLate,
  LATE_TOLERANCE_MINUTES,
  relativeDayLabelDZ,
  SALON_CANCEL_REASONS_FR,
  reasonOptions,
  toLocalDateKey,
  formatLocale,
} from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { originLabel } from '@/lib/pageView';
import { remindedLabel, useReminded } from '@/lib/reminders';
import { ErrorMessage } from './ErrorMessage';
import { PickerField } from './Picker';
import type { LucideIcon } from 'lucide-react';
import { BottomSheet, Button, I, Skeleton, Dim, cancelledLabel } from './ui';
import { ClientContact } from './ClientContact';
import { DepositDecision, DepositReview } from './DepositReview';
import { BookingLoyaltyNote } from './Loyalty';
import { t } from '@/i18n';

/** Délai proposé pour la prochaine visite d'une cliente dont le rendez-vous est terminé. */
const REBOOK_DAYS = 21;

/** « Vendredi 20 novembre » (fuseau d'Alger). */
function jourLong(iso: string): string {
  const txt = new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date(iso));
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** Bouton de la fenêtre, façon Planity : noir (action de l'état), cerclé, ou cerclé rouge (geste négatif). */
function PkBtn({
  kind = 'out',
  icon,
  busy,
  onClick,
  children,
}: {
  kind?: 'ink' | 'out' | 'non';
  icon: LucideIcon;
  busy?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={`pl-pk-b ${kind}`} disabled={busy} aria-busy={busy || undefined} onClick={onClick}>
      <I icon={icon} size={18} /> {children}
    </button>
  );
}

export function BookingPeekSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const booking = useProBooking(id);
  const reminded = useReminded();
  const salon = useProSalon().data?.salon ?? null;
  const meId = useMe().data?.profile?.id;
  const { setStatus, cancel } = useProBookingMutations();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const b = booking.data;

  /**
   * OUVRIR la fenêtre, c'est avoir vu le rendez-vous : c'est le chemin principal depuis l'agenda,
   * et seule la page de détail le marquait — la pastille « pas vus » ne redescendait jamais d'ici.
   */
  const marquerVu = useMarkBookingSeen();
  const dejaMarque = useRef<string | null>(null);
  useEffect(() => {
    if (!id || dejaMarque.current === id) return;
    dejaMarque.current = id;
    marquerVu.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Le salon décide, puis revient à son planning : chaque action referme la fenêtre.
  // Une erreur reste affichée DANS la fenêtre (`setStatus.error` / `cancel.error`) : on ne la referme pas.
  const act = async (p: Promise<unknown>) => {
    try {
      await p;
      onClose();
    } catch {
      /* affichée par ErrorMessage ci-dessous */
    }
  };

  const active = b ? b.status === 'pending' || b.status === 'confirmed' : false;
  const past = b ? new Date(b.startsAt).getTime() < Date.now() : false;
  // Mêmes règles que l'API : une demande dont l'heure est passée ne se confirme plus (le cron
  // l'expire) ; « Terminé » / « Absent » ne valent que pour un rendez-vous CONFIRMÉ ; reporter ou
  // annuler, seulement avant l'heure. Proposer le reste, c'est promettre un refus du serveur.
  const confirmable = b?.status === 'pending' && !past;
  const closable = b?.status === 'confirmed' && past;
  const late = !!b && active && isLate(b.startsAt);
  const running = !!b && b.status === 'confirmed' && past && new Date(b.endsAt).getTime() > Date.now();
  const team = (salon?.staff ?? []).filter((m) => m.isActive).length;
  const mine = !!meId && salon?.staff.find((m) => m.id === b?.staffId)?.userId === meId;
  // L'état se lit d'un coup d'œil, avec les mêmes formes que dans l'agenda.
  const chip = !b
    ? null
    : b.status === 'pending'
      ? {
          text:
            b.depositStatus === 'submitted'
              ? t('Versement à vérifier')
              : b.depositStatus === 'awaiting' || b.depositStatus === 'rejected'
                ? t('Versement attendu')
                : t('À valider'),
          cls: 'pd',
        }
      : running
        ? { text: t('En cours · fin à {h}', { h: formatTimeDZ(b.endsAt) }), cls: 'cur' }
        : b.status === 'confirmed'
          ? { text: t('Confirmé'), cls: 'cf' }
          : b.status === 'completed'
            ? { text: t('Terminé'), cls: 'done' }
            : b.status === 'no_show'
              ? { text: t('Absent'), cls: 'no' }
              : { text: cancelledLabel(b.cancelledBy, 'pro', b.cancellationKind), cls: 'no' };
  const rebook = () => {
    if (!b) return;
    const q = new URLSearchParams({
      date: addDaysToKey(toLocalDateKey(new Date(b.startsAt)), REBOOK_DAYS),
      time: formatTimeDZ(b.startsAt),
      name: b.clientName,
    });
    if (b.clientPhone) q.set('phone', b.clientPhone);
    navigate(`/pro/rendez-vous/nouveau?${q}`);
  };

  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal className="max-h-[88vh] overflow-y-auto">
        {booking.isPending && <Skeleton className="h-[12rem] w-full !rounded-[var(--radius-card)]" />}
        {booking.isError && (
          <ErrorMessage error={booking.error} retry={() => booking.refetch()} />
        )}
        {b && (
          <>
            {/* FAÇON PLANITY (19 nov. 2026, demande du propriétaire) : le nom et de quoi joindre la
                personne ; un bloc blanc à lignes — jour et heure, prestation (durée • prix), avec qui —
                puis des boutons rectangulaires : l'action de l'état en noir sur toute la largeur, les
                autres cerclés, les gestes négatifs en rouge, la fiche en lien. */}
            <div className="ag9-sl pl-pk-hd">
              <span className="ag9-st">{b.clientName}</span>
              <ClientContact booking={b} salon={salon} remind={b.status === 'confirmed' && !past} />
            </div>
            <div className="pl-pk">
              <div className="pl-pk-row">
                <span className="min-w-0">
                  <span className="pl-bk-svn">{jourLong(b.startsAt)}</span>
                  <span className="pl-bk-svm" dir="ltr" style={{ textAlign: 'start' }}>
                    {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)}
                  </span>
                </span>
                {chip && <span className={`ag9-sc ${chip.cls}`}>{chip.text}</span>}
              </div>
              <div className="pl-pk-row">
                <span className="min-w-0">
                  <span className="pl-bk-svn">{b.serviceName}</span>
                  <span className="pl-bk-svm">
                    {formatDuration(b.durationMinutes)}
                    {b.staff && team > 1 && (
                      <>
                        <span className="pl-dot" aria-hidden>•</span>
                        {t('Avec')} {mine ? t('vous') : b.staff.displayName}
                      </>
                    )}
                  </span>
                </span>
                <b className="pl-pk-prix" dir="ltr">{formatDA(b.priceDa)}</b>
              </div>
              {/* Rendez-vous pris par un tiers : le salon doit savoir qui appeler. */}
              {!!b.bookedByName && <p className="pl-pk-note">{t('Réservé par')} {b.bookedByName}</p>}
              {originLabel(b.origin) && <p className="pl-pk-note">{originLabel(b.origin)}</p>}
              {reminded[b.id] && <p className="pl-pk-note">{remindedLabel(reminded[b.id]!)}</p>}
              {b.notes && <p className="pl-pk-note">« {b.notes} »</p>}
              {b.cancellationReason && <p className="pl-pk-note">{b.cancellationReason}</p>}
            </div>
            <DepositReview booking={b} />
            <BookingLoyaltyNote bookingId={b.id} priceDa={b.priceDa} active={active} />

            <ErrorMessage error={setStatus.error ?? cancel.error} />

            {!cancelling && (
              <div className="pl-pk-acts">
                {confirmable && b.depositStatus === 'submitted' && <DepositDecision id={b.id} onDone={onClose} />}
                {confirmable && b.depositStatus !== 'submitted' && (
                  <PkBtn kind="ink" icon={ICONE.accepter} busy={setStatus.isPending} onClick={() => void act(setStatus.mutateAsync({ id: b.id, status: 'confirmed' }))}>
                    {b.depositStatus ? t('Sans versement') : t('Accepter')}
                  </PkBtn>
                )}
                {closable && (
                  <PkBtn kind="ink" icon={ICONE.terminer} busy={setStatus.isPending} onClick={() => void act(setStatus.mutateAsync({ id: b.id, status: 'completed' }))}>
                    {t('Terminé')}
                  </PkBtn>
                )}
                {b.status === 'completed' && (
                  <PkBtn kind="ink" icon={ICONE.reprendre} onClick={rebook}>
                    {t('Dans 3 semaines')}
                  </PkBtn>
                )}
                {confirmable && team > 1 && (
                  <PkBtn icon={ICONE.confier} onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}>
                    {t('Confier')}
                  </PkBtn>
                )}
                {b.status === 'confirmed' && !past && (
                  <PkBtn icon={ICONE.reporter} onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}>
                    {t('Reporter')}
                  </PkBtn>
                )}
                {confirmable && b.depositStatus !== 'submitted' && (
                  <PkBtn kind="non" icon={ICONE.refuser} onClick={() => setCancelling(true)}>
                    {t('Refuser')}
                  </PkBtn>
                )}
                {closable && (
                  <PkBtn kind="non" icon={ICONE.absent} busy={setStatus.isPending} onClick={() => void act(setStatus.mutateAsync({ id: b.id, status: 'no_show' }))}>
                    {t('Absent')}
                  </PkBtn>
                )}
                {late && (
                  <PkBtn kind="non" icon={ICONE.annulerRetard} busy={cancel.isPending} onClick={() => void act(cancel.mutateAsync({ id: b.id, reason: 'Retard', late: true }))}>
                    {t('Retard')}
                  </PkBtn>
                )}
                {b.status === 'confirmed' && !past && (
                  <PkBtn kind="non" icon={ICONE.annulerRdv} onClick={() => setCancelling(true)}>
                    {t('Annuler')}
                  </PkBtn>
                )}
                <button type="button" className="pl-link pl-pk-fiche" onClick={() => navigate(`/pro/rendez-vous/${b.id}`)}>
                  {t('Voir la fiche du rendez-vous')}
                </button>
              </div>
            )}
            {cancelling && (
              <div className="crd !gap-2.5 !border-danger-line">
                <span className="text-[1rem] font-semibold">
                  {b.status === 'pending' ? t('Refuser cette demande ?') : t('Annuler ce rendez-vous ?')}
                </span>
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
                  <Button icon={b.status === 'pending' ? ICONE.refuser : ICONE.annulerRdv}
                    sm
                    variant="d"
                    disabled={cancel.isPending}
                    onClick={() =>
                      void act(cancel.mutateAsync({ id: b.id, reason: reason || undefined }))
                    }
                  >
                    {b.status === 'pending' ? t('Refuser') : t('Annuler')}
                  </Button>
                  <Button icon={ICONE.garder} sm variant="g" onClick={() => setCancelling(false)}>
                    {t("Garder")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </BottomSheet>
    </>
  );
}
