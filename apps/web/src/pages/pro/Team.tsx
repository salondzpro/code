import { useEffect, useState, type FormEvent } from 'react';
import { useProSalon, useProStaffMutations, useStaffHours } from '@salondz/api-client';
import { DAY_LABELS_FR, WEEK_DAYS, type DayOfWeek } from '@salondz/constants';
import type { OpeningHour, Staff } from '@salondz/types';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';

interface Row {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
}

/** Lignes par défaut = horaires d'ouverture du salon. */
function rowsFromSalon(salonHours: OpeningHour[]): Row[] {
  return WEEK_DAYS.map((d) => {
    const h = salonHours.find((x) => x.dayOfWeek === d && !x.isClosed);
    return { dayOfWeek: d, enabled: !!h, startsAt: h?.opensAt ?? '09:00', endsAt: h?.closesAt ?? '19:00' };
  });
}

/**
 * Horaires propres d'un membre. Liste vide côté API = « suit les horaires du salon ».
 * Les créneaux réservables sont l'intersection salon ∩ membre (calculée en SQL).
 */
function StaffHoursEditor({ member, salonHours, onClose }: { member: Staff; salonHours: OpeningHour[]; onClose: () => void }) {
  const hours = useStaffHours(member.id);
  const { setHours } = useProStaffMutations();
  const [custom, setCustom] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => rowsFromSalon(salonHours));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!hours.data) return;
    if (hours.data.length === 0) {
      setCustom(false);
      setRows(rowsFromSalon(salonHours));
      return;
    }
    setCustom(true);
    const base = rowsFromSalon(salonHours);
    setRows(
      WEEK_DAYS.map((d) => {
        const h = hours.data.find((x) => x.dayOfWeek === d);
        const def = base.find((r) => r.dayOfWeek === d)!;
        return h ? { dayOfWeek: d, enabled: true, startsAt: h.startsAt, endsAt: h.endsAt } : { ...def, enabled: false };
      }),
    );
  }, [hours.data, salonHours]);

  if (hours.isPending) return <Spinner inline />;
  if (hours.isError) return <ErrorMessage error={hours.error} retry={() => hours.refetch()} />;

  const patch = (d: DayOfWeek, p: Partial<Row>) => setRows((prev) => prev.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  const invalid = custom && rows.some((r) => r.enabled && r.startsAt >= r.endsAt);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    await setHours.mutateAsync({
      id: member.id,
      hours: custom ? rows.filter((r) => r.enabled).map(({ dayOfWeek, startsAt, endsAt }) => ({ dayOfWeek, startsAt, endsAt })) : [],
    });
    setSaved(true);
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3 border-t border-line pt-3" aria-label={`Horaires de ${member.displayName}`}>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={!custom ? 'chip-active' : 'chip'} onClick={() => setCustom(false)}>
          Suit les horaires du salon
        </button>
        <button type="button" className={custom ? 'chip-active' : 'chip'} onClick={() => setCustom(true)}>
          Horaires personnalisés
        </button>
      </div>
      {custom && (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.dayOfWeek} className="border-b border-line last:border-0">
                <th scope="row" className="py-1 pr-2 text-left font-medium">
                  {DAY_LABELS_FR[r.dayOfWeek]}
                </th>
                <td className="py-1 pr-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={r.enabled} onChange={(e) => patch(r.dayOfWeek, { enabled: e.target.checked })} />
                    {r.enabled ? 'Travaille' : 'Repos'}
                  </label>
                </td>
                <td className="py-1 pr-2">
                  <input type="time" className="input" value={r.startsAt} disabled={!r.enabled} onChange={(e) => patch(r.dayOfWeek, { startsAt: e.target.value })} aria-label="Début" />
                </td>
                <td className="py-1">
                  <input type="time" className="input" value={r.endsAt} disabled={!r.enabled} onChange={(e) => patch(r.dayOfWeek, { endsAt: e.target.value })} aria-label="Fin" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {invalid && <p className="text-sm text-danger">L'heure de début doit précéder la fin.</p>}
      <ErrorMessage error={setHours.error} />
      {saved && <p className="text-sm text-success">Horaires du membre enregistrés.</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary px-3 py-1 text-sm" disabled={setHours.isPending || invalid}>
          Enregistrer
        </button>
        <button type="button" className="btn-ghost px-3 py-1 text-sm" onClick={onClose}>
          Fermer
        </button>
      </div>
    </form>
  );
}

export function Team() {
  const { data } = useProSalon();
  const salon = data?.salon ?? null;
  const { create, update, remove } = useProStaffMutations();
  const [name, setName] = useState('');
  const [editingHours, setEditingHours] = useState<string | null>(null);

  if (!salon) return <Spinner />;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 1) return;
    await create.mutateAsync({ displayName: name.trim() });
    setName('');
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Équipe</h1>
      <p className="text-sm text-muted">Chaque membre a son propre agenda. Les clients peuvent choisir « n'importe qui » ou un membre précis.</p>
      <form onSubmit={add} className="card flex items-end gap-2 p-4">
        <Field label="Nouveau membre" required>
          {(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Prénom" />}
        </Field>
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          Ajouter
        </button>
      </form>
      <ErrorMessage error={create.error ?? update.error ?? remove.error} />
      <ul className="flex flex-col gap-2">
        {salon.staff.map((m) => (
          <li key={m.id} className={`card p-4 ${m.isActive ? '' : 'opacity-60'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {m.displayName} {m.userId === salon.ownerId && <span className="text-xs text-muted">(vous)</span>}
                </p>
                {!m.isActive && <p className="text-xs text-muted">Inactif</p>}
              </div>
              <div className="flex gap-1">
                <button type="button" className="btn-ghost px-2 py-1 text-xs" aria-expanded={editingHours === m.id} onClick={() => setEditingHours((v) => (v === m.id ? null : m.id))}>
                  Horaires
                </button>
                <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => update.mutate({ id: m.id, isActive: !m.isActive })}>
                  {m.isActive ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  type="button"
                  className="btn-danger px-2 py-1 text-xs"
                  onClick={() => {
                    if (window.confirm(`Retirer ${m.displayName} de l'équipe ?`)) remove.mutate(m.id);
                  }}
                >
                  Retirer
                </button>
              </div>
            </div>
            {editingHours === m.id && <StaffHoursEditor member={m} salonHours={salon.openingHours} onClose={() => setEditingHours(null)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
