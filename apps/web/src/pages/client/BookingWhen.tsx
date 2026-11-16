/**
 * QUAND ? — refonte du 15 nov. 2026 (demande du propriétaire : « réserver vite, compact, premium »).
 *
 * - « Le plus tôt » en tête : le premier créneau libre (aujourd'hui, sinon le prochain jour), avec
 *   n'importe quel membre — un toucher et l'on passe à la confirmation.
 * - Avec qui : « N'importe qui » par défaut (le plus rapide), ou un membre (équipe ≥ 2 seulement).
 * - Jours puis heures libres ; TOUCHER UNE HEURE = continuer (plus de bouton « Continuer »).
 * Les créneaux viennent toujours de `GET /salons/:id/availability` (jamais calculés au front).
 */
import { ICONE } from '@/lib/actionIcons';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ChevronRight, Users, Zap } from 'lucide-react';
import { useAvailability, useSalon } from '@salondz/api-client';
import {
  addDaysToKey,
  dayOfWeekFromKey,
  formatDA,
  formatTimeDZ,
  localDateTimeToISO,
  relativeDayLabelDZ,
  timeToMinutes,
  toLocalDateKey,
} from '@salondz/constants';
import { readDraft, writeDraft } from '@/lib/bookingDraft';
import { setGuestMarket } from '@/lib/useClientMarket';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import { Avatar, Button, I, Skeleton, Slot, TopBar } from '@/components/ui';
import { DayStrip, MonthNav } from '@/components/DaySelector';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { PageLoading } from '@/components/PageLoading';
import { t } from '@/i18n';

type Period = 'Matin' | 'Après-midi' | 'Soir';
const periodOf = (hm: string): Period =>
  timeToMinutes(hm) < 12 * 60 ? 'Matin' : timeToMinutes(hm) < 17 * 60 ? 'Après-midi' : 'Soir';

