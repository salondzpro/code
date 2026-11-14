/**
 * FILTRE PAR MEMBRE DE L'AGENDA (15 nov. 2026, demande du propriétaire) : une LISTE DÉROULANTE, comme
 * un menu iOS. Le bouton dit qui est affiché (« Toute l'équipe » par défaut, ou le membre choisi, avec
 * sa photo) ; il ouvre la liste : Toute l'équipe, puis chaque membre avec son nombre de rendez-vous du
 * jour, une coche sur le choix en cours. Toucher dehors ou Échap referme. Rien sans équipe (< 2 actifs).
 */
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Users } from 'lucide-react';
import type { Staff } from '@salondz/types';
import { Avatar, I } from '@/components/ui';
import { t } from '@/i18n';

export function StaffFilter({
  staff,
  value,
  onChange,
  counts,
  nameOf = (m) => m.displayName,
}: {
  staff: Staff[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Rendez-vous par membre (clé = id, `all` = toute l'équipe), affichés dans la liste. */
  counts?: Record<string, number>;
  /** Nom affiché d'un membre (« Vous » pour soi, comme en tête des colonnes). */
  nameOf?: (m: Staff) => string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const members = staff.filter((m) => m.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  if (members.length < 2) return null;
  const current = members.find((m) => m.id === value) ?? null;
  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };
  const n = (k: string) => (counts && counts[k] != null ? <span className="stf-n">{counts[k]}</span> : null);

  return (
    <div className="stf" ref={box}>
      <button type="button" className={`stf-b${open ? ' on' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        {current ? (
          <Avatar src={current.avatarUrl} name={current.displayName} size={24} />
        ) : (
          <span className="stf-ic" aria-hidden>
            <I icon={Users} size={15} />
          </span>
        )}
        <b>{current ? nameOf(current) : t("Toute l'équipe")}</b>
        <I icon={ChevronDown} size={16} className="stf-chev" />
      </button>
      {open && (
        <ul className="stf-l" role="listbox" aria-label={t('Filtrer par membre')}>
          <li>
            <button type="button" role="option" aria-selected={!current} onClick={() => pick(null)}>
              <span className="stf-ic" aria-hidden>
                <I icon={Users} size={15} />
              </span>
              <b>{t("Toute l'équipe")}</b>
              {n('all')}
              {!current && <I icon={Check} size={17} className="stf-ok" />}
            </button>
          </li>
          {members.map((m) => (
            <li key={m.id}>
              <button type="button" role="option" aria-selected={current?.id === m.id} onClick={() => pick(m.id)}>
                <Avatar src={m.avatarUrl} name={m.displayName} size={28} />
                <b>{nameOf(m)}</b>
                {n(m.id)}
                {current?.id === m.id && <I icon={Check} size={17} className="stf-ok" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
