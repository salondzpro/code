/** Filtre par employé (accueil et agenda pro) : « Toute l'équipe » ou un membre, en puces défilantes. */
import type { Staff } from '@salondz/types';
import { Avatar, Pill } from './ui';

export function StaffFilter({ staff, value, onChange }: { staff: Staff[]; value: string | null; onChange: (id: string | null) => void }) {
  const members = staff.filter((m) => m.isActive);
  if (members.length < 2) return null;
  const current = members.find((m) => m.id === value) ? value : null;
  return (
    <div className="pills -mx-5 px-5" role="group" aria-label="Filtrer par membre">
      <Pill lg on={current === null} onClick={() => onChange(null)}>
        Toute l'équipe
      </Pill>
      {members.map((m) => (
        <Pill key={m.id} lg on={current === m.id} onClick={() => onChange(current === m.id ? null : m.id)} className="!gap-2 !pl-1.5">
          <Avatar src={m.avatarUrl} name={m.displayName} size={22} /> {m.displayName}
        </Pill>
      ))}
    </div>
  );
}
