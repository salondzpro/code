/**
 * La feuille du motif — le passage obligé de toute action de la plateforme.
 *
 * Elle existe pour une raison simple : au moment d'agir, on sait pourquoi ; six mois plus tard,
 * il ne reste que ce qu'on a écrit. Le serveur refuse d'ailleurs un motif de moins de huit
 * caractères, donc l'écran le demande franchement plutôt que de laisser partir une requête perdue
 * d'avance.
 *
 * Elle rappelle aussi ce que l'action FAIT — « le salon disparaît de la place de marché » — parce
 * qu'un bouton nommé « Masquer » ne dit pas si les rendez-vous déjà pris tiennent.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { BottomSheet, Button, Dim, Field, Textarea } from '@/components/ui';
import { ErrorMessage } from '@/components/ErrorMessage';
import { t } from '@/i18n';

/** Le serveur exige huit caractères : « ok » n'est pas un motif. */
const MOTIF_MIN = 8;

export function ReasonSheet({
  title,
  description,
  danger,
  confirmLabel,
  optional = false,
  pending,
  error,
  onConfirm,
  onClose,
  extra,
}: {
  title: string;
  description: string;
  /** Une action qui retire quelque chose au public se présente en rouge, pas en noir. */
  danger?: boolean;
  confirmLabel: string;
  /** Lever une suspension n'exige pas de motif : on répare, on ne sanctionne pas. */
  optional?: boolean;
  pending: boolean;
  error: unknown;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  /** Champs propres à l'action, posés au-dessus du motif (corriger un nom, un numéro). */
  extra?: ReactNode;
}) {
  const [motif, setMotif] = useState('');
  // `Textarea` est une primitive du design sans `ref` : on prend le champ au montage, ce qui donne
  // aussi le focus au bon moment sans effet différé.
  const champ = useCallback((el: HTMLTextAreaElement | null) => el?.focus(), []);

  const trop_court = motif.trim().length < MOTIF_MIN;
  const bloque = pending || (!optional && trop_court);

  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal>
        <div className="flex flex-col gap-3">
          <span className="text-[1.143rem] font-semibold tracking-[-0.3px]">{title}</span>
          <p className="p text-[1rem]">{description}</p>
          {error ? <ErrorMessage error={error} /> : null}
          {extra}
          <Field
            label={optional ? t('Motif (facultatif)') : t('Motif')}
            htmlFor="motif"
            hint={optional ? undefined : t('Au moins {n} caractères. Il restera au journal.', { n: MOTIF_MIN })}
          >
            <Textarea
              id="motif"
              autoFocus
              elRef={champ}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={t('Ce qui a motivé cette décision')}
              maxLength={300}
            />
          </Field>
          <Button variant={danger ? 'd' : 'ink'} disabled={bloque} onClick={() => onConfirm(motif.trim())}>
            {pending ? t('Un instant…') : confirmLabel}
          </Button>
          <Button variant="g" onClick={onClose} disabled={pending}>
            {t('Annuler')}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
