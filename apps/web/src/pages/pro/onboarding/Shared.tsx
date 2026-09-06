/** Éléments communs de l'onboarding pro : en-tête « Étape n sur 10 », feuille d'action basse. */
import type { ReactNode } from 'react';
import { ONBOARDING_STEPS } from '@/lib/proDraft';
import { BottomSheet, Button, TopBar } from '@/components/ui';

export function StepBar({ step, backTo, right }: { step: number; backTo?: string; right?: ReactNode }) {
  return <TopBar backTo={backTo} right={right ?? `Étape ${step} sur ${ONBOARDING_STEPS}`} />;
}

export function StepSheet({ label = 'Continuer', onClick, disabled, busy, secondary }: { label?: string; onClick: () => void; disabled?: boolean; busy?: boolean; secondary?: ReactNode }) {
  return (
    <BottomSheet>
      {secondary}
      <Button onClick={onClick} disabled={disabled || busy}>
        {busy ? 'Enregistrement…' : label}
      </Button>
    </BottomSheet>
  );
}

export const stepPath = (n: number) => `/pro/onboarding/${n}`;
