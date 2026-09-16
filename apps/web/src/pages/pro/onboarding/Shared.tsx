/**
 * Éléments communs de l'onboarding pro, façon Planity Pro : en-tête « Étape n sur 9 » avec barre de
 * progression segmentée, titre en question + sous-titre, feuille d'action basse.
 */
import type { ReactNode } from 'react';
import { ONBOARDING_STEPS } from '@/lib/proDraft';
import { BottomSheet, Button, TopBar } from '@/components/ui';
import { t } from '@/i18n';

export function StepBar({
  step,
  backTo,
  right,
}: {
  step: number;
  backTo?: string;
  /** Fourni en réglages (hors inscription) : pas de compteur ni de progression. */
  right?: ReactNode;
}) {
  const shown = Math.min(ONBOARDING_STEPS, step > 5 ? step - 1 : step);
  const settings = right !== undefined;
  return (
    <div className="flex flex-col gap-3">
      <TopBar
        backTo={backTo}
        right={settings ? right : <span className="text-[0.857rem] text-muted">{t('Étape {n} sur {total}', { n: shown, total: ONBOARDING_STEPS })}</span>}
      />
      {!settings && (
        <div
          className="flex gap-1"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={ONBOARDING_STEPS}
          aria-valuenow={shown}
          aria-label={t('Progression de l’inscription')}
        >
          {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i < shown ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Titre de l'étape (une question courte) et, dessous, ce que ça change pour le pro. */
export function StepTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <h1 className="h1">{children}</h1>
      {sub && <p className="p mt-2">{sub}</p>}
    </div>
  );
}

export function StepSheet({
  label,
  onClick,
  disabled,
  busy,
  secondary,
  hint,
}: {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: ReactNode;
  /** Une ligne au-dessus du bouton (« Modifiable ensuite depuis Mon salon »). */
  hint?: ReactNode;
}) {
  return (
    <BottomSheet>
      {hint && <p className="p -mt-1 text-center text-[0.857rem]">{hint}</p>}
      {secondary}
      <Button onClick={onClick} disabled={disabled || busy}>
        {busy ? t('Enregistrement…') : (label ?? t('Continuer'))}
      </Button>
    </BottomSheet>
  );
}

export const stepPath = (n: number) => `/pro/onboarding/${n}`;
