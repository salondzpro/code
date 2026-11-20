/**
 * CRÉDIT CLIENT (18 nov. 2026, demande du propriétaire) — sur la fiche du client, côté pro.
 * Charte : une liste (`.lst`) — en tête « Crédit » et le solde dû (rouge s'il reste quelque chose),
 * deux boutons (« Crédit » : une somme due ; « Encaisser » : un paiement), puis l'historique (une ligne
 * saisie par erreur se retire). Le client avec compte est prévenu à chaque ligne, et ne peut plus
 * changer son identité ni supprimer son compte tant qu'un solde reste dû.
 */
import { PlanLock } from './Plans';
import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useClientCredit, useCreditMutations } from '@salondz/api-client';
import { creditBalance, formatDA, formatDateShortDZ, type CreditKind } from '@salondz/constants';
import { Badge, BottomSheet, Button, Dim, Field, I, Input, SettingRow } from './ui';
import { errorText } from './ErrorMessage';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

export function CreditPanel({ clientKey }: { clientKey: string }) {
  const file = useClientCredit(clientKey);
  const { add, remove } = useCreditMutations(clientKey);
  const [sheet, setSheet] = useState<CreditKind | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!file.data) return null;
  const entries = file.data.entries;
  const balance = creditBalance(entries);

  const submit = async () => {
    setError(null);
    const n = Number(amount.replace(/\D/g, ''));
    if (!(n > 0)) return setError(t('Indiquez un montant.'));
    try {
      await add.mutateAsync({ kind: sheet!, amount: n, note: note.trim() || undefined });
      setSheet(null);
      setAmount('');
      setNote('');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <>
    <PlanLock need="pro" what={t('Le crédit client')} />
    <div className="lst">
      <SettingRow
        icon={ICONE.credit}
        title={t('Crédit')}
        right={
          balance > 0 ? (
            <Badge tone="cn" md dot={false}>
              {t('Dû')} <span dir="ltr">{formatDA(balance)}</span>
            </Badge>
          ) : balance < 0 ? (
            <Badge tone="ok" md dot={false}>
              {t('Avance')} <span dir="ltr">+{formatDA(-balance)}</span>
            </Badge>
          ) : (
            <Badge tone="ok" md dot={false}>
              {t('Soldé')}
            </Badge>
          )
        }
      />
      <div className="flex gap-2.5 px-4 pb-3 pt-1">
        <Button icon={ICONE.ajouter} variant="g" sm className="flex-1" onClick={() => setSheet('debt')}>
          {t('Crédit')}
        </Button>
        <Button icon={ICONE.valider} sm className="flex-1" onClick={() => setSheet('payment')}>
          {t('Encaisser')}
        </Button>
      </div>
      {[...entries]
        .reverse()
        .slice(0, 8)
        .map((e) => (
          <SettingRow
            key={e.id}
            icon={e.kind === 'debt' ? ArrowUpRight : ArrowDownLeft}
            title={<span dir="ltr" className={e.kind === 'debt' ? 'text-danger' : 'text-ok-fg'}>{`${e.kind === 'debt' ? '+' : '−'} ${formatDA(e.amount)}`}</span>}
            sub={`${formatDateShortDZ(e.at)}${e.note ? ` · ${e.note}` : ''}`}
            right={
              <button type="button" className="p-1 text-muted" aria-label={t('Retirer cette ligne')} onClick={() => void remove.mutateAsync(e.id)}>
                <I icon={ICONE.supprimer} size={16} />
              </button>
            }
          />
        ))}

      {sheet && (
        <>
          <Dim onClose={() => setSheet(null)} />
          <BottomSheet modal>
            <div className="h1 !text-[1.429rem]">{sheet === 'debt' ? t('Ajouter un crédit') : t('Encaisser un paiement')}</div>
            <Field label={t('Montant en DA')} htmlFor="cr-amount">
              <Input id="cr-amount" lg inputMode="numeric" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="1500" />
            </Field>
            <Field label={t('Note (facultatif)')} htmlFor="cr-note">
              <Input id="cr-note" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
            </Field>
            {error && (
              <p className="text-[0.857rem] text-danger" role="alert">
                {error}
              </p>
            )}
            <Button icon={sheet === 'debt' ? ICONE.ajouter : ICONE.valider} onClick={() => void submit()} loading={add.isPending}>
              {sheet === 'debt' ? t('Enregistrer le crédit') : t('Enregistrer le paiement')}
            </Button>
          </BottomSheet>
        </>
      )}
    </div>
    </>
  );
}
