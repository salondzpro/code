/**
 * C-F 15 — Détail du rendez-vous côté pro : client (appeler, WhatsApp), lignes, note, historique,
 * Confirmer / Reporter / Annuler ; Terminé / Absent après l'heure. Report : nouvelle date, heure, membre.
 */
import { ICONE } from '@/lib/actionIcons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  useMarkBookingSeen,
  useProBooking,
  useProBookingMutations,
  useProBookings,
  useProSalon,
  ApiError,
} from '@salondz/api-client';
import { Pencil } from 'lucide-react';
import {
  addDaysToKey,
  formatDA,
  formatDateLongDZ,
  formatDateShortDZ,
  formatDZPhone,
  formatTimeDZ,
  LATE_TOLERANCE_MINUTES,
  isLate,
  lateRule,
  localDateTimeToISO,
  relativeDayLabelDZ,
  toLocalDateKey,
  ceilToStep,
  nowTimeDZ,
  SALON_CANCEL_REASONS_FR,
  reasonOptions,
} from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import {
  AlarmClock,
  ArrowLeft,
  Banknote,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  History,
  MessageCircle,
  Phone,
  Scissors,
  StickyNote,
  UserRound,
  UserX,
  XCircle,
} from 'lucide-react';
import { Avatar, BottomSheet, Button, I, Input, Skeleton, StatusBadge, TopBar, Dim } from '@/components/ui';
import { PickerField } from '@/components/Picker';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FactRow } from '@/components/BookingFacts';
import { ClientContact } from '@/components/ClientContact';
import { ActionRond } from '@/components/ActionRond';
import { originLabel } from '@/lib/pageView';
import { PageLoading } from '@/components/PageLoading';
import { SlotSuggestions } from '@/components/SlotSuggestions';
import { t } from '@/i18n';

