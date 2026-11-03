/**
 * Filtre par membre de l'équipe (accueil pro) : « Toute l'équipe » ou un membre, avec sa PHOTO et
 * son nombre de rendez-vous du jour, en puces compactes qui défilent. Le choix est en noir plein :
 * on le reconnaît sans chercher. N'existe qu'à partir de deux personnes actives.
 */
import { Users } from 'lucide-react';
import type { Staff } from '@salondz/types';
import { Avatar, I } from './ui';
import { t } from '@/i18n';

export function StaffFilter({
  staff,
  value,
  onChange,
  counts,
  meStaffId,
}: {
  staff: Staff[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Rendez-vous du jour par membre (`staffId` → nombre), affichés à côté du nom. */
  counts?: Record<string, number>;
  /** Le membre qui correspond au compte connecté : « Vous » plutôt que son prénom. */
  meStaffId?: string | null;
}) {
  const members = staff.filter((m) => m.isActive);
  if (members.length < 2) return null;
  const current = members.find((m) => m.id === value) ? value : null;
  return (
    <div className="stf pills bleed" role="group" aria-label={t('Filtrer par membre de l’équipe')}>
      <button type="button" className={`stf-c${current === null ? ' on' : ''}`} aria-pressed={current === null} onClick={() => onChange(null)}>
        <span className="stf-a" aria-hidden>
          <I icon={Users} size={14} strokeWidth={2} />
        </span>
        {t('Toute l’équipe')}
      </button>
      {members.map((m) => {
        const on = current === m.id;
        const name = m.id === meStaffId ? t('Vous') : m.displayName;
        return (
          <button
            key={m.id}
            type="button"
            className={`stf-c${on ? ' on' : ''}`}
            aria-pressed={on}
            aria-label={counts ? `${name} · ${t('{n} rendez-vous', { n: counts[m.id] ?? 0 })}` : name}
            onClick={() => onChange(on ? null : m.id)}
          >
            <Avatar src={m.avatarUrl} name={m.displayName} size={34} />
            {name}
            {counts && <span className="stf-n">{counts[m.id] ?? 0}</span>}
          </button>
        );
      })}
    </div>
  );
}
