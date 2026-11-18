/**
 * RÉGLAGE D'UNE VALEUR dans une fenêtre du bas (18 nov. 2026, demande du propriétaire : « tout est
 * personnalisable ») : quelques choix rapides en pastilles, et « Autre » pour saisir sa propre valeur.
 * Sert la fidélité (seuil, cadeau, achat minimum, validité) et les promotions (réduction, durée).
 * Primitives de la charte uniquement : `BottomSheet` + `Dim`, `Pill`, `Input`, `Segmented`, `Button`.
 */
import { useState, type ReactNode } from 'react';
import { BottomSheet, Button, Dim, Input, Pill, Segmented } from './ui';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

export interface ValueChoice {
  value: number;
  label: string;
}

export function ValueSheet<U extends string = never>({
  title,
  value,
  choices,
  min,
  max,
  unitLabel,
  units,
  unit,
  onUnit,
  onClose,
  onDone,
  extra,
}: {
  title: string;
  value: number;
  choices: ValueChoice[];
  min: number;
  max: number;
  /** Unité affichée dans le champ « Autre » (« visites », « DA », « % »…). */
  unitLabel: string;
  /** Choix d'unité (% / DA) au-dessus des pastilles. */
  units?: { value: U; label: string }[];
  unit?: U;
  onUnit?: (u: U) => void;
  onClose: () => void;
  onDone: (v: number) => void;
  extra?: ReactNode;
}) {
  const isPreset = choices.some((c) => c.value === value);
  const [v, setV] = useState(value);
  const [autre, setAutre] = useState(!isPreset);
  const [txt, setTxt] = useState(isPreset ? '' : String(value));
  const [err, setErr] = useState<string | null>(null);

  const valider = () => {
    const n = autre ? Number(txt.replace(/\D/g, '')) : v;
    if (!Number.isFinite(n) || n < min || n > max) return setErr(t('Entre {min} et {max}.', { min, max }));
    onDone(n);
  };

  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal>
        <div className="h1 !text-[1.429rem]">{title}</div>
        {units && unit && onUnit && (
          <Segmented
            label={title}
            value={unit}
            onChange={(u) => {
              onUnit(u);
              setAutre(false);
              setErr(null);
            }}
            options={units}
          />
        )}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={title}>
          {choices.map((c) => (
            <Pill
              key={c.value}
              lg
              role="radio"
              aria-checked={!autre && v === c.value}
              on={!autre && v === c.value}
              onClick={() => {
                setAutre(false);
                setV(c.value);
                setErr(null);
              }}
            >
              <span dir="ltr">{c.label}</span>
            </Pill>
          ))}
          <Pill lg role="radio" aria-checked={autre} on={autre} onClick={() => setAutre(true)}>
            {t('Autre')}
          </Pill>
        </div>
        {autre && (
          <div className="flex items-center gap-2.5">
            <Input
              lg
              inputMode="numeric"
              dir="ltr"
              value={txt}
              onChange={(e) => {
                setTxt(e.target.value.replace(/\D/g, ''));
                setErr(null);
              }}
              placeholder={String(min)}
              aria-label={title}
            />
            <span className="flex-none text-[1rem] font-semibold text-muted">{unitLabel}</span>
          </div>
        )}
        {extra}
        {err && (
          <p className="text-[0.857rem] text-danger" role="alert">
            {err}
          </p>
        )}
        <Button icon={ICONE.valider} onClick={valider}>
          {t('Valider')}
        </Button>
      </BottomSheet>
    </>
  );
}