export function ProBookingDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const booking = useProBooking(id);
  /**
   * OUVRIR une fiche, c'est l'avoir vue : le compteur de l'agenda baisse d'autant. Une seule fois
   * par rendez-vous — la référence empêche de relancer l'appel à chaque rendu.
   */
  const marquerVu = useMarkBookingSeen();
  const dejaMarque = useRef<string | null>(null);
  useEffect(() => {
    if (!id || dejaMarque.current === id) return;
    dejaMarque.current = id;
    marquerVu.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const salon = useProSalon().data?.salon ?? null;
  const { setStatus, cancel } = useProBookingMutations();
  const b = booking.data;
  const today = toLocalDateKey();
  const history = useProBookings(
    { from: addDaysToKey(today, -365), to: addDaysToKey(today, 90), limit: 200 },
    !!b,
  );
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const visits = useMemo(
    () =>
      (history.data?.items ?? []).filter(
        (x) =>
          b &&
          x.status !== 'cancelled' &&
          (x.clientPhone && b.clientPhone
            ? x.clientPhone === b.clientPhone
            : x.clientName === b.clientName),
      ),
    [history.data, b],
  );
  const lastVisit = visits
    .filter((x) => x.startsAt < (b?.startsAt ?? ''))
    .sort((a, c) => c.startsAt.localeCompare(a.startsAt))[0];

  if (booking.isPending || !salon) return <PageLoading />;
  if (booking.isError)
    return <ErrorMessage error={booking.error} retry={() => booking.refetch()} />;
  if (!b) return null;
  const active = b.status === 'pending' || b.status === 'confirmed';
  const past = new Date(b.startsAt).getTime() < Date.now();
  const late = active && isLate(b.startsAt);
  const rule = lateRule(b.startsAt);
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
  const initials = b.clientName
    .split(' ')
    .map((p, i) => (i === 0 ? p : `${p.charAt(0)}.`))
    .join(' ');

  const dayKey = toLocalDateKey(new Date(b.startsAt));
  const dayLabel = relativeDayLabelDZ(dayKey);
  // « Demain · sam. 14 nov. » : le jour relatif, puis la date courte — jamais l'année de l'année en cours.
  const quand = /^\p{L}+\. \d/u.test(dayLabel) ? dayLabel : `${dayLabel} · ${formatDateShortDZ(b.startsAt)}`;
  const team = (salon.staff ?? []).filter((m) => m.isActive).length > 1;
  const confirmable = b.status === 'pending' && !past;
  const closable = b.status === 'confirmed' && past;
  const aActions = confirmable || closable || late || (active && !past);

  return (
    <Screen bottom={aActions ? SHEET_PAD : undefined} gap={12}>
      <TopBar backTo="/pro/agenda" title={t('Rendez-vous')} />
      {/* L'ESSENTIEL DU MOMENT (13 nov. 2026, charte `docs/CHARTE.md`) : qui, comment la joindre
          (ronds WhatsApp au logo officiel, SMS, appel — les mêmes que l'agenda), son état, puis
          quand en grand. Le détail suit en lignes, sans rien répéter. */}
      <div className="crd !gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={b.clientName} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="h1 truncate !text-[1.286rem]">{initials}</h1>
            {b.clientPhone && (
              <p className="mono text-[0.857rem] text-muted" dir="ltr">{formatDZPhone(b.clientPhone)}</p>
            )}
          </div>
          <ClientContact booking={b} salon={salon} remind={b.status === 'confirmed' && !past} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <b className="block text-[1.143rem] font-semibold" dir="auto">{quand}</b>
            <span className="mono block text-[1rem] text-muted" dir="ltr">
              {formatTimeDZ(b.startsAt)} – {formatTimeDZ(b.endsAt)}
            </span>
          </span>
          <StatusBadge status={b.status} md cancelledBy={b.cancelledBy} kind={b.cancellationKind} viewer="pro" />
        </div>
      </div>

      {/* Quoi, avec qui, combien : une ligne par fait, sans répéter l'heure ni la durée. */}
      <div className="crd !gap-0 !py-1">
        {lines.map((it) => (
          <FactRow
            key={it.id}
            icon={Scissors}
            title={it.serviceName}
            sub={'durationMinutes' in it && it.durationMinutes ? formatDuration(it.durationMinutes) : undefined}
            // Une seule prestation : son prix est le total, dit une ligne plus bas.
            right={
              lines.length > 1 && 'priceDa' in it && it.priceDa != null ? (
                <span className="text-[1rem] font-semibold">{formatDA(it.priceDa)}</span>
              ) : undefined
            }
          />
        ))}
        {b.staff && team && <FactRow icon={UserRound} title={`${t('Avec')} ${b.staff.displayName}`} />}
        <FactRow
          icon={Banknote}
          title={formatDA(b.priceDa)}
          sub={`${t('Sur place')} · ${t('arrivée {a}, retard toléré jusqu’à {b}', { a: rule.arriveAt, b: rule.lateUntil })}`}
        />
        {(originLabel(b.origin) || b.bookedByName) && (
          <FactRow
            icon={CalendarDays}
            title={b.bookedByName ? `${t('Réservé par')} ${b.bookedByName}` : originLabel(b.origin)!}
            sub={b.bookedByName ? (originLabel(b.origin) ?? undefined) : undefined}
          />
        )}
        {b.notes && (
          <FactRow
            icon={StickyNote}
            title={`Note ${salon.genderTarget === 'men' ? 'du client' : 'de la cliente'}`}
            sub={`« ${b.notes} »`}
          />
        )}
        {b.cancellationReason && (
          <FactRow icon={XCircle} tone="danger" title={t("Motif")} sub={b.cancellationReason} />
        )}
        <FactRow
          icon={History}
          title={`${visits.length} rendez-vous chez vous`}
          sub={lastVisit ? `Dernière visite le ${formatDateShortDZ(lastVisit.startsAt)}` : 'Première visite'}
        />
      </div>
      <ErrorMessage error={setStatus.error ?? cancel.error} />

      {/* Les gestes en ronds (les mêmes que la fenêtre de l'agenda) : vert = oui, rouge = non, blanc
          = le reste. Rien quand il n'y a rien à faire : le retour est la flèche en haut. */}
      {aActions && (
        <BottomSheet grab={false}>
          <div className="ag-acts">
            {confirmable && (
              <ActionRond ton="oui" icon={ICONE.accepter} label={t('Accepter')} busy={setStatus.isPending} onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })} />
            )}
            {confirmable && <ActionRond ton="non" icon={ICONE.refuser} label={t('Refuser')} onClick={() => setCancelling(true)} />}
            {closable && (
              <>
                <ActionRond ton="oui" icon={ICONE.terminer} label={t('Terminé')} busy={setStatus.isPending} onClick={() => setStatus.mutate({ id: b.id, status: 'completed' })} />
                <ActionRond ton="non" icon={ICONE.absent} label={t('Absent')} busy={setStatus.isPending} onClick={() => setStatus.mutate({ id: b.id, status: 'no_show' })} />
              </>
            )}
            {late && (
              <ActionRond
                ton="non"
                icon={ICONE.annulerRetard}
                label={t('Retard')}
                title={`${t('Annuler pour retard (plus de')} ${LATE_TOLERANCE_MINUTES} ${t('min)')}`}
                busy={cancel.isPending}
                onClick={() => cancel.mutate({ id: b.id, late: true })}
              />
            )}
            {active && !past && <ActionRond ton="orange" icon={ICONE.reporter} label={t('Reporter')} onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)} />}
            {b.status === 'confirmed' && !past && <ActionRond ton="non" icon={ICONE.annulerRdv} label={t('Annuler')} onClick={() => setCancelling(true)} />}
          </div>
        </BottomSheet>
      )}

      {cancelling && (
        <>
          <Dim onClose={() => setCancelling(false)} />
          <BottomSheet modal className="!z-50">
            <div className="text-center">
              <div className="text-[1.429rem] font-semibold tracking-[-0.4px]">
                {b.status === 'pending' ? t('Refuser cette demande ?') : t('Annuler ce rendez-vous ?')}
              </div>
              <p className="p mt-2">
                {t("Le client sera prévenu sur WhatsApp et le créneau sera libéré.")}
              </p>
            </div>
            <div className="crd !flex-row items-center justify-between !py-3">
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
            <Button icon={ICONE.annulerRdv}
              className="!bg-danger !text-white"
              disabled={cancel.isPending}
              onClick={async () => {
                try {
                  await cancel.mutateAsync({ id: b.id, reason: reason || undefined });
                  setCancelling(false);
                } catch {
                  /* affichée ci-dessous, DANS la feuille (celle de la page est sous le voile) */
                }
              }}
            >
              {t("Annuler le rendez-vous")}
            </Button>
            <ErrorMessage error={cancel.error} />
            <Button icon={ICONE.garder} variant="g" onClick={() => setCancelling(false)}>
              {t("Garder le rendez-vous")}
            </Button>
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}

/** Report par le pro : date, heure, membre (pas de délai minimum). */
export function ProBookingReschedule() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const booking = useProBooking(id);
  const salon = useProSalon().data?.salon ?? null;
  const { reschedule } = useProBookingMutations();
  const b = booking.data;
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const d = date ?? (b ? toLocalDateKey(new Date(b.startsAt)) : toLocalDateKey());
  const dayBookings = useProBookings({ from: d, to: d, limit: 200 }, !!b);
  if (booking.isError) return <ErrorMessage error={booking.error} retry={() => booking.refetch()} />;
  if (!b || !salon) return <PageLoading />;
  const tm = time ?? formatTimeDZ(b.startsAt);
  const staff = salon.staff.filter((s) => s.isActive);
  const sid = staffId ?? b.staffId;
  // Le nouveau créneau recouvre-t-il un autre rendez-vous de ce membre ? Affichage seulement : le
  // serveur reste seul juge, et son refus déclenche les mêmes propositions.
  const startMs = new Date(localDateTimeToISO(d, tm)).getTime();
  const endMs = startMs + b.durationMinutes * 60_000;
  const overlaps = (dayBookings.data?.items ?? []).some(
    (x) =>
      x.id !== b.id &&
      (x.status === 'pending' || x.status === 'confirmed') &&
      x.staffId === sid &&
      new Date(x.startsAt).getTime() < endMs &&
      new Date(x.endsAt).getTime() > startMs,
  );
  const refused = reschedule.error instanceof ApiError && reschedule.error.code === 'SLOT_TAKEN';
  const busy = overlaps || refused;
  const serviceIds = (b.items?.length ? b.items.map((x) => x.serviceId) : [b.serviceId]).filter((x): x is string => !!x);

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo={`/pro/rendez-vous/${b.id}`} title={t("Nouveau créneau")} />
      <div className="sf text-[0.857rem] text-muted">
        {t("Actuel ·")}{' '}{formatDateShortDZ(b.startsAt)}, {formatTimeDZ(b.startsAt)} · {b.clientName} ·{' '}
        {b.serviceName}
      </div>
      {/* Chaque ligne se modifie d'un toucher (crayon), et les choix rapides sont dessous :
          jours proches, heures LIBRES du membre, et à qui confier à cette heure (13 nov. 2026). */}
      <div className="crd !gap-0 !py-1">
        <label className="li rp-ligne">
          <span className="text-[1rem] font-semibold">{t("Date")}</span>
          <span className="rp-val">
            <input
              type="date"
              className="bg-transparent text-end text-[1rem] outline-none"
              value={d}
              min={toLocalDateKey()}
              onChange={(e) => {
                reschedule.reset();
                setDate(e.target.value);
              }}
              aria-label={t("Nouvelle date")}
            />
            <I icon={Pencil} size={16} className="rp-crayon" />
          </span>
        </label>
        <label className="li rp-ligne">
          <span className="text-[1rem] font-semibold">{t("Heure")}</span>
          <span className="rp-val">
            <input
              type="time"
              step={300}
              min={d === toLocalDateKey() ? ceilToStep(nowTimeDZ(), 5) : undefined}
              className="bg-transparent text-end text-[1rem] outline-none"
              value={tm}
              onChange={(e) => {
                reschedule.reset();
                setTime(e.target.value);
              }}
              aria-label={t("Nouvelle heure")}
            />
            <I icon={Pencil} size={16} className="rp-crayon" />
          </span>
        </label>
        {staff.length > 1 && (
          <label className="li rp-ligne">
            <span className="text-[1rem] font-semibold">{t("Membre")}</span>
            <span className="rp-val">
              <PickerField
                inline
                className="!max-w-none whitespace-nowrap"
                label={t("Membre")}
                value={sid}
                onChange={(v) => {
                  reschedule.reset();
                  setStaffId(v);
                }}
                options={staff.map((m) => ({ value: m.id, label: m.displayName }))}
              />
              <I icon={Pencil} size={16} className="rp-crayon" />
            </span>
          </label>
        )}
      </div>

      {/* Un message SEULEMENT s'il y a un problème (13 nov. 2026, demande du propriétaire) : rien quand
          le créneau est libre ; sinon le motif en rouge, puis les propositions les plus proches. */}
      {sid && busy && (
        <p className="rp-etat non" role="alert">
          <I icon={XCircle} size={18} />
          {t('{name} a déjà un rendez-vous à {h}', { name: staff.find((m) => m.id === sid)?.displayName ?? t('Ce membre'), h: tm })}
        </p>
      )}

      {busy && sid && serviceIds.length > 0 && (
        <SlotSuggestions
          salonId={salon.id}
          serviceIds={serviceIds}
          date={d}
          time={tm}
          staffId={sid}
          team={staff.map((m) => ({ id: m.id, name: m.displayName }))}
          onPick={(c) => {
            reschedule.reset();
            setDate(c.date);
            setTime(c.time);
            setStaffId(c.staffId);
          }}
        />
      )}
      {!refused && <ErrorMessage error={reschedule.error} />}
      <BottomSheet>
        <Button icon={ICONE.validerReport}
          disabled={reschedule.isPending || busy}
          onClick={async () => {
            try {
              await reschedule.mutateAsync({
                id: b.id,
                startsAt: localDateTimeToISO(d, tm),
                staffId: sid,
              });
              navigate(`/pro/rendez-vous/${b.id}`, { replace: true });
            } catch {
              /* affichée sous le formulaire, avec les propositions si le créneau est pris */
            }
          }}
        >
          {t("Valider le report")}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
