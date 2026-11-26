/**
 * Détail d'un rendez-vous côté client (structure de C-F 15) : salon, contact, puis l'essentiel en grand
 * (Aujourd'hui / Demain / date, heure, prix) et la liste des prestations — même lecture que la fiche pro.
 * Reporter / Annuler. C-F 17 — feuille « Annuler ce rendez-vous ? » (avec la règle anti-abus) ; C-F 18 — annulation confirmée.
 */
import { WhatsAppLogo } from '@/components/BrandIcons';
import { ICONE } from '@/lib/actionIcons';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import {
  Phone,
  StickyNote,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useBooking, useCancelBooking, useMarkNotificationsRead, useMe } from '@salondz/api-client';
import {
  CANCEL_ABUSE_BLOCK_DAYS,
  CANCEL_ABUSE_MAX,
  CLIENT_CANCEL_MIN_HOURS,
  MAX_CLIENT_RESCHEDULES,
  rescheduleMinHours,
  formatDA,
  formatDateLongDZ,
  formatDZPhone,
  formatTimeDZ,
  CLIENT_CANCEL_REASONS_FR,
  reasonOptions,
} from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import {
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
import { BookingSummary } from '@/components/BookingSummary';
import { DepositCard } from '@/components/DepositCard';
import { depositPayNote } from '@/lib/deposit';
import { FactRow } from '@/components/BookingFacts';
import { PageLoading } from '@/components/PageLoading';
import { directionsUrl } from './Bookings';
import { cibleCarte } from '@/lib/maps';
import { t } from '@/i18n';

export function BookingDetail() {
  const { id = '' } = useParams();
  const booking = useBooking(id);
  const cancel = useCancelBooking();
  const me = useMe();
  const [cancelling, setCancelling] = useState(false);
  const [plus, setPlus] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  /**
   * OUVRIR la fiche d'un rendez-vous, c'est avoir lu ce qu'on en disait : ses notifications
   * (confirmation, déplacement, rappel) passent lues et la pastille baisse d'autant. Une fois par
   * rendez-vous, et seulement celles-là — ce qui concerne un autre rendez-vous reste non lu.
   */
  const marquerLu = useMarkNotificationsRead();
  const dejaMarque = useRef<string | null>(null);
  useEffect(() => {
    if (!id || dejaMarque.current === id) return;
    dejaMarque.current = id;
    marquerLu.mutate({ bookingId: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (booking.isPending) return <PageLoading />;
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
  // Report : règles de la migration 0059 (jusqu'à 3 h avant au moins, un seul report).
  const reportMinHours = rescheduleMinHours(b.salon.cancelMinHours);
  const tropTardReport = (new Date(b.startsAt).getTime() - Date.now()) / 3_600_000 < reportMinHours;
  const canReschedule = active && !tropTardReport && b.salon.allowClientReschedule !== false && !rescheduled;
  const wa =
    b.salon.phone
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
    // ANNULATION CONFIRMÉE — design actuel (22 nov. 2026, audit) : une pastille sobre, une phrase, UNE
    // carte (salon, jour et heure barrés, prestations), puis réserver à nouveau ou revenir à la liste.
    return (
      <Screen gap={16}>
        <div className="pl-cf">
          <span className="pl-cf-i" aria-hidden>
            <I icon={XCircle} size={28} strokeWidth={1.8} />
          </span>
          <h1 className="pl-cf-t">{t('Rendez-vous annulé')}</h1>
          <p className="pl-cf-p">{t('{salon} a été prévenu.', { salon: b.salon.name })}</p>
        </div>
        <div className="pl-card pl-bk-sel">
          <div className="pl-bk-sv">
            <div className="min-w-0">
              <span className="pl-bk-svn">{b.salon.name}</span>
              <span className="pl-bk-svm line-through">
                {formatDateLongDZ(b.startsAt).replace(/^\w/, (c) => c.toUpperCase())} · {formatTimeDZ(b.startsAt)}
              </span>
            </div>
            <StatusBadge status="cancelled" cancelledBy="client" />
          </div>
          {lines.map((it) => (
            <div key={it.id} className="pl-bk-sv">
              <div className="min-w-0">
                <span className="pl-bk-svn">{it.serviceName}</span>
                <span className="pl-bk-svm" dir="ltr">
                  {it.durationMinutes ? `${formatDuration(it.durationMinutes)} · ` : ''}
                  {formatDA(it.priceDa)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <LinkButton to={`/s/${b.salon.slug}`} icon={ICONE.reserver}>
          {t('Réserver un autre créneau')}
        </LinkButton>
        <LinkButton to="/rendez-vous" variant="g" icon={ICONE.retour}>
          {t('Mes rendez-vous')}
        </LinkButton>
      </Screen>
    );
  }

  return (
    <Screen className="h-app" gap={12}>
      <TopBar backTo="/rendez-vous" title={t('Rendez-vous')} />
      {/* Une seule carte : le salon en tête avec l'état, puis quand, quoi, combien (`BookingSummary`). */}
      <BookingSummary
        salon={{ name: b.salon.name, logoUrl: b.salon.logoUrl, coverUrl: b.salon.coverUrl }}
        status={b.status}
        cancelledBy={b.cancelledBy}
        cancellationKind={b.cancellationKind}
        startsAt={b.startsAt}
        lines={
          b.items?.length
            ? b.items.map((it) => ({ id: it.id, name: it.serviceName, minutes: it.durationMinutes, priceDa: it.priceDa }))
            : [{ id: b.id, name: b.serviceName, minutes: b.durationMinutes, priceDa: b.priceDa }]
        }
        priceDa={b.priceDa}
        payNote={depositPayNote(b)}
        muted={!active}
        extra={
          <>
            {/* Pris pour quelqu'un d'autre, ou par quelqu'un d'autre : sans cette ligne, on ne
                sait pas de quel rendez-vous il s'agit ni pourquoi il est là. */}
            {forSomeoneElse && (
              <FactRow icon={UserRound} title={t('Pour {name}', { name: b.clientName ?? '' })} />
            )}
            {!forSomeoneElse && !!b.bookedByName && (
              <FactRow icon={UserRound} title={`Réservé par ${b.bookedByName}`} />
            )}
            {b.notes && <FactRow icon={StickyNote} title={t("Votre note")} sub={`« ${b.notes} »`} />}
            {b.cancellationReason && (
              <FactRow icon={XCircle} tone="danger" title={t("Motif")} sub={b.cancellationReason} />
            )}
          </>
        }
      />
      {/* Validation manuelle : le créneau est bloqué pour les autres tant que le salon n'a pas répondu, et
          la demande expire d'elle-même (le client est prévenu, le créneau libéré). */}
      {/* Versement demandé par le salon : la carte du virement prend la place de l'avis d'attente. */}
      {/* Versement VALIDÉ : le résumé le dit déjà (« Versement de … reçu ») — pas de seconde carte. */}
      {b.depositStatus !== 'accepted' && <DepositCard booking={b} />}
      {/* DEUX BOUTONS, LE RESTE DANS « ⋯ » (16 nov. 2026, demande du propriétaire). Ce dont la
          cliente a besoin AVANT d'y aller : s'y rendre, et éventuellement déplacer. Après : noter,
          ou reprendre rendez-vous. Annuler, voir le salon, joindre le salon : derrière « ⋯ ».
          Plus de bouton « Calendrier ». */}
      {(() => {
        const visibles = [
          active && (
            <a key="it" href={directionsUrl(b)} target={cibleCarte(directionsUrl(b))} rel="noreferrer" className="btn sm flex-1">
              <I icon={ICONE.itineraire} size={18} /> {t('Itinéraire')}
            </a>
          ),
          canReschedule && (
            <LinkButton key="rep" to={`/rendez-vous/${b.id}/reporter`} variant="g" sm icon={ICONE.reporter} className="flex-1">
              {t('Reporter')}
            </LinkButton>
          ),
          b.status === 'completed' && b.reviewRating == null && (
            <LinkButton key="note" to={`/rendez-vous/${b.id}/noter`} sm icon={ICONE.avis} className="flex-1">
              {t('Noter')}
            </LinkButton>
          ),
          !active && (
            <LinkButton key="re" to={`/s/${b.salon.slug}/prestations`} variant="g" sm icon={ICONE.reserver} className="flex-1">
              {t('Reprendre rendez-vous')}
            </LinkButton>
          ),
        ].filter(Boolean).slice(0, 2);
        return (
          <div className="flex gap-2.5">
            {visibles}
            {/* Le salon a choisi de montrer son numéro (26 nov. 2026) : l'appeler d'un toucher. */}
            {active && b.salon.phone && (
              <a href={`tel:${b.salon.phone}`} className="btn g sm !w-[3.25rem] flex-none !px-0" aria-label={t('Appeler le salon')}>
                <I icon={Phone} size={20} />
              </a>
            )}
            <button
              type="button"
              className="btn g sm !w-[3.25rem] flex-none !px-0"
              aria-label={t('Plus d’actions')}
              onClick={() => setPlus(true)}
            >
              <I icon={ICONE.autresActions} size={20} />
            </button>
          </div>
        );
      })()}
      {b.status === 'completed' && b.reviewRating != null && (
        <p className="p text-center">{t('Vous avez noté ce rendez-vous {n}/5.', { n: b.reviewRating })}</p>
      )}

      {plus && (
        <>
          <Dim onClose={() => setPlus(false)} />
          <BottomSheet modal>
            <LinkButton to={`/s/${b.salon.slug}`} variant="g" icon={ICONE.voirSalon}>
              {t('Voir le salon')}
            </LinkButton>
            {!active && b.salon.phone && (
              <a href={`tel:${b.salon.phone}`} className="btn g">
                <I icon={Phone} size={18} /> {t('Appeler le salon')}
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="btn g">
                <WhatsAppLogo size={18} /> {t('WhatsApp')}
              </a>
            )}
            {canModify && (
              <Button
                variant="d"
                icon={ICONE.annulerRdv}
                onClick={() => {
                  setPlus(false);
                  setCancelling(true);
                }}
              >
                {t('Annuler le rendez-vous')}
              </Button>
            )}
            {active && !canModify && (
              <p className="p text-center">{t('Report et annulation possibles en ligne jusqu’à {n} h avant.', { n: minHours })}</p>
            )}
            {canModify && rescheduled && b.salon.allowClientReschedule !== false && (
              <p className="p text-center">{t('Déjà reporté une fois.')}</p>
            )}
            {canModify && !rescheduled && tropTardReport && b.salon.allowClientReschedule !== false && (
              <p className="p text-center">{t('Report en ligne possible jusqu’à {n} h avant.', { n: reportMinHours })}</p>
            )}
          </BottomSheet>
        </>
      )}

      {cancelling && (
        <>
          <Dim onClose={() => setCancelling(false)} />
          <BottomSheet modal>
            <div className="text-center text-[1.429rem] font-semibold tracking-[-0.4px]">{t("Annuler ce rendez-vous ?")}</div>
            {/* Seule phrase gardée : celle qui a une CONSÉQUENCE — la suspension toute proche. */}
            {cancels >= CANCEL_ABUSE_MAX - 1 && (
              <InfoBox>
                {t('Encore une annulation et la réservation en ligne est suspendue {n} jours.', { n: CANCEL_ABUSE_BLOCK_DAYS })}
              </InfoBox>
            )}
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
            <Button icon={ICONE.annulerRdv}
              className="!bg-danger !text-white"
              disabled={cancel.isPending}
              onClick={async () => {
                await cancel.mutateAsync({ id: b.id, reason: reason || undefined });
                setCancelling(false);
                setDone(true);
              }}
            >
              {cancel.isPending ? t('Annulation…') : t('Annuler le rendez-vous')}
            </Button>
            <Button icon={ICONE.garder} variant="g" onClick={() => setCancelling(false)}>
              {t("Garder le rendez-vous")}
            </Button>
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}
