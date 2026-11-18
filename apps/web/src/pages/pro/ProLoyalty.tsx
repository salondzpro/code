/**
 * CARTE FIDÉLITÉ DU SALON (18 nov. 2026, demande du propriétaire : « personnalisable par le
 * professionnel, enrichi et simple, à comprendre directement »).
 *
 * Deux questions, des choix tout prêts d'un toucher (comme le versement) :
 *   1. après combien de visites ? 5, 6, 8, 10 ;
 *   2. quelle récompense ? prestation offerte, −50 %, −20 %, ou un montant en DA.
 * Deux réglages : premier tampon offert, validité 6 ou 12 mois. L'aperçu EST la carte du client.
 * Activer annonce le programme aux clients du salon (une fois par mois au plus, côté serveur).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import { useProLoyalty, useSaveProLoyalty } from '@salondz/api-client';
import { LOYALTY_VISITS, formatDA, loyaltyHeadline, type LoyaltyRewardKind } from '@salondz/constants';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { BottomSheet, Button, I, Segmented, SectionLabel, Toggle, TopBar } from '@/components/ui';
import { PageLoading } from '@/components/PageLoading';
import { errorText } from '@/components/ErrorMessage';
import { LoyaltyCardView } from '@/components/Loyalty';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

type Reward = { kind: LoyaltyRewardKind; value: number };
const REWARDS: Reward[] = [
  { kind: 'free', value: 0 },
  { kind: 'percent', value: 50 },
  { kind: 'percent', value: 20 },
  { kind: 'amount', value: 500 },
];
const rewardTitle = (r: Reward) => (r.kind === 'free' ? t('Offerte') : r.kind === 'percent' ? `−${r.value} %` : `−${formatDA(r.value)}`);

export function ProLoyalty() {
  const navigate = useNavigate();
  const loyalty = useProLoyalty();
  const save = useSaveProLoyalty();
  const [on, setOn] = useState(false);
  const [visits, setVisits] = useState(6);
  const [reward, setReward] = useState<Reward>({ kind: 'free', value: 0 });
  const [welcome, setWelcome] = useState(true);
  const [validity, setValidity] = useState<6 | 12>(6);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const p = loyalty.data;
    if (!p) return;
    setOn(p.enabled);
    setVisits(p.visits);
    setReward({ kind: p.rewardKind, value: p.rewardValue });
    setWelcome(p.welcome);
    setValidity(p.validityMonths === 12 ? 12 : 6);
  }, [loyalty.data]);

  if (loyalty.isPending) return <PageLoading />;

  const program = { visits, rewardKind: reward.kind, rewardValue: reward.value };
  const wasOn = !!loyalty.data?.enabled;

  const submit = async () => {
    setError(null);
    try {
      const r = await save.mutateAsync({ enabled: on, visits, rewardKind: reward.kind, rewardValue: reward.value, welcome, validityMonths: validity });
      if (r.announced > 0) setDone(t('Programme activé : {n} client(s) prévenu(s).', { n: r.announced }));
      else navigate('/pro/parametres');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo="/pro/parametres" title={t('Carte fidélité')} />

      <div className="crd dp-set-hero">
        <span className="fid-ic" aria-hidden>
          <I icon={ICONE.fidelite} size={20} strokeWidth={1.7} />
        </span>
        <b className="min-w-0 flex-1 text-[1.071rem] font-semibold">{t('Récompenser mes clients fidèles')}</b>
        <Toggle on={on} onChange={setOn} label={t('Récompenser mes clients fidèles')} />
      </div>

      {on && (
        <>
          <SectionLabel>{t('La visite récompensée')}</SectionLabel>
          <div className="dp-presets fid-presets" role="radiogroup" aria-label={t('La visite récompensée')}>
            {LOYALTY_VISITS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={visits === n} className={`dp-tile${visits === n ? ' on' : ''}`} onClick={() => setVisits(n)}>
                {visits === n && <I icon={Check} size={14} strokeWidth={2.6} className="dp-tile-ok" />}
                <b>{t('{n}ᵉ', { n })}</b>
                <small>{t('visite')}</small>
              </button>
            ))}
          </div>

          <SectionLabel>{t('La récompense')}</SectionLabel>
          <div className="dp-presets fid-presets" role="radiogroup" aria-label={t('La récompense')}>
            {REWARDS.map((r) => {
              const sel = reward.kind === r.kind && reward.value === r.value;
              return (
                <button key={`${r.kind}${r.value}`} type="button" role="radio" aria-checked={sel} className={`dp-tile${sel ? ' on' : ''}`} onClick={() => setReward(r)}>
                  {sel && <I icon={Check} size={14} strokeWidth={2.6} className="dp-tile-ok" />}
                  <b dir="ltr">{rewardTitle(r)}</b>
                </button>
              );
            })}
          </div>

          <div className="crd !gap-0 !py-1">
            <div className="li">
              <span className="text-[1rem] font-semibold">{t('Premier tampon offert')}</span>
              <Toggle on={welcome} onChange={setWelcome} label={t('Premier tampon offert')} />
            </div>
            <div className="li">
              <span className="text-[1rem] font-semibold">{t('Tampons valables')}</span>
              <Segmented
                sm
                className="fid-seg"
                label={t('Tampons valables')}
                value={String(validity)}
                onChange={(v) => setValidity(v === '12' ? 12 : 6)}
                options={[
                  { value: '6', label: t('6 mois') },
                  { value: '12', label: t('1 an') },
                ]}
              />
            </div>
          </div>

          <SectionLabel>{t('Ce que voient vos clients')}</SectionLabel>
          <LoyaltyCardView program={program} stamps={welcome ? 1 : 0} sub={loyaltyHeadline(program)} />
        </>
      )}

      {done && (
        <p className="text-[1rem] font-semibold text-ok-fg" role="status">
          {done}
        </p>
      )}
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <BottomSheet>
        {done ? (
          <Button icon={ICONE.retour} onClick={() => navigate('/pro/parametres')}>
            {t('Terminé')}
          </Button>
        ) : (
          <Button icon={on && !wasOn ? ICONE.envoyer : ICONE.enregistrer} onClick={() => void submit()} loading={save.isPending}>
            {on && !wasOn ? t('Activer et prévenir mes clients') : t('Enregistrer')}
          </Button>
        )}
      </BottomSheet>
    </Screen>
  );
}
