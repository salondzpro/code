import { useEffect, useState, type FormEvent } from 'react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { DAY_LABELS_FR, DEFAULT_OPENING_HOURS, WEEK_DAYS, type DayOfWeek } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';

interface Row {
  dayOfWeek: DayOfWeek;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

function rowsFrom(salon: SalonOwnerView): Row[] {
  return WEEK_DAYS.map((d) => {
    const h = salon.openingHours.find((x) => x.dayOfWeek === d && !x.isClosed) ?? salon.openingHours.find((x) => x.dayOfWeek === d);
    const def = DEFAULT_OPENING_HOURS[d]!;
    return { dayOfWeek: d, opensAt: h?.opensAt ?? def.opensAt, closesAt: h?.closesAt ?? def.closesAt, isClosed: h ? h.isClosed : def.isClosed };
  });
}

export function Hours() {
  const { data } = useProSalon();
  const salon = data?.salon ?? null;
  const { setHours } = useProSalonMutations();
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (salon) setRows(rowsFrom(salon));
  }, [salon]);

  if (!salon || rows.length === 0) return <Spinner />;

  const patch = (d: DayOfWeek, p: Partial<Row>) => setRows((prev) => prev.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  const copyToAll = (src: Row) => setRows((prev) => prev.map((r) => ({ ...r, opensAt: src.opensAt, closesAt: src.closesAt })));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    await setHours.mutateAsync({ hours: rows });
    setSaved(true);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Horaires d'ouverture</h1>
      <p className="text-sm text-muted">La semaine commence le dimanche. Les créneaux réservables en ligne sont générés à partir de ces horaires.</p>
      <table className="card w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.dayOfWeek} className="border-b border-line last:border-0">
              <th scope="row" className="px-4 py-2 text-left font-medium">
                {DAY_LABELS_FR[r.dayOfWeek]}
              </th>
              <td className="px-2 py-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!r.isClosed} onChange={(e) => patch(r.dayOfWeek, { isClosed: !e.target.checked })} />
                  {r.isClosed ? 'Fermé' : 'Ouvert'}
                </label>
              </td>
              <td className="px-2 py-2">
                <input type="time" className="input" value={r.opensAt} disabled={r.isClosed} onChange={(e) => patch(r.dayOfWeek, { opensAt: e.target.value })} aria-label="Ouverture" />
              </td>
              <td className="px-2 py-2">
                <input type="time" className="input" value={r.closesAt} disabled={r.isClosed} onChange={(e) => patch(r.dayOfWeek, { closesAt: e.target.value })} aria-label="Fermeture" />
              </td>
              <td className="px-2 py-2">
                <button type="button" className="text-xs text-muted underline" onClick={() => copyToAll(r)}>
                  Appliquer à tous
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.some((r) => !r.isClosed && r.opensAt >= r.closesAt) && <p className="text-sm text-danger">L'heure d'ouverture doit précéder la fermeture.</p>}
      <ErrorMessage error={setHours.error} />
      {saved && <p className="text-sm text-success">Horaires enregistrés.</p>}
      <button type="submit" className="btn-primary self-start" disabled={setHours.isPending || rows.some((r) => !r.isClosed && r.opensAt >= r.closesAt)}>
        Enregistrer
      </button>
    </form>
  );
}
