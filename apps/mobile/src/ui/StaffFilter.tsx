/** Filtre par employé (accueil et agenda pro) : « Toute l'équipe » ou un membre, en puces défilantes. */
import React from 'react';
import type { Staff } from '@salondz/types';
import { Avatar, Pill, Tx } from './index';
import { PillRow } from './Pills';
import { C } from '@/theme/design';

export function StaffFilter({ staff, value, onChange }: { staff: Staff[]; value: string | null; onChange: (id: string | null) => void }) {
  const members = staff.filter((m) => m.isActive);
  if (members.length < 2) return null;
  const current = members.find((m) => m.id === value) ? value : null;
  return (
    <PillRow>
      <Pill lg on={current === null} onPress={() => onChange(null)}>
        Toute l'équipe
      </Pill>
      {members.map((m) => (
        <Pill key={m.id} lg on={current === m.id} onPress={() => onChange(current === m.id ? null : m.id)} style={{ paddingLeft: 5 }}>
          <Avatar src={m.avatarUrl} name={m.displayName} size={18} />
          <Tx size={10.5} weight={500} lh={14} color={current === m.id ? C.onInk : C.text}>
            {m.displayName}
          </Tx>
        </Pill>
      ))}
    </PillRow>
  );
}
