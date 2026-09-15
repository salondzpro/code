/**
 * C-F 15 — Détail du rendez-vous côté pro : client (appeler, WhatsApp), lignes, note, historique,
 * Confirmer / Reporter / Annuler ; Terminé / Absent après l'heure. Report : nouvelle date, heure, membre.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  useProBooking,
  useProBookingMutations,
  useProBookings,
  useProSalon,
} from '@salondz/api-client';
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
import { Avatar, BottomSheet, Button, I, Input, StatusBadge, TopBar } from '@/components/ui';
import { PickerField } from '@/components/Picker';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FactRow } from '@/components/BookingFacts';
import { Splash } from '@/pages/auth/Splash';
import { t } from '@/i18n';

export function ProBookingDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const booking = useProBooking(id);
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

  if (booking.isPending || !salon) return <Splash />;
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
  const wa = b.clientPhone ? `https://wa.me/${b.clientPhone.replace(/\D/g, '')}` : null;
  const initials = b.clientName
    .split(' ')
    .map((p, i) => (i === 0 ? p : `${p.charAt(0)}.`))
    .join(' ');

  const dayKey = toLocalDateKey(new Date(b.startsAt));
  const dayLabel = relativeDayLabelDZ(dayKey);
  const dateLong = formatDateLongDZ(b.startsAt).replace(/^\w/, (c) => c.toUpperCase());

  return (
    <Screen bottom={SHEET_PAD} gap={12}>
      <TopBar backTo="/pro/agenda" />
      {/* Qui : le client d'abord, avec de quoi le joindre — c'est ce que le salon cherche
          en ouvrant la fiche (un retard, une question, une confirmation). */}
      <div className="crd !gap-3">
        <div className="flex items-center gap-3.5">
          <Avatar name={b.clientName} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="h1 !text-[1.429rem]">{initials}</h1>
            {b.clientPhone && (
              <p className="mono text-[0.857rem] text-muted">{formatDZPhone(b.clientPhone)}</p>
            )}
            {!!b.bookedByName && (
              <p className="text-[0.857rem] text-muted">{t("Réservé par")}{' '}{b.bookedByName}</p>
            )}
          </div>
          <StatusBadge
            status={b.status}
            md
            cancelledBy={b.cancelledBy}
            kind={b.cancellationKind}
            viewer="pro"
          />
        </div>
        {b.clientPhone && (
          <div className="g2">
            <a href={`tel:${b.clientPhone}`} className="btn g sm">
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

      {/* Quoi, quand, avec qui, combien : une ligne par fait, comme une fiche de caisse. */}
      <div className="crd !gap-0 !py-1">
        <FactRow
          icon={CalendarDays}
          title={/^\p{L}+\. \d/u.test(dayLabel) ? dateLong : `${dayLabel} · ${dateLong}`}
          sub={`${formatTimeDZ(b.startsAt)} – ${formatTimeDZ(b.endsAt)} · ${formatDuration(b.durationMinutes)}`}
          right={
            <span className="mono text-[1.429rem] font-semibold tracking-[-0.5px]">
              {formatTimeDZ(b.startsAt)}
            </span>
          }
        />
        {lines.map((it) => (
          <FactRow
            key={it.id}
            icon={Scissors}
            title={it.serviceName}
            sub={
              'durationMinutes' in it && it.durationMinutes
                ? formatDuration(it.durationMinutes)
                : undefined
            }
            // Une seule prestation : son prix est le total, dit une ligne plus bas.
            right={
              lines.length > 1 && 'priceDa' in it && it.priceDa != null ? (
                <span className="text-[1rem] font-semibold">{formatDA(it.priceDa)}</span>
              ) : undefined
            }
          />
        ))}
        {b.staff && <FactRow icon={UserRound} title={`Avec ${b.staff.displayName}`} />}
        <FactRow
          icon={Banknote}
          title={formatDA(b.priceDa)}
          sub={`Paiement sur place · arrivée à ${rule.arriveAt}, retard toléré jusqu'à ${rule.lateUntil}`}
        />
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

      <BottomSheet grab={false}>
        {b.status === 'pending' && !past && (
          <Button
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}
          >
            <I icon={Check} size={18} /> {t("Confirmer le rendez-vous")}
          </Button>
        )}
        {b.status === 'confirmed' && past && (
          <div className="g2">
            <Button
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: b.id, status: 'completed' })}
            >
              <I icon={CheckCircle2} size={18} /> {t("Terminé")}
            </Button>
            <Button
              variant="g"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: b.id, status: 'no_show' })}
            >
              <I icon={UserX} size={18} /> {t("Client absent")}
            </Button>
          </div>
        )}
        {late && (
          <Button
            variant="d"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({ id: b.id, late: true })}
          >
            <I icon={AlarmClock} size={18} /> {t("Annuler pour retard (plus de")}{' '}{LATE_TOLERANCE_MINUTES}{' '}
            {t("min)")}
          </Button>
        )}
        {active && !past && (
          <div className="g2">
            <Button variant="g" onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}>
              <I icon={CalendarClock} size={18} /> {t("Reporter")}
            </Button>
            <Button variant="d" onClick={() => setCancelling(true)}>
              <I icon={XCircle} size={18} /> {t("Annuler")}
            </Button>
          </div>
        )}
        {(!active || (past && b.status === 'pending')) && (
          <Button variant="g" onClick={() => navigate('/pro/agenda')}>
            <I icon={ArrowLeft} size={18} /> {t("Retour à l'agenda")}
          </Button>
        )}
      </BottomSheet>

      {cancelling && (
        <>
          <div className="dim" onClick={() => setCancelling(false)} />
          <BottomSheet className="!z-50">
            <div className="text-center">
              <div className="text-[1.429rem] font-bold tracking-[-0.4px]">
                {t("Annuler ce rendez-vous ?")}
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
            <Button
              className="!bg-danger !text-white"
              disabled={cancel.isPending}
              onClick={async () => {
                await cancel.mutateAsync({ id: b.id, reason: reason || undefined });
                setCancelling(false);
              }}
            >
              {t("Annuler le rendez-vous")}
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
  if (!b || !salon) return <Splash />;
  const d = date ?? toLocalDateKey(new Date(b.startsAt));
  const tm = time ?? formatTimeDZ(b.startsAt);
  const staff = salon.staff.filter((s) => s.isActive);
  const sid = staffId ?? b.staffId;

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo={`/pro/rendez-vous/${b.id}`} right="Reporter" />
      <h1 className="h1">{t("Nouveau créneau")}</h1>
      <div className="sf text-[0.857rem] text-muted">
        {t("Actuel ·")}{' '}{formatDateShortDZ(b.startsAt)}, {formatTimeDZ(b.startsAt)} · {b.clientName} ·{' '}
        {b.serviceName}
      </div>
      <div className="crd !gap-0 !py-1">
        <label className="li">
          <span className="text-[1rem] font-semibold">{t("Date")}</span>
          <input
            type="date"
            className="bg-transparent text-right text-[1rem] outline-none"
            value={d}
            min={toLocalDateKey()}
            onChange={(e) => setDate(e.target.value)}
            aria-label={t("Nouvelle date")}
          />
        </label>
        <label className="li">
          <span className="text-[1rem] font-semibold">{t("Heure")}</span>
          <input
            type="time"
            step={300}
            min={d === toLocalDateKey() ? ceilToStep(nowTimeDZ(), 5) : undefined}
            className="bg-transparent text-right text-[1rem] outline-none"
            value={tm}
            onChange={(e) => setTime(e.target.value)}
            aria-label={t("Nouvelle heure")}
          />
        </label>
        {staff.length > 1 && (
          <label className="li">
            <span className="text-[1rem] font-semibold">{t("Membre")}</span>
            <PickerField
              inline
              label={t("Membre")}
              value={sid}
              onChange={setStaffId}
              options={staff.map((m) => ({ value: m.id, label: m.displayName }))}
            />
          </label>
        )}
      </div>
      <ErrorMessage error={reschedule.error} />
      <BottomSheet>
        <Button
          disabled={reschedule.isPending}
          onClick={async () => {
            await reschedule.mutateAsync({
              id: b.id,
              startsAt: localDateTimeToISO(d, tm),
              staffId: sid,
            });
            navigate(`/pro/rendez-vous/${b.id}`, { replace: true });
          }}
        >
          {t("Valider le report")}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
