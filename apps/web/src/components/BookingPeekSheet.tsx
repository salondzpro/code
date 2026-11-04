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
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlarmClock, ArrowRight, CheckCircle2, MessageCircle, Phone, UserX } from 'lucide-react';
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
} from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { ErrorMessage } from './ErrorMessage';
import { PickerField } from './Picker';
import { BottomSheet, Button, I, Skeleton, Dim, cancelledLabel } from './ui';
import { t } from '@/i18n';

/** Délai proposé pour la prochaine visite d'une cliente dont le rendez-vous est terminé. */
const REBOOK_DAYS = 21;

export function BookingPeekSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const booking = useProBooking(id);
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
  const phone = b?.clientPhone?.replace(/\D/g, '');
  const wa = phone ? `https://wa.me/${phone}` : null;
  const reminder =
    wa && b
      ? `${wa}?text=${encodeURIComponent(
          t('Bonjour {name}, petit rappel de votre rendez-vous {day} à {time}{salon}.', {
            name: b.clientName,
            day: relativeDayLabelDZ(toLocalDateKey(new Date(b.startsAt))).toLowerCase(),
            time: formatTimeDZ(b.startsAt),
            salon: salon ? ` · ${salon.name}` : '',
          }),
        )}`
      : null;
  // L'état se lit d'un coup d'œil, avec les mêmes formes que dans l'agenda.
  const chip = !b
    ? null
    : b.status === 'pending'
      ? { text: t('À valider'), cls: 'pd' }
      : running
        ? { text: t('En cours · fin à {h}', { h: formatTimeDZ(b.endsAt) }), cls: 'cur' }
        : b.status === 'confirmed'
          ? { text: t('Confirmé'), cls: '' }
          : b.status === 'completed'
            ? { text: t('Terminé'), cls: '' }
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
            {/* L'état et les contacts, puis qui, quoi, quand. */}
            <div className="ag9-sl">
              {chip && <span className={`ag9-sc ${chip.cls}`}>{chip.text}</span>}
              {b.clientPhone && (
                <a href={`tel:${b.clientPhone}`} className="ag9-si" aria-label={t('Appeler')}>
                  <I icon={Phone} size={16} />
                </a>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="ag9-si" aria-label={t('WhatsApp')}>
                  <I icon={MessageCircle} size={16} />
                </a>
              )}
            </div>
            <div className="ag9-sh">
              <div className="min-w-0">
                <span className="ag9-st">{b.clientName}</span>
                <span className="ag9-sb">
                  {b.serviceName} · {formatDuration(b.durationMinutes)}
                </span>
              </div>
              <span className="ag9-stm" dir="ltr">
                {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)}
              </span>
            </div>
            <div className="ag9-sr">
              {b.staff && team > 1 ? (
                <>
                  <span className="text-subtle">{t('Avec')}</span>
                  <b>{mine ? t('Vous') : b.staff.displayName}</b>
                </>
              ) : (
                <b>{relativeDayLabelDZ(toLocalDateKey(new Date(b.startsAt)))}</b>
              )}
              <span className="font-semibold" dir="ltr">
                {formatDA(b.priceDa)}
              </span>
            </div>
            {/* Rendez-vous pris par un tiers : le salon doit savoir qui appeler. */}
            {!!b.bookedByName && (
              <p className="ag9-sn">
                {t('Réservé par')} {b.bookedByName}
              </p>
            )}
            {b.notes && <p className="ag9-sn">« {b.notes} »</p>}
            {b.cancellationReason && <p className="ag9-sn">{b.cancellationReason}</p>}

            <ErrorMessage error={setStatus.error ?? cancel.error} />

            {/* Une action principale selon l'état, les autres en dessous. */}
            {!cancelling && (
              <div className="flex flex-col gap-2">
                {confirmable && (
                  <Button
                    className="ag9-a"
                    loading={setStatus.isPending}
                    onClick={() => void act(setStatus.mutateAsync({ id: b.id, status: 'confirmed' }))}
                  >
                    {t('Accepter')}
                  </Button>
                )}
                {confirmable && team > 1 && (
                  <Button variant="soft" onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}>
                    {t('Confier à une autre personne')}
                  </Button>
                )}
                {confirmable && (
                  <Button variant="d" onClick={() => setCancelling(true)}>
                    {t('Refuser')}
                  </Button>
                )}
                {closable && (
                  <>
                    <Button
                      className="ag9-b"
                      disabled={setStatus.isPending}
                      onClick={() => void act(setStatus.mutateAsync({ id: b.id, status: 'completed' }))}
                    >
                      <I icon={CheckCircle2} size={18} /> {t('Terminé')}
                    </Button>
                    <Button
                      variant="d"
                      disabled={setStatus.isPending}
                      onClick={() => void act(setStatus.mutateAsync({ id: b.id, status: 'no_show' }))}
                    >
                      <I icon={UserX} size={18} /> {t('Absent')}
                    </Button>
                  </>
                )}
                {late && (
                  <Button
                    variant="d"
                    disabled={cancel.isPending}
                    onClick={() => void act(cancel.mutateAsync({ id: b.id, reason: 'Retard', late: true }))}
                  >
                    <I icon={AlarmClock} size={18} /> {t('Annuler pour retard (plus de')}{' '}
                    {LATE_TOLERANCE_MINUTES} {t('min)')}
                  </Button>
                )}
                {b.status === 'confirmed' && !past && (
                  <>
                    {reminder && (
                      <a href={reminder} target="_blank" rel="noreferrer" className="btn ag9-b">
                        {t('Rappel WhatsApp')}
                      </a>
                    )}
                    <Button variant="soft" onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}>
                      {t('Reporter')}
                    </Button>
                    <Button variant="d" onClick={() => setCancelling(true)}>
                      {t('Annuler le rendez-vous')}
                    </Button>
                  </>
                )}
                {b.status === 'completed' && (
                  <Button className="ag9-b" onClick={rebook}>{t('Reprendre rendez-vous dans 3 semaines')}</Button>
                )}
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
                  <Button
                    variant="d"
                    disabled={cancel.isPending}
                    onClick={() =>
                      void act(cancel.mutateAsync({ id: b.id, reason: reason || undefined }))
                    }
                  >
                    {b.status === 'pending' ? t('Refuser') : t('Annuler le rendez-vous')}
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