export function BookingWhen() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const salon = useSalon(slug);
  const draft = readDraft(slug);
  const today = toLocalDateKey();
  const [date, setDate] = useState(draft.date ?? today);
  const [weekOf, setWeekOf] = useState(draft.date ?? today);
  const [staffId, setStaffId] = useState<string | null>(draft.staffId ?? null);
  const serviceIds = draft.serviceIds;
  const s = salon.data;
  const q = { serviceIds: serviceIds.join(','), ...(staffId ? { staffId } : {}) };
  const availability = useAvailability(s?.id ?? '', { ...q, date });
  // « Le plus tôt » : toujours calculé depuis aujourd'hui, quel que soit le jour affiché.
  const soonest = useAvailability(s?.id ?? '', { ...q, date: today });

  // Liste d'attente (« M'alerter si un créneau se libère ») : comptes connectés seulement.
  const { session } = useAuth();
  const [alertId, setAlertId] = useState<string | null>(null);
  const [alertBusy, setAlertBusy] = useState(false);
  useEffect(() => {
    if (!session || !s?.id) return setAlertId(null);
    let alive = true;
    api.me
      .slotAlerts(s.id)
      .then((r) => alive && setAlertId(r.items.find((a) => a.day === date)?.id ?? null))
      .catch(() => alive && setAlertId(null));
    return () => {
      alive = false;
    };
  }, [session, s?.id, date]);
  const toggleAlert = async () => {
    if (!s) return;
    if (!session) return navigate(`/acces?next=${encodeURIComponent(`/s/${s.slug}/reserver/quand`)}`);
    setAlertBusy(true);
    try {
      if (alertId) {
        await api.me.removeSlotAlert(alertId);
        setAlertId(null);
      } else setAlertId((await api.me.addSlotAlert({ salonId: s.id, day: date, serviceId: serviceIds[0] })).id);
    } catch {
      /* l'état reste tel quel */
    } finally {
      setAlertBusy(false);
    }
  };

  const chosen = useMemo(
    () => (s ? serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean) : []),
    [s, serviceIds],
  );
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);

  const free = useMemo(
    () => (availability.data?.slots ?? []).map((x) => ({ time: formatTimeDZ(x.startsAt), iso: x.startsAt })).filter((g) => new Date(g.iso).getTime() > Date.now()),
    [availability.data],
  );
  const first = useMemo(() => {
    const d = soonest.data;
    if (!d) return null;
    const now = d.slots.find((x) => new Date(x.startsAt).getTime() > Date.now());
    if (now) return { date: today, time: formatTimeDZ(now.startsAt), iso: now.startsAt };
    if (d.nextAvailable?.slots[0]) return { date: d.nextAvailable.date, time: d.nextAvailable.slots[0], iso: localDateTimeToISO(d.nextAvailable.date, d.nextAvailable.slots[0]) };
    return null;
  }, [soonest.data, today]);

  if (serviceIds.length === 0) return <Navigate to={`/s/${slug}/prestations`} replace />;
  if (salon.isPending) return <PageLoading />;
  if (salon.isError || !s) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;

  const team = s.staff ?? [];
  const maxDate = addDaysToKey(today, s.bookingHorizonDays);
  const closedDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.openingHours.some((h) => h.dayOfWeek === d && !h.isClosed));
  const groups = new Map<Period, typeof free>();
  for (const g of free) groups.set(periodOf(g.time), [...(groups.get(periodOf(g.time)) ?? []), g]);
  const next = availability.data?.nextAvailable ?? null;

  /** Un créneau choisi = on passe tout de suite à la confirmation. */
  const go = (d: string, iso: string, who: string | null) => {
    writeDraft(slug, { date: d, startsAt: iso, staffId: who });
    if (!session && (s.genderTarget === 'men' || s.genderTarget === 'women')) setGuestMarket(s.genderTarget);
    navigate(`/s/${s.slug}/reserver/recap`);
  };

  return (
    <Screen gap={14}>
      <TopBar backTo={`/s/${s.slug}`} title={t('Quand ?')} />
      <div className="bw-svc">
        <b className="truncate">{chosen.map((x) => x!.name).join(' + ')}</b>
        <span dir="ltr">
          {formatDuration(minutes)} · {formatDA(price)}
        </span>
      </div>

      {/* Le plus rapide : premier créneau libre, n'importe quel membre (ou celui choisi). */}
      {soonest.isPending ? (
        <Skeleton className="h-[4.5rem] w-full !rounded-[var(--radius-card)]" />
      ) : first ? (
        <button type="button" className="bw-fast" onClick={() => go(first.date, first.iso, staffId)}>
          <span className="bw-fast-ic" aria-hidden>
            <Zap size={22} fill="currentColor" strokeWidth={1.6} />
          </span>
          <span className="min-w-0 flex-1">
            <small>{t('Le plus tôt')}</small>
            <b>
              {relativeDayLabelDZ(first.date)} · <span dir="ltr">{first.time}</span>
            </b>
          </span>
          <I icon={ChevronRight} size={20} className="flex-none rtl:rotate-180" />
        </button>
      ) : null}

      {team.length >= 2 && (
        <div className="pills bleed" role="radiogroup" aria-label={t('Avec qui')}>
          <button type="button" role="radio" aria-checked={!staffId} className={`bw-who${!staffId ? ' on' : ''}`} onClick={() => setStaffId(null)}>
            <span className="bw-who-ic" aria-hidden>
              <I icon={Users} size={15} />
            </span>
            {t('N’importe qui')}
          </button>
          {team.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={staffId === m.id} className={`bw-who${staffId === m.id ? ' on' : ''}`} onClick={() => setStaffId(m.id)}>
              <Avatar src={m.avatarUrl} name={m.displayName} size={26} />
              {m.displayName}
            </button>
          ))}
        </div>
      )}

      <MonthNav weekOf={weekOf} onWeekChange={setWeekOf} minDate={today} maxDate={maxDate} />
      <DayStrip weekOf={weekOf} selected={date} onSelect={setDate} minDate={today} maxDate={maxDate} disabledDays={closedDays} />

      {closedDays.includes(dayOfWeekFromKey(date)) ? (
        <p className="p">{t('Fermé ce jour.')}</p>
      ) : availability.isPending || availability.isFetching ? (
        <div className="g3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[3.5rem]" />
          ))}
        </div>
      ) : availability.isError ? (
        <ErrorMessage error={availability.error} retry={() => availability.refetch()} />
      ) : free.length === 0 ? (
        <div className="crd !gap-3" role="status">
          <b className="text-[1.071rem]">{t('Complet ce jour')}</b>
          {next && (
            <Button icon={ICONE.prochaineDispo} sm auto onClick={() => { setWeekOf(next.date); setDate(next.date); }}>
              {relativeDayLabelDZ(next.date)} · {next.slots[0]}
            </Button>
          )}
          {date >= today && (
            <Button icon={ICONE.alerter} variant="g" sm auto onClick={() => void toggleAlert()} disabled={alertBusy}>
              {alertId ? t('Alerte activée · retirer') : t("M'alerter si un créneau se libère")}
            </Button>
          )}
        </div>
      ) : (
        [...groups.entries()].map(([period, list]) => (
          <div key={period} className="flex flex-col gap-2.5">
            <span className="h3">{t(period)}</span>
            <div className="g3">
              {list.map((g) => (
                <Slot key={g.iso} on={draft.startsAt === g.iso} onClick={() => go(date, g.iso, staffId)} className="!py-[1.125rem] !text-[1rem]">
                  {g.time}
                </Slot>
              ))}
            </div>
          </div>
        ))
      )}
    </Screen>
  );
}
