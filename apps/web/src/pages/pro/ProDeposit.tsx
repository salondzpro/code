/**
 * VERSEMENT À LA RÉSERVATION (14 nov. 2026, demande du propriétaire, migration 0057).
 *
 * Le professionnel décide s'il exige un versement pour réserver en ligne : un MONTANT FIXE ou un
 * POURCENTAGE du total, pour toutes ses clientes ou les nouvelles seulement, et sur quel compte verser
 * (CCP, banque, BaridiMob). La page montre en direct ce que la cliente verra, avec un vrai exemple
 * tiré de son catalogue. Un versement exigé reste une DEMANDE jusqu'à la validation du justificatif,
 * même quand le salon confirme d'office d'habitude.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Landmark, ShieldCheck } from 'lucide-react';
import { useDepositSettings, useProSalon, useSaveDepositSettings } from '@salondz/api-client';
import {
  DEPOSIT_FIXED_PRESETS,
  DEPOSIT_METHODS,
  DEPOSIT_PERCENT_PRESETS,
  depositFor,
  formatDA,
  type DepositMethod,
  type DepositMode,
  type DepositScope,
} from '@salondz/constants';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { BottomSheet, Button, Field, I, Segmented, SectionLabel, Toggle, TopBar } from '@/components/ui';
import { PageLoading } from '@/components/PageLoading';
import { errorText } from '@/components/ErrorMessage';
import { ICONE } from '@/lib/actionIcons';
import { ACCOUNT_LABEL, ACCOUNT_PLACEHOLDER, METHOD_LABEL } from '@/lib/deposit';
import { t } from '@/i18n';

export function ProDeposit() {
  const navigate = useNavigate();
  const settings = useDepositSettings();
  const salon = useProSalon().data?.salon ?? null;
  const save = useSaveDepositSettings();

  const [on, setOn] = useState(false);
  const [mode, setMode] = useState<Exclude<DepositMode, 'off'>>('percent');
  const [value, setValue] = useState(30);
  const [scope, setScope] = useState<DepositScope>('all');
  const [method, setMethod] = useState<DepositMethod>('ccp');
  const [holder, setHolder] = useState('');
  const [account, setAccount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setOn(s.mode !== 'off');
    if (s.mode !== 'off') {
      setMode(s.mode);
      setValue(s.value);
    }
    setScope(s.scope);
    setMethod(s.method);
    setHolder(s.holder ?? '');
    setAccount(s.account ?? '');
    setNote(s.note ?? '');
  }, [settings.data]);

  // Un vrai exemple, tiré du catalogue : la prestation au prix médian.
  const sample = useMemo(() => {
    const list = (salon?.services ?? []).filter((s) => s.isActive && s.priceDa > 0);
    return list.sort((a, b) => b.priceDa - a.priceDa)[Math.floor(list.length / 2)] ?? null;
  }, [salon]);

  if (settings.isPending || !salon) return <PageLoading />;

  const example = sample ? depositFor(sample.priceDa, mode, value) : null;
  const switchMode = (m: Exclude<DepositMode, 'off'>) => {
    setMode(m);
    setValue(m === 'percent' ? 30 : 1000);
  };

  const submit = async () => {
    setError(null);
    if (on) {
      if (!(value > 0)) return setError(t('Indiquez le montant du versement.'));
      if (mode === 'percent' && value > 100) return setError(t('Un pourcentage va de 1 à 100.'));
      if (!holder.trim()) return setError(t('Indiquez le titulaire du compte.'));
      if (!account.trim()) return setError(t('Indiquez le numéro du compte.'));
    }
    try {
      await save.mutateAsync({
        mode: on ? mode : 'off',
        value: on ? value : 0,
        scope,
        method,
        holder: holder.trim() || null,
        account: account.trim() || null,
        note: note.trim() || null,
      });
      navigate('/pro/parametres');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo="/pro/parametres" title={t('Versement à la réservation')} />

      <div className="crd dp-set-hero">
        <div className="flex items-start gap-3">
          <span className="dp-pro-ic" aria-hidden>
            <I icon={Landmark} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <b className="block text-[1.071rem]">{t('Demander un versement')}</b>
            <p className="t3 mt-0.5">{t('À la réservation, une partie du prix vous est virée, reçu joint. Vous validez : le rendez-vous est confirmé.')}</p>
          </div>
          <Toggle on={on} onChange={setOn} label={t('Demander un versement')} />
        </div>
      </div>

      {on && (
        <>
          <SectionLabel>{t('Montant demandé')}</SectionLabel>
          <Segmented
            label={t('Type de montant')}
            value={mode}
            onChange={switchMode}
            options={[
              { value: 'percent', label: t('Pourcentage') },
              { value: 'fixed', label: t('Montant fixe') },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {(mode === 'percent' ? DEPOSIT_PERCENT_PRESETS : DEPOSIT_FIXED_PRESETS).map((v) => (
              <button key={v} type="button" className={`pill${value === v ? ' on' : ''}`} onClick={() => setValue(v)} dir="ltr">
                {mode === 'percent' ? `${v} %` : formatDA(v)}
              </button>
            ))}
          </div>
          <div className="dp-amount-in">
            <input
              className="inp mono"
              inputMode="numeric"
              dir="ltr"
              value={value || ''}
              onChange={(e) => setValue(Math.min(mode === 'percent' ? 100 : 1_000_000, Number(e.target.value.replace(/\D/g, '')) || 0))}
              aria-label={mode === 'percent' ? t('Pourcentage du total') : t('Montant en DA')}
            />
            <span>{mode === 'percent' ? t('% du total') : 'DA'}</span>
          </div>
          {sample && example != null && (
            <p className="dp-example">
              {t('Exemple : « {prestation} » à {prix} → versement de {montant}', {
                prestation: sample.name,
                prix: formatDA(sample.priceDa),
                montant: formatDA(example),
              })}
            </p>
          )}

          <SectionLabel>{t('Pour qui')}</SectionLabel>
          <Segmented
            label={t('Qui doit verser')}
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: t('Tout le monde') },
              { value: 'new', label: t('Premières visites') },
            ]}
          />
          <p className="t3 -mt-2 px-1">
            {scope === 'new'
              ? t('Une personne déjà venue chez vous (rendez-vous terminé) réserve sans versement.')
              : t('Chaque réservation en ligne demande un versement.')}
          </p>
        </>
      )}

      <SectionLabel>{t('Compte où verser')}</SectionLabel>
      <Segmented
        label={t('Moyen de paiement')}
        value={method}
        onChange={setMethod}
        options={DEPOSIT_METHODS.map((m) => ({ value: m, label: m === 'ccp' ? 'CCP' : m === 'bank' ? t('Banque') : 'BaridiMob' }))}
      />
      <div className="crd !gap-3">
        <Field label={t('Titulaire du compte')}>
          <input className="inp" value={holder} maxLength={80} onChange={(e) => setHolder(e.target.value)} placeholder={t('Nom et prénom, comme sur le compte')} />
        </Field>
        <Field label={t(ACCOUNT_LABEL[method])}>
          <input className="inp mono" dir="ltr" value={account} maxLength={60} onChange={(e) => setAccount(e.target.value)} placeholder={ACCOUNT_PLACEHOLDER[method]} />
        </Field>
        <Field label={t('Consigne (facultatif)')}>
          <input className="inp" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t('Ex. : indiquez votre nom dans le motif du virement')} />
        </Field>
      </div>

      {on && account.trim() && (
        <>
          <SectionLabel>{t('Aperçu à la réservation')}</SectionLabel>
          <div className="dp-acc">
            <div className="dp-acc-top">
              <span>{t(METHOD_LABEL[method])}</span>
              <I icon={Landmark} size={18} />
            </div>
            <div className="dp-acc-num" dir="ltr">{account.trim()}</div>
            <div className="dp-acc-row">
              <span className="dp-acc-who">
                <small>{t('Titulaire')}</small>
                <b dir="auto">{holder.trim() || '—'}</b>
              </span>
              {example != null && (
                <span className="dp-acc-who items-end text-end">
                  <small>{t('Montant')}</small>
                  <b dir="ltr">{formatDA(example)}</b>
                </span>
              )}
            </div>
            {note.trim() && <p className="dp-acc-note" dir="auto">{note.trim()}</p>}
          </div>
        </>
      )}

      <p className="flex items-start gap-2 px-1 text-[0.857rem] text-muted">
        <I icon={ShieldCheck} size={16} className="mt-0.5 flex-none" />
        {t('Votre compte n’apparaît jamais sur votre page publique : seule une personne qui vient de réserver chez vous le voit, le temps de verser.')}
      </p>
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <BottomSheet>
        <Button icon={ICONE.enregistrer} loading={save.isPending} onClick={() => void submit()}>
          {t('Enregistrer')}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
