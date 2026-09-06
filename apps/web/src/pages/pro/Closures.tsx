/**
 * PRO-F 14 — Fermetures et exceptions : blocages à venir (90 jours) et ajout d'une exception
 * (jours fermés ou horaires réduits, pour tout le salon ou un membre).
 * Un blocage retire des créneaux réservables ; les rendez-vous déjà confirmés ne sont pas annulés.
 */
import { useMemo, useState } from 'react';
import { useProBlockMutations, useProBlocks, useProSalon } from '@salondz/api-client';
import { DAY_LABELS_FR, DAY_LABELS_SHORT_FR, addDaysToKey, dayOfWeekFromKey, formatTimeDZ, localDateTimeToISO, toLocalDateKey, weekKeys } from '@salondz/constants';
import { createTimeBlockSchema } from '@salondz/validation';
import type { TimeBlock } from '@salondz/types';
import { errorText } from '@/components/ErrorMessage';
import { Badge, BottomSheet, Button, Pill, SectionLabel, Skeleton, TopBar } from '@/components/ui';
import { MonthNav, dayNumber } from '@/components/DaySelector';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

const HORIZON_DAYS = 90;
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' });
const localKey = (iso: string) => keyFmt.format(new Date(iso));
const dayNum = (k: string) => Number(k.slice(8, 10));
const monthOf = (k: string) => MONTHS[Number(k.slice(5, 7)) - 1]!;

/** Un blocage « journée(s) entière(s) » commence et finit à minuit (heure d'Alger). */
function isAllDay(b: TimeBlock): boolean {
  return formatTimeDZ(b.startsAt) === '00:00' && formatTimeDZ(b.endsAt) === '00:00';
}

/** « Jeudi 27 août », « 14 – 21 septembre » ou « 28 septembre – 3 octobre ». */
export function rangeLabel(from: string, to: string): string {
  if (from === to) return `${DAY_LABELS_FR[dayOfWeekFromKey(from)]} ${dayNum(from)} ${monthOf(from)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${dayNum(from)} – ${dayNum(to)} ${monthOf(from)}`;
  return `${dayNum(from)} ${monthOf(from)} – ${dayNum(to)} ${monthOf(to)}`;
}

/** Jours couverts par un blocage (dernier jour inclus). */
function blockDays(b: TimeBlock): { from: string; to: string } {
  const from = localKey(b.startsAt);
  const to = isAllDay(b) ? localKey(new Date(new Date(b.endsAt).getTime() - 60_000).toISOString()) : localKey(b.endsAt);
  return { from, to };
}

export function describeBlock(b: TimeBlock): string {
  const { from, to } = blockDays(b);
  return isAllDay(b) ? rangeLabel(from, to) : `${rangeLabel(from, from)} · ${formatTimeDZ(b.startsAt)} – ${formatTimeDZ(b.endsAt)}`;
}

type Range = { from: string; to: string } | null;

