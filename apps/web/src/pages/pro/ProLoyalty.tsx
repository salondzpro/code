/**
 * PROGRAMME FIDÉLITÉ DU SALON (18 nov. 2026, demande du propriétaire : « le plus simple possible »).
 *
 * Une question par bloc, des choix tout prêts d'un toucher (comme le versement) :
 *   1. le type : par passages, par points (1 point = 100 DA) ou code promo ;
 *   2. la condition : après 3/5/8/10 visites, à 50/100/200 points, ou le code ;
 *   3. le cadeau : 10 %, 20 %, 50 % du total, ou 500 / 1 000 / 2 000 DA ;
 *   4. dès un achat de : sans minimum, 2 000 DA, 5 000 DA ;
 *   5. cadeau valable : 1, 3 ou 6 mois.
 * Puis l'aperçu (ce que voit le client) et « Bientôt récompensés » : les clients proches d'un cadeau.
 * Activer annonce le programme aux clients du salon (une fois par mois au plus, côté serveur).
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import { useProLoyalty, useProLoyaltyClients, useSaveProLoyalty } from '@salondz/api-client';
import {
  LOYALTY_DA_PER_POINT,
  LOYALTY_GIFT_MONTHS,
  LOYALTY_MIN_SPEND_PRESETS,
  LOYALTY_POINT_PRESETS,
  LOYALTY_REWARD_PRESETS,
  LOYALTY_VISIT_PRESETS,
  formatDA,
  formatDateShortDZ,
  loyaltyReward,
  type LoyaltyMode,
  type LoyaltyRewardKind,
} from '@salondz/constants';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Avatar, BottomSheet, Button, I, Segmented, SectionLabel, Toggle, TopBar } from '@/components/ui';
import { PageLoading } from '@/components/PageLoading';
import { errorText } from '@/components/ErrorMessage';
import { LoyaltyCardView } from '@/components/Loyalty';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

function Tile({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub?: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`dp-tile${on ? ' on' : ''}`} onClick={onClick}>
      {on && <I icon={Check} size={14} strokeWidth={2.6} className="dp-tile-ok" />}
      <b dir="ltr">{title}</b>
      {sub && <small dir="ltr">{sub}</small>}
    </button>
  );
}

export function ProLoyalty() {
  const navigate = useNavigate();
  const loyalty = useProLoyalty();
  const save = useSaveProLoyalty();
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState<LoyaltyMode>('visits');
  const [threshold, setThreshold] = useState(5);
  const [reward, setReward] = useState<{ kind: LoyaltyRewardKind; value: number }>({ kind: 'percent', value: 20 });
  const [minSpend, setMinSpend] = useState(0);
  const [months, setMonths] = useState(3);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const clients = useProLoyaltyClients(!!loyalty.data?.enabled && loyalty.data.mode !== 'promo');

  useEffect(() => {
    const p = loyalty.data;
    if (!p) return;
    setOn(p.enabled);
    setMode(p.mode);
    setThreshold(p.threshold);
    setReward({ kind: p.rewardKind, value: p.rewardValue });
    setMinSpend(p.minSpend);
    setMonths(p.giftMonths);
    setCode(p.code ?? '');
  }, [loyalty.data]);

  if (loyalty.isPending) return <PageLoading />;

  const changeMode = (m: LoyaltyMode) => {
    setMode(m);
    if (m === 'visits' && !(LOYALTY_VISIT_PRESETS as readonly number[]).includes(threshold)) setThreshold(5);
    if (m === 'points' && !(LOYALTY_POINT_PRESETS as readonly number[]).includes(threshold)) setThreshold(100);
  };
  const program = { mode, threshold, rewardKind: reward.kind, rewardValue: reward.value, minSpend };
  const wasOn = !!loyalty.data?.enabled;

  const submit = async () => {
    setError(null);
    if (on && mode === 'promo' && !/^[A-Z0-9]{3,12}$/.test(code)) return setError(t('Le code promo compte 3 à 12 lettres ou chiffres.'));
    try {
      const r = await save.mutateAsync({
        enabled: on,
        mode,
        threshold,
        rewardKind: reward.kind,
        rewardValue: reward.value,
        minSpend,
        giftMonths: months,
        code: mode === 'promo' ? code : null,
      });
      if (r.announced > 0) setDone(t('Programme activé : {n} client(s) prévenu(s).', { n: r.announced }));
      else navigate('/pro/parametres');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo="/pro/parametres" title={t('Programme fidélité')} />

      <div className="crd dp-set-hero">
        <span className="fid-ic" aria-hidden>
          <I icon={ICONE.fidelite} size={20} strokeWidth={1.7} />
        </span>
        <b className="min-w-0 flex-1 text-[1.071rem] font-semibold">{t('Récompenser mes clients')}</b>
        <Toggle on={on} onChange={setOn} label={t('Récompenser mes clients')} />
      </div>

      {on && (
        <>
          <Segmented
            label={t('Type de programme')}
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'visits', label: t('Passages') },
              { value: 'points', label: t('Points') },
              { value: 'promo', label: t('Code promo') },
            ]}
          />

          {mode === 'visits' && (
            <>
              <SectionLabel>{t('Cadeau après')}</SectionLabel>
              <div className="dp-presets fid-presets" role="radiogroup" aria-label={t('Cadeau après')}>
                {LOYALTY_VISIT_PRESETS.map((n) => (
                  <Tile key={n} on={threshold === n} onClick={() => setThreshold(n)} title={String(n)} sub={t('visites')} />
                ))}
              </div>
            </>
          )}
          {mode === 'points' && (
            <>
              <SectionLabel>{t('Cadeau à')}</SectionLabel>
              <div className="dp-presets" role="radiogroup" aria-label={t('Cadeau à')}>
                {LOYALTY_POINT_PRESETS.map((n) => (
                  <Tile key={n} on={threshold === n} onClick={() => setThreshold(n)} title={t('{n} pts', { n })} sub={formatDA(n * LOYALTY_DA_PER_POINT)} />
                ))}
              </div>
            </>
          )}
          {mode === 'promo' && (
            <>
              <SectionLabel>{t('Le code')}</SectionLabel>
              <input
                className="inp mono uppercase tracking-[0.06em]"
                value={code}
                maxLength={12}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="KARIM10"
                aria-label={t('Code promo')}
                autoCapitalize="characters"
              />
            </>
          )}

          <SectionLabel>{t('Le cadeau')}</SectionLabel>
          <div className="dp-presets" role="radiogroup" aria-label={t('Le cadeau')}>
            {LOYALTY_REWARD_PRESETS.map((r) => (
              <Tile
                key={`${r.kind}${r.value}`}
                on={reward.kind === r.kind && reward.value === r.value}
                onClick={() => setReward(r)}
                title={loyaltyReward({ rewardKind: r.kind, rewardValue: r.value })}
                sub={r.kind === 'percent' ? t('du total') : undefined}
              />
            ))}
          </div>

          <SectionLabel>{t('Dès un achat de')}</SectionLabel>
          <div className="dp-presets" role="radiogroup" aria-label={t('Dès un achat de')}>
            {LOYALTY_MIN_SPEND_PRESETS.map((v) => (
              <Tile key={v} on={minSpend === v} onClick={() => setMinSpend(v)} title={v === 0 ? t('Sans minimum') : formatDA(v)} />
            ))}
          </div>

          <SectionLabel>{mode === 'promo' ? t('Code valable') : t('Cadeau valable')}</SectionLabel>
          <Segmented
            label={mode === 'promo' ? t('Code valable') : t('Cadeau valable')}
            value={String(months)}
            onChange={(v) => setMonths(Number(v))}
            options={LOYALTY_GIFT_MONTHS.map((m) => ({ value: String(m), label: t('{n} mois', { n: m }) }))}
          />

          {mode !== 'promo' && (
            <>
              <SectionLabel>{t('Ce que voient vos clients')}</SectionLabel>
              <LoyaltyCardView program={program} progress={mode === 'points' ? Math.round(threshold * 0.4) : 2} />
            </>
          )}

          {wasOn && loyalty.data?.mode !== 'promo' && (clients.data?.length ?? 0) > 0 && (
            <>
              <SectionLabel>{t('Bientôt récompensés')}</SectionLabel>
              <div className="crd !gap-0 !py-1">
                {clients.data!.map((c) => (
                  <Link key={c.key} to={`/pro/clients/${encodeURIComponent(c.key)}`} className="li">
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={c.name} size={36} />
                      <span className="min-w-0">
                        <b className="block truncate text-[1rem] font-semibold">{c.name}</b>
                        <span className="block text-[0.857rem] text-muted" dir="auto">
                          {c.giftAvailable
                            ? t('Cadeau à utiliser avant le {date}', { date: formatDateShortDZ(c.giftExpiresAt!) })
                            : loyalty.data!.mode === 'points'
                              ? t('{n} pts', { n: `${c.progress}/${c.threshold}` })
                              : t('{n} visites sur {total}', { n: c.progress, total: c.threshold })}
                        </span>
                      </span>
                    </span>
                    {c.giftAvailable && <span className="fid-badge">{loyaltyReward(loyalty.data!)}</span>}
                  </Link>
                ))}
              </div>
            </>
          )}
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
