/**
 * Sélecteur de l'application (remplace les listes déroulantes natives du système, différentes d'un téléphone à
 * l'autre) : un champ qui affiche le choix courant, et une feuille basse au design avec la liste (sections,
 * indication, coche). Même modèle que « Trier par » et les sélecteurs d'heure.
 */
import { Fragment, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { BottomSheet, Button, I } from './ui';

export interface PickerOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  /** Titre de section (les options consécutives de même section sont regroupées). */
  group?: string;
  icon?: ReactNode;
}

export function PickerSheet<T extends string | number>({
  open,
  onClose,
  title,
  options,
  value,
  onChange,
  action,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  /** Bouton distinct sous la liste (ex. « Créer une catégorie »). */ action?: {
    label: string;
    onClick: () => void;
  };
}) {
  if (!open) return null;
  let lastGroup: string | undefined;
  return (
    <>
      <div className="dim" onClick={onClose} />
      <BottomSheet className="max-h-[85vh] !z-50 overflow-y-auto">
        <div className="h2 text-center !text-[1.125rem]">{title}</div>
        <div className="crd !gap-0 !py-1" role="radiogroup" aria-label={title}>
          {options.map((o) => {
            const header = o.group !== lastGroup ? o.group : undefined;
            lastGroup = o.group;
            const on = o.value === value;
            return (
              <Fragment key={String(o.value)}>
                {header && <div className="h3 border-b border-line-soft pb-2 pt-3">{header}</div>}
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className="li w-full text-left !border-b !border-line-soft last:!border-b-0"
                  onClick={() => {
                    onChange(o.value);
                    onClose();
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {o.icon}
                    <span className="min-w-0">
                      {/* Le choix se lit d'abord : en gras, l'explication en gris dessous. */}
                      <span className="block text-[1rem] font-semibold">{o.label}</span>
                      {o.hint && <span className="p block">{o.hint}</span>}
                    </span>
                  </span>
                  {on && <I icon={Check} size={20} />}
                </button>
              </Fragment>
            );
          })}
        </div>
        {action && (
          <Button
            variant="g"
            onClick={() => {
              action.onClick();
              onClose();
            }}
          >
            <I icon={Plus} size={18} /> {action.label}
          </Button>
        )}
      </BottomSheet>
    </>
  );
}

/** Champ de sélection : `inline` = texte à droite d'une ligne de liste, sinon un champ pleine largeur. */
export function PickerField<T extends string | number>({
  label,
  title,
  options,
  value,
  onChange,
  placeholder = 'Choisir',
  inline,
  className = '',
  action,
  display,
}: {
  label: string;
  title?: string;
  options: PickerOption<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  placeholder?: string;
  inline?: boolean;
  className?: string;
  action?: { label: string; onClick: () => void };
  /** Texte affiché dans le champ quand la valeur n'est pas dans la liste (ex. catégorie en cours de création). */ display?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={
          inline
            ? `flex max-w-[60%] items-center gap-1 text-right text-[0.9375rem] ${current ? '' : 'text-subtle'} ${className}`
            : `inp lg flex items-center justify-between gap-3 text-left ${current ? '' : 'text-subtle'} ${className}`
        }
      >
        <span className="truncate">{current?.label ?? display ?? placeholder}</span>
        <I icon={ChevronDown} size={inline ? 16 : 18} className="flex-none text-subtle" />
      </button>
      <PickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title ?? label}
        options={options}
        value={value}
        onChange={onChange}
        action={action}
      />
    </>
  );
}