export function Closures() {
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const blocks = useProBlocks(today, addDaysToKey(today, HORIZON_DAYS));
  const { create, remove } = useProBlockMutations();

  const [weekOf, setWeekOf] = useState(today);
  const [range, setRange] = useState<Range>(null);
  const [mode, setMode] = useState<'closed' | 'reduced'>('closed');
  const [from, setFrom] = useState('12:00');
  const [to, setTo] = useState('14:00');
  const [staffId, setStaffId] = useState(''); // '' = tout le salon
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [del, setDel] = useState<TimeBlock | null>(null);

  const staffName = useMemo(() => new Map((salon?.staff ?? []).map((m) => [m.id, m.displayName])), [salon]);
  if (!salon) return <Splash />;
  const active = salon.staff.filter((m) => m.isActive);
  const items = blocks.data?.items ?? [];

  const pick = (d: string) => {
    if (!range || range.from !== range.to) return setRange({ from: d, to: d });
    if (d === range.from) return setRange(null);
    if (d > range.from) return setRange({ from: range.from, to: d });
    setRange({ from: d, to: d });
  };
  const nDays = range ? Math.round((new Date(`${range.to}T12:00:00Z`).getTime() - new Date(`${range.from}T12:00:00Z`).getTime()) / 86_400_000) + 1 : 0;
  const daysText = nDays <= 1 ? 'ce jour-là' : nDays === 2 ? 'sur ces deux jours' : `sur ces ${nDays} jours`;

  const submit = async () => {
    setError(null);
    if (!range) return setError('Choisissez un ou plusieurs jours.');
    if (mode === 'reduced' && from >= to) return setError("L'heure de début doit précéder la fin.");
    const base = { staffId: staffId || null, reason: reason.trim() || undefined };
    const inputs =
      mode === 'closed'
        ? [{ ...base, startsAt: localDateTimeToISO(range.from, '00:00'), endsAt: localDateTimeToISO(addDaysToKey(range.to, 1), '00:00') }]
        : Array.from({ length: nDays }, (_, i) => addDaysToKey(range.from, i)).map((d) => ({ ...base, startsAt: localDateTimeToISO(d, from), endsAt: localDateTimeToISO(d, to) }));
    try {
      for (const input of inputs) {
        const parsed = createTimeBlockSchema.safeParse(input);
        if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Plage invalide.');
        await create.mutateAsync(parsed.data);
      }
      setRange(null);
      setReason('');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={12}>
      <TopBar backTo="/pro/profil" right="Exceptions" />
      <h1 className="h1">Fermetures</h1>

      <div className="crd !gap-0 !px-4 !py-1">
        {blocks.isPending && <Skeleton className="my-3 h-[64px]" />}
        {blocks.data && items.length === 0 && <p className="p py-4 text-[17px]">Aucune fermeture prévue sur les {HORIZON_DAYS} prochains jours.</p>}
        {items.map((b) => {
          const allDay = isAllDay(b);
          const who = b.staffId ? (staffName.get(b.staffId) ?? 'Membre') : null;
          const title = who ? `${who} · ${b.reason ?? 'Indisponible'}` : (b.reason ?? 'Fermeture');
          return (
            <button key={b.id} type="button" className="li w-full !py-4 text-left" onClick={() => setDel(b)}>
              <span className="min-w-0">
                <span className="block truncate text-[19px]">{title}</span>
                <span className="mono block text-[15px] text-muted">{describeBlock(b)}</span>
              </span>
              <Badge tone={allDay ? 'cn' : 'pd'} md dot={false}>
                {allDay ? 'Fermé' : 'Modifié'}
              </Badge>
            </button>
          );
        })}
      </div>

      <SectionLabel>Ajouter une exception</SectionLabel>
      <div className="crd !gap-3">
        <MonthNav weekOf={weekOf} onWeekChange={setWeekOf} minDate={today} maxDate={addDaysToKey(today, HORIZON_DAYS)} />
        <div className="dsel" role="listbox" aria-label="Choisir les jours" aria-multiselectable>
          {weekKeys(weekOf).map((d) => {
            const out = d < today;
            const on = !!range && d >= range.from && d <= range.to;
            return (
              <button key={d} type="button" role="option" aria-selected={on} disabled={out} onClick={() => pick(d)} className={`dcel${on ? ' on' : ''}${out ? ' mut' : ''}`}>
                <span>{DAY_LABELS_SHORT_FR[dayOfWeekFromKey(d)]}</span>
                <b>{dayNumber(d)}</b>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Pill on={mode === 'closed'} className="flex-1 justify-center" onClick={() => setMode('closed')}>
            Fermé
          </Pill>
          <Pill on={mode === 'reduced'} className="flex-1 justify-center" onClick={() => setMode('reduced')}>
            Horaires réduits
          </Pill>
        </div>
        <div>
          {mode === 'reduced' && (
            <div className="li !py-3">
              <span className="text-[19px]">Fermé de</span>
              <span className="flex items-center gap-2 text-[19px] text-muted">
                <input type="time" step={300} className="tm" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
                <span>à</span>
                <input type="time" step={300} className="tm" value={to} onChange={(e) => setTo(e.target.value)} aria-label="À" />
              </span>
            </div>
          )}
          {active.length > 1 && (
            <label className="li !py-3">
              <span className="text-[19px]">Concerne</span>
              <select className="max-w-[55%] bg-transparent text-right text-[19px] text-muted outline-none" value={staffId} onChange={(e) => setStaffId(e.target.value)} aria-label="Concerne">
                <option value="">Tout le salon</option>
                {active.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="li !border-b-0 !py-3">
            <span className="text-[19px]">Motif</span>
            <input className="max-w-[55%] bg-transparent text-right text-[19px] outline-none placeholder:text-subtle" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Congés" maxLength={120} aria-label="Motif (facultatif)" />
          </label>
        </div>
        <p className="text-[15px] leading-[1.45] text-muted">
          {mode === 'closed' ? `Les clients ne verront aucun créneau ${daysText}.` : `Les clients ne pourront pas réserver entre ${from} et ${to} ${daysText}.`} Les rendez-vous déjà confirmés ne sont pas annulés automatiquement.
        </p>
      </div>
      {error && (
        <p className="text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}

      <BottomSheet>
        <Button onClick={() => void submit()} disabled={create.isPending}>
          {create.isPending ? 'Ajout…' : "Ajouter l'exception"}
        </Button>
      </BottomSheet>

      {del && (
        <>
          <div className="dim" onClick={() => setDel(null)} />
          <BottomSheet className="!z-50">
            <div className="text-center">
              <div className="text-[24px] font-bold tracking-[-0.4px]">Supprimer cette exception ?</div>
              <p className="p mt-2">{describeBlock(del)} — les créneaux redeviennent réservables.</p>
            </div>
            <Button
              className="!bg-danger !text-white"
              disabled={remove.isPending}
              onClick={async () => {
                try {
                  await remove.mutateAsync(del.id);
                  setDel(null);
                } catch (err) {
                  setError(errorText(err));
                  setDel(null);
                }
              }}
            >
              Supprimer
            </Button>
            <Button variant="g" onClick={() => setDel(null)}>
              Garder
            </Button>
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}
