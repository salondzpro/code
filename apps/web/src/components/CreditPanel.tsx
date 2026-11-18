/**
 * CRÉDIT CLIENT (18 nov. 2026, demande du propriétaire) — sur la fiche du client, côté pro :
 * le solde dû en grand, deux gestes (« Crédit » : une somme due ; « Encaisser » : un paiement), et
 * l'historique (une ligne saisie par erreur se retire). Le client avec compte est prévenu à chaque
 * ligne, et ne peut plus changer son identité ni supprimer son compte tant qu'un solde reste dû.
 */
import { useState } from 'react';
import { useClientCredit, useCreditMutations } from '@salondz/api-client';
import { creditBalance, formatDA, formatDateShortDZ, type CreditKind } from '@salondz/constants';
import { BottomSheet, Button, Dim, I, Input } from './ui';
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
    <div className="crd !gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="fid-ic" aria-hidden>
            <I icon={ICONE.credit} size={19} strokeWidth={1.7} />
          </span>
          <b className="text-[1rem] font-semibold">{t('Crédit')}</b>
        </span>
        <span className={`cr-bal${balance > 0 ? ' du' : ''}`} dir="ltr">
          {formatDA(balance)}
        </span>
      </div>
      <div className="flex gap-2.5">
        <Button icon={ICONE.ajouter} variant="g" sm className="flex-1" onClick={() => setSheet('debt')}>
          {t('Crédit')}
        </Button>
        <Button icon={ICONE.valider} sm className="flex-1" disabled={balance === 0} onClick={() => setSheet('payment')}>
          {t('Encaisser')}
        </Button>
      </div>
      {entries.length > 0 && (
        <div className="flex flex-col">
          {[...entries].reverse().slice(0, 8).map((e) => (
            <div key={e.id} className="li !py-2">
              <span className="min-w-0">
                <b className={`block text-[0.929rem] font-semibold ${e.kind === 'debt' ? 'text-danger' : 'text-ok-fg'}`} dir="ltr">
                  {e.kind === 'debt' ? '+' : '−'} {formatDA(e.amount)}
                </b>
                <span className="block truncate text-[0.857rem] text-muted">
                  {formatDateShortDZ(e.at)}
                  {e.note ? ` · ${e.note}` : ''}
                </span>
              </span>
              <button type="button" className="text-muted" aria-label={t('Retirer cette ligne')} onClick={() => void remove.mutateAsync(e.id)}>
                <I icon={ICONE.supprimer} size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {sheet && (
        <>
          <Dim onClose={() => setSheet(null)} />
          <BottomSheet modal>
            <div className="h1 !text-[1.429rem]">{sheet === 'debt' ? t('Ajouter un crédit') : t('Encaisser un paiement')}</div>
            <Input lg inputMode="numeric" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder={t('Montant en DA')} aria-label={t('Montant en DA')} />
            <Input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder={t('Note (facultatif)')} aria-label={t('Note')} />
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
  );
}
