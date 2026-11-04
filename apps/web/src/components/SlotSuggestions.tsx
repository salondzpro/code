/**
 * Créneau déjà pris : au lieu d'un simple refus, on propose les solutions les plus proches, à toucher
 * directement. La même heure avec une autre personne, puis juste après, puis juste avant ; si la
 * journée est pleine, le prochain jour libre.
 *
 * Les créneaux viennent de l'API (`get_available_slots`), jamais d'un calcul ici : horaires, pauses,
 * fermetures et durée des prestations y sont déjà pris en compte. Le composant n'est monté que quand
 * le créneau est pris : aucune requête sinon.
 */
import { useAvailability } from '@salondz/api-client';
import { formatTimeDZ, relativeDayLabelDZ, timeToMinutes } from '@salondz/constants';
import { Skeleton } from './ui';
import { t } from '@/i18n';

export interface SlotChoice {
  date: string;
  time: string;
  staffId: string;
}

interface Suggestion extends SlotChoice {
  hint: string;
}

/** Trois propositions : au-delà, on ne choisit plus, on relit une liste. */
const MAX_SUGGESTIONS = 3;

export function SlotSuggestions({
  salonId,
  serviceIds,
  date,
  time,
  staffId,
  team,
  onPick,
}: {
  salonId: string;
  serviceIds: string[];
  date: string;
  time: string;
  staffId: string;
  /** Membres actifs ; à partir de deux, on propose aussi la même heure avec quelqu'un d'autre. */
  team: { id: string; name: string }[];
  onPick: (choice: SlotChoice) => void;
}) {
  const ids = serviceIds.join(',');
  const mine = useAvailability(salonId, { serviceIds: ids, date, staffId });
  const all = useAvailability(salonId, { serviceIds: ids, date });
  const wanted = timeToMinutes(time);
  const list: Suggestion[] = [];

  const sameTime = (all.data?.slots ?? []).find((s) => formatTimeDZ(s.startsAt) === time);
  const other = team.find((m) => m.id !== staffId && sameTime?.staffIds.includes(m.id));
  if (other) list.push({ date, time, staffId: other.id, hint: t('avec {name}', { name: other.name }) });

  const times = (mine.data?.slots ?? []).map((s) => formatTimeDZ(s.startsAt));
  const after = times.filter((x) => timeToMinutes(x) > wanted);
  const before = times.filter((x) => timeToMinutes(x) < wanted).reverse();
  if (after[0]) list.push({ date, time: after[0], staffId, hint: t('Plus tard') });
  if (before[0]) list.push({ date, time: before[0], staffId, hint: t('Plus tôt') });
  for (const x of [...after.slice(1), ...before.slice(1)])
    list.push({ date, time: x, staffId, hint: timeToMinutes(x) > wanted ? t('Plus tard') : t('Plus tôt') });

  const next = mine.data?.nextAvailable;
  if (!times.length && next)
    for (const x of next.slots.slice(0, MAX_SUGGESTIONS))
      list.push({ date: next.date, time: x.slice(0, 5), staffId, hint: relativeDayLabelDZ(next.date) });

  const shown = list.slice(0, MAX_SUGGESTIONS);
  const loading = mine.isPending || all.isPending;

  return (
    <div className="sg" role="status">
      <span className="sg-t">{t('Déjà pris à {h}', { h: time })}</span>
      {loading ? (
        <Skeleton className="h-[3.5rem] w-full" />
      ) : shown.length ? (
        <div className="sg-r">
          {shown.map((s) => (
            <button key={`${s.date}-${s.time}-${s.staffId}`} type="button" className="sg-b" onClick={() => onPick(s)}>
              <b dir="ltr">{s.time}</b>
              <span>{s.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <span className="sg-n">{t('Aucun autre créneau pour le moment.')}</span>
      )}
    </div>
  );
}
