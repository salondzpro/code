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
  formatDateShortDZ,
  formatDZPhone,
  formatTimeDZ,
  LATE_TOLERANCE_MINUTES,
  isLate,
  lateRule,
  localDateTimeToISO,
  relativeDayLabelDZ,
  toLocalDateKey,
} from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import {
  AlarmClock,
  CalendarClock,
  Check,
  CheckCircle2,
  MessageCircle,
  Phone,
  UserX,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { Avatar, BottomSheet, Button, I, Input, StatusBadge, TopBar } from '@/components/ui';
import { PickerField } from '@/components/Picker';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';

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

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo="/pro/agenda" />
      <div className="flex items-center gap-4">
        <Avatar name={b.clientName} size={128} />
        <div className="min-w-0">
          <h1 className="h1 !text-[1.625rem]">{initials}</h1>
          {b.clientPhone && (
            <p className="mt-1 text-[0.8125rem] text-muted">{formatDZPhone(b.clientPhone)}</p>
          )}
          {b.staff && <p className="text-[0.9375rem] text-muted">avec {b.staff.displayName}</p>}
        </div>
      </div>
      {b.clientPhone && (
        <div className="g2">
          <a href={`tel:${b.clientPhone}`} className="btn g !py-[1.125rem] !text-[1.125rem]">
            <I icon={Phone} size={20} /> Appeler
          </a>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="btn g !py-[1.125rem] !text-[1.125rem]"
            >
              <I icon={MessageCircle} size={20} /> WhatsApp
            </a>
          )}
        </div>
      )}
      {/* L'essentiel en grand : quand, à quelle heure, combien — ce que le pro regarde dix fois par jour. */}
      <div className="crd !gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.9375rem] font-semibold">
            {relativeDayLabelDZ(toLocalDateKey(new Date(b.startsAt)))}
            <span className="ml-2 text-[0.875rem] font-normal text-muted">
              {formatDateShortDZ(b.startsAt).replace(/^\w/, (c) => c.toUpperCase())}
            </span>
          </span>
          <StatusBadge
            status={b.status}
            lg
            cancelledBy={b.cancelledBy}
            kind={b.cancellationKind}
            viewer="pro"
          />
        </div>
        <div className="flex items-end justify-between gap-3">
          <span className="mono text-[1.75rem] font-bold leading-none tracking-[-0.8px]">
            {formatTimeDZ(b.startsAt)}{' '}
            <span className="text-[1rem] font-medium text-muted">– {formatTimeDZ(b.endsAt)}</span>
          </span>
          <span className="text-[1.5rem] font-bold leading-none tracking-[-0.6px]">
            {formatDA(b.priceDa)}
          </span>
        </div>
        <span className="text-[0.8125rem] text-muted">
          {formatDuration(b.durationMinutes)} au total · arrivée à {rule.arriveAt} · retard toléré
          jusqu'à {rule.lateUntil}
        </span>
      </div>
      <div className="crd !gap-0">
        <div className="li !py-3">
          <span className="text-[0.9375rem] font-semibold">
            {lines.length} prestation{lines.length > 1 ? 's' : ''}
          </span>
          <span className="text-[0.875rem] text-muted">{formatDA(b.priceDa)}</span>
        </div>
        {lines.map((it) => (
          <div key={it.id} className="li !py-3 text-[0.9375rem]">
            <span>{it.serviceName}</span>
            <span className="text-muted">
              {'durationMinutes' in it && it.durationMinutes
                ? `${formatDuration(it.durationMinutes)}${'priceDa' in it && it.priceDa != null ? ` · ${formatDA(it.priceDa)}` : ''}`
                : ''}
            </span>
          </div>
        ))}
      </div>
      {b.notes && (
        <div className="sf">
          <span className="s block">
            Note {salon.genderTarget === 'men' ? 'du client' : 'de la cliente'}
          </span>
          <span className="block text-[0.9375rem]">« {b.notes} »</span>
        </div>
      )}
      {b.cancellationReason && (
        <p className="text-[0.9375rem] text-danger">Motif : {b.cancellationReason}</p>
      )}
      <p className="text-[0.8125rem] text-muted">
        {visits.length} rendez-vous
        {lastVisit ? ` · dernière visite le ${formatDateShortDZ(lastVisit.startsAt)}` : ''}
      </p>
      <ErrorMessage error={setStatus.error ?? cancel.error} />

      <BottomSheet grab={false}>
        {b.status === 'pending' && !past && (
          <Button
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}
          >
            <I icon={Check} size={18} /> Confirmer le rendez-vous
          </Button>
        )}
        {b.status === 'confirmed' && past && (
          <div className="g2">
            <Button
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: b.id, status: 'completed' })}
            >
              <I icon={CheckCircle2} size={18} /> Terminé
            </Button>
            <Button
              variant="g"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: b.id, status: 'no_show' })}
            >
              <I icon={UserX} size={18} /> Client absent
            </Button>
          </div>
        )}
        {late && (
          <Button
            variant="d"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({ id: b.id, late: true })}
          >
            <I icon={AlarmClock} size={18} /> Annuler pour retard (plus de {LATE_TOLERANCE_MINUTES}{' '}
            min)
          </Button>
        )}
        {active && !past && (
          <div className="g2">
            <Button variant="g" onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}>
              <I icon={CalendarClock} size={18} /> Reporter
            </Button>
            <Button variant="d" onClick={() => setCancelling(true)}>
              <I icon={XCircle} size={18} /> Annuler
            </Button>
          </div>
        )}
        {(!active || (past && b.status === 'pending')) && (
          <Button variant="g" onClick={() => navigate('/pro/agenda')}>
            <I icon={ArrowLeft} size={18} /> Retour à l'agenda
          </Button>
        )}
      </BottomSheet>

      {cancelling && (
        <>
          <div className="dim" onClick={() => setCancelling(false)} />
          <BottomSheet className="!z-50">
            <div className="text-center">
              <div className="text-[1.25rem] font-bold tracking-[-0.4px]">
                Annuler ce rendez-vous ?
              </div>
              <p className="p mt-2">
                Le client sera prévenu sur WhatsApp et le créneau sera libéré.
              </p>
            </div>
            <div className="crd !flex-row items-center justify-between !py-3">
              <span className="text-[0.9375rem]">Motif (optionnel)</span>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Indisponible"
                className="!w-auto !bg-transparent !p-0 text-right"
                maxLength={200}
                aria-label="Motif"
              />
            </div>
            <Button
              className="!bg-danger !text-white"
              disabled={cancel.isPending}
              onClick={async () => {
                await cancel.mutateAsync({ id: b.id, reason: reason.trim() || undefined });
                setCancelling(false);
              }}
            >
              Annuler le rendez-vous
            </Button>
            <Button variant="g" onClick={() => setCancelling(false)}>
              Garder le rendez-vous
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
  const t = time ?? formatTimeDZ(b.startsAt);
  const staff = salon.staff.filter((s) => s.isActive);
  const sid = staffId ?? b.staffId;

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo={`/pro/rendez-vous/${b.id}`} right="Reporter" />
      <h1 className="h1">Nouveau créneau</h1>
      <div className="sf text-[0.8125rem] text-muted">
        Actuel · {formatDateShortDZ(b.startsAt)}, {formatTimeDZ(b.startsAt)} · {b.clientName} ·{' '}
        {b.serviceName}
      </div>
      <div className="crd !gap-0 !py-1">
        <label className="li !py-4">
          <span className="text-[0.9375rem]">Date</span>
          <input
            type="date"
            className="bg-transparent text-right text-[0.9375rem] outline-none"
            value={d}
            min={toLocalDateKey()}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Nouvelle date"
          />
        </label>
        <label className="li !py-4">
          <span className="text-[0.9375rem]">Heure</span>
          <input
            type="time"
            step={300}
            className="bg-transparent text-right text-[0.9375rem] outline-none"
            value={t}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Nouvelle heure"
          />
        </label>
        {staff.length > 1 && (
          <label className="li !py-4">
            <span className="text-[0.9375rem]">Membre</span>
            <PickerField
              inline
              label="Membre"
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
              startsAt: localDateTimeToISO(d, t),
              staffId: sid,
            });
            navigate(`/pro/rendez-vous/${b.id}`, { replace: true });
          }}
        >
          Valider le report
        </Button>
      </BottomSheet>
    </Screen>
  );
}
