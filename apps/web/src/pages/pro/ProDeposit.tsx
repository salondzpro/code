/**
 * VERSEMENT À LA RÉSERVATION (14 nov. 2026, demande du propriétaire, migration 0057).
 *
 * Refait le 14 nov. au soir (demande du propriétaire) : thème pro actuel, et le plus court possible.
 * - Montant : des choix PRÉDÉFINIS d'un toucher (20 %, 30 %, 50 %, 1 000 DA, 2 000 DA), « Autre » seulement
 *   pour une valeur libre. Chaque pourcentage montre ce qu'il donne sur une vraie prestation du catalogue.
 * - Compte : UN seul champ, le numéro CCP (BaridiMob). Plus de choix banque / CCP / BaridiMob, plus de
 *   titulaire ni de consigne à remplir.
 * Un versement exigé reste une DEMANDE jusqu'à la validation du justificatif.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Landmark, ShieldCheck } from 'lucide-react';
import { useDepositSettings, useProSalon, useSaveDepositSettings } from '@salondz/api-client';
import { depositFor, formatDA, type DepositMode, type DepositScope } from '@salondz/constants';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { BottomSheet, Button, I, Segmented, SectionLabel, Toggle, TopBar } from '@/components/ui';
import { PageLoading } from '@/components/PageLoading';
import { errorText } from '@/components/ErrorMessage';
import { ICONE } from '@/lib/actionIcons';
import { ACCOUNT_PLACEHOLDER } from '@/lib/deposit';
import { t } from '@/i18n';

type Mode = Exclude<DepositMode, 'off'>;
const PRESETS: { mode: Mode; value: number }[] = [
  { mode: 'percent', value: 20 },
  { mode: 'percent', value: 30 },
  { mode: 'percent', value: 50 },
  { mode: 'fixed', value: 1000 },
  { mode: 'fixed', value: 2000 },
];
const isPreset = (m: Mode, v: number) => PRESETS.some((p) => p.mode === m && p.value === v);

export function ProDeposit() {
  const navigate = useNavigate();
  const settings = useDepositSettings();
  const salon = useProSalon().data?.salon ?? null;
  const save = useSaveDepositSettings();

  const [on, setOn] = useState(false);
  const [mode, setMode] = useState<Mode>('percent');
  const [value, setValue] = useState(30);
  const [custom, setCustom] = useState(false);
  const [scope, setScope] = useState<DepositScope>('all');
  const [account, setAccount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setOn(s.mode !== 'off');
    if (s.mode !== 'off') {
      setMode(s.mode);
      setValue(s.value);
      setCustom(!isPreset(s.mode, s.value));
    }
    setScope(s.scope);
    setAccount(s.account ?? '');
  }, [settings.data]);

  // Un vrai exemple, tiré du catalogue : la prestation au prix médian.
  const sample = useMemo(() => {
    const list = (salon?.services ?? []).filter((s) => s.isActive && s.priceDa > 0);
    return list.sort((a, b) => b.priceDa - a.priceDa)[Math.floor(list.length / 2)] ?? null;
  }, [salon]);

  if (settings.isPending || !salon) return <PageLoading />;

  const example = sample ? depositFor(sample.priceDa, mode, value) : null;
  const pick = (m: Mode, v: number) => {
    setCustom(false);
    setMode(m);
    setValue(v);
  };

  const submit = async () => {
    setError(null);
    if (on) {
      if (!(value > 0)) return setError(t('Indiquez le montant du versement.'));
      if (mode === 'percent' && value > 100) return setError(t('Un pourcentage va de 1 à 100.'));
      if (!account.trim()) return setError(t('Indiquez votre numéro CCP (BaridiMob).'));
    }
    try {
      await save.mutateAsync({
        mode: on ? mode : 'off',
        value: on ? value : 0,
        scope,
        method: 'ccp',
        holder: settings.data?.holder ?? null,
        account: account.trim() || null,
        note: settings.data?.note ?? null,
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
        <span className="dp-pro-ic" aria-hidden>
          <I icon={Landmark} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[1.071rem] font-semibold">{t('Demander un versement')}</b>
          <span className="t3 block">{t('Le rendez-vous est confirmé quand vous validez le reçu.')}</span>
        </span>
        <Toggle on={on} onChange={setOn} label={t('Demander un versement')} />
      </div>

      {on && (
        <>
          <SectionLabel>{t('Montant')}</SectionLabel>
          <div className="dp-presets" role="radiogroup" aria-label={t('Montant du versement')}>
            {PRESETS.map((p) => {
              const sel = !custom && mode === p.mode && value === p.value;
              const ex = p.mode === 'percent' && sample ? depositFor(sample.priceDa, p.mode, p.value) : null;
              return (
                <button key={`${p.mode}${p.value}`} type="button" role="radio" aria-checked={sel} className={`dp-tile${sel ? ' on' : ''}`} onClick={() => pick(p.mode, p.value)}>
                  {sel && <I icon={Check} size={14} strokeWidth={2.6} className="dp-tile-ok" />}
                  <b dir="ltr">{p.mode === 'percent' ? `${p.value} %` : formatDA(p.value)}</b>
                  <small dir="ltr">{p.mode === 'percent' ? (ex != null ? formatDA(ex) : t('du total')) : t('fixe')}</small>
                </button>
              );
            })}
            <button type="button" role="radio" aria-checked={custom} className={`dp-tile${custom ? ' on' : ''}`} onClick={() => setCustom(true)}>
              {custom && <I icon={Check} size={14} strokeWidth={2.6} className="dp-tile-ok" />}
              <b>{t('Autre')}</b>
              <small>{t('à saisir')}</small>
            </button>
          </div>

          {custom && (
            <div className="crd dp-custom">
              <input
                className="inp mono"
                inputMode="numeric"
                dir="ltr"
                value={value || ''}
                onChange={(e) => setValue(Math.min(mode === 'percent' ? 100 : 1_000_000, Number(e.target.value.replace(/\D/g, '')) || 0))}
                aria-label={mode === 'percent' ? t('Pourcentage du total') : t('Montant en DA')}
                placeholder={mode === 'percent' ? '25' : '1500'}
              />
              <Segmented
                sm
                label={t('Unité')}
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setValue(0);
                }}
                options={[
                  { value: 'percent', label: '%' },
                  { value: 'fixed', label: 'DA' },
                ]}
              />
            </div>
          )}

          {sample && example != null && (
            <p className="dp-example">
              {t('« {prestation} » à {prix} → versement de {montant}', {
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
              { value: 'new', label: t('Nouvelles clientes') },
            ]}
          />

          <SectionLabel>{t('Compte CCP (BaridiMob)')}</SectionLabel>
          <input
            className="inp mono dp-rip"
            inputMode="numeric"
            dir="ltr"
            value={account}
            maxLength={40}
            onChange={(e) => setAccount(e.target.value.replace(/[^\d ]/g, ''))}
            placeholder={t(ACCOUNT_PLACEHOLDER)}
            aria-label={t('Numéro CCP (BaridiMob)')}
          />
          <p className="flex items-start gap-2 px-1 text-[0.857rem] text-muted">
            <I icon={ShieldCheck} size={16} className="mt-0.5 flex-none" />
            {t('Jamais affiché sur votre page : seule la personne qui réserve le voit, le temps de verser.')}
          </p>
        </>
      )}

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
