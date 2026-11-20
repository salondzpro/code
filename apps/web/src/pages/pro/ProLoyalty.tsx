/**
 * PROGRAMME FIDÉLITÉ DU SALON (18 nov. 2026, demandes du propriétaire : « le plus simple possible »,
 * puis « tout personnalisable, quantités et prix, au design actuel, premium »).
 *
 * Charte : un interrupteur, un sélecteur segmenté (Passages · Points · Code promo), puis UNE liste de
 * réglages (`.lst` + `SettingRow`) dont chaque ligne montre sa valeur et s'ouvre dans une fenêtre du
 * bas (`ValueSheet`) : choix rapides en pastilles ET « Autre » pour saisir sa propre valeur.
 *   - Cadeau après : 3, 5, 8, 10 visites — ou autre (2 à 20) ; points : 50, 100, 200 — ou autre ;
 *   - Le cadeau : % du total (10, 20, 30 — ou autre) ou montant en DA (500, 1 000, 2 000 — ou autre) ;
 *   - Dès un achat de : aucun, 1 000, 2 000, 5 000 DA — ou autre ;
 *   - Cadeau valable : 1 à 6 mois ;
 *   - Code (mode code promo).
 * Puis l'aperçu (ce que voit le client) et « Bientôt récompensés ».
 */
import { PlanLock } from '@/components/Plans';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarClock, Check, Coins, Hash, Repeat, ShoppingBag, Target, Ticket, type LucideIcon } from 'lucide-react';
import { useProLoyalty, useProLoyaltyClients, useSaveProLoyalty } from '@salondz/api-client';
import { LOYALTY_DA_PER_POINT, formatDA, formatDateShortDZ, loyaltyReward, type LoyaltyMode, type LoyaltyRewardKind } from '@salondz/constants';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Avatar, Badge, BottomSheet, Button, Dim, Input, SectionLabel, SettingRow, Toggle, TopBar } from '@/components/ui';
import { PageLoading } from '@/components/PageLoading';
import { errorText } from '@/components/ErrorMessage';
import { LoyaltyCardView } from '@/components/Loyalty';
import { ValueSheet } from '@/components/ValueSheet';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

type Sheet = null | 'seuil' | 'cadeau' | 'minimum' | 'validite' | 'code' | 'remplacer';

const MODES: { value: LoyaltyMode; label: string; icon: LucideIcon }[] = [
  { value: 'visits', label: 'Passages', icon: Repeat },
  { value: 'points', label: 'Points', icon: Coins },
  { value: 'promo', label: 'Code promo', icon: Ticket },
];
const MODE_LABEL: Record<LoyaltyMode, string> = { visits: 'Passages', points: 'Points', promo: 'Code promo' };

export function ProLoyalty() {
  const navigate = useNavigate();
  const loyalty = useProLoyalty();
  const save = useSaveProLoyalty();
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState<LoyaltyMode>('visits');
  const [threshold, setThreshold] = useState(5);
  const [kind, setKind] = useState<LoyaltyRewardKind>('percent');
  const [value, setValue] = useState(20);
  const [minSpend, setMinSpend] = useState(0);
  const [months, setMonths] = useState(3);
  const [code, setCode] = useState('');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [codeTxt, setCodeTxt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const clients = useProLoyaltyClients(!!loyalty.data?.enabled && loyalty.data.mode !== 'promo');

  useEffect(() => {
    const p = loyalty.data;
    if (!p) return;
    setOn(p.enabled);
    setMode(p.mode);
    setThreshold(p.threshold);
    setKind(p.rewardKind);
    setValue(p.rewardValue);
    setMinSpend(p.minSpend);
    setMonths(p.giftMonths);
    setCode(p.code ?? '');
  }, [loyalty.data]);

  if (loyalty.isPending) return <PageLoading />;

  const program = { mode, threshold, rewardKind: kind, rewardValue: value, minSpend };
  const wasOn = !!loyalty.data?.enabled;
  const changeMode = (m: LoyaltyMode) => {
    setMode(m);
    if (m === 'points' && threshold < 10) setThreshold(100);
    if (m === 'visits' && threshold > 20) setThreshold(5);
  };

  const submit = async (remplacer = false) => {
    setError(null);
    // Un programme actif d'un autre type est REMPLACÉ : on le dit avant (un seul programme à la fois).
    if (on && wasOn && loyalty.data && loyalty.data.mode !== mode && !remplacer) return setSheet('remplacer');
    if (on && mode === 'promo' && !/^[A-Z0-9]{3,12}$/.test(code)) {
      setSheet('code');
      return setError(t('Le code promo compte 3 à 12 lettres ou chiffres.'));
    }
    try {
      const r = await save.mutateAsync({ enabled: on, mode, threshold, rewardKind: kind, rewardValue: value, minSpend, giftMonths: months, code: mode === 'promo' ? code : null });
      if (r.announced > 0) setDone(t('Programme activé : {n} client(s) prévenu(s).', { n: r.announced }));
      else navigate('/pro/parametres');
    } catch (err) {
      setError(errorText(err));
    }
  };

  const seuilTxt = mode === 'points' ? t('{n} points', { n: threshold }) : t('{n} visites', { n: threshold });

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo="/pro/parametres" title={t('Programme fidélité')} />
      <PlanLock need="pro" what={t('Le programme fidélité')} />

      <div className="lst">
        <SettingRow icon={ICONE.fidelite} title={t('Récompenser mes clients')} right={<Toggle on={on} onChange={setOn} label={t('Récompenser mes clients')} />} />
      </div>

      {on && (
        <>
          {/* UN SEUL PROGRAMME (18 nov. 2026, demande du propriétaire) : un choix unique à cocher, pas des
              onglets qu'on croirait cumulables. */}
          <SectionLabel>{t('Votre programme')}</SectionLabel>
          <div className="lst" role="radiogroup" aria-label={t('Votre programme')}>
            {MODES.map((m) => (
              <SettingRow
                key={m.value}
                className={`fid-c-${m.value}`}
                icon={m.icon}
                title={t(m.label)}
                onClick={() => changeMode(m.value)}
                right={
                  <span className={`fid-radio${mode === m.value ? ' on' : ''}`} role="radio" aria-checked={mode === m.value} aria-label={t(m.label)}>
                    {mode === m.value && <Check size={14} strokeWidth={3} />}
                  </span>
                }
              />
            ))}
          </div>

          <SectionLabel>{t('Réglages')}</SectionLabel>

          <div className="lst">
            {mode === 'promo' ? (
              <SettingRow
                className="fid-c-promo"
                icon={Hash}
                title={t('Le code')}
                onClick={() => {
                  setCodeTxt(code);
                  setSheet('code');
                }}
                right={<b className="mono text-[1rem] tracking-[0.06em]">{code || '—'}</b>}
              />
            ) : (
              <SettingRow className={`fid-c-${mode}`} icon={Target} title={t('Cadeau après')} sub={mode === 'points' ? t('1 point = {n} DA', { n: LOYALTY_DA_PER_POINT }) : undefined} onClick={() => setSheet('seuil')} right={<b className="text-[1rem]">{seuilTxt}</b>} />
            )}
            <SettingRow className="fid-c-gift" icon={ICONE.promo} title={t('Le cadeau')} onClick={() => setSheet('cadeau')} right={<span className="fid-tag fid-c-gift">{loyaltyReward(program)}</span>} />
            <SettingRow icon={ShoppingBag} title={t('Dès un achat de')} onClick={() => setSheet('minimum')} right={<b className="text-[1rem]">{minSpend > 0 ? formatDA(minSpend) : t('Aucun minimum')}</b>} />
            <SettingRow icon={CalendarClock} title={mode === 'promo' ? t('Code valable') : t('Cadeau valable')} onClick={() => setSheet('validite')} right={<b className="text-[1rem]">{t('{n} mois', { n: months })}</b>} />
          </div>

          {mode !== 'promo' && (
            <>
              <SectionLabel>{t('Ce que voient vos clients')}</SectionLabel>
              <LoyaltyCardView program={program} progress={mode === 'points' ? Math.round(threshold * 0.4) : Math.min(2, threshold - 1)} />
            </>
          )}

          {wasOn && mode === loyalty.data?.mode && mode !== 'promo' && (clients.data?.length ?? 0) > 0 && (
            <>
              <SectionLabel>{t('Bientôt récompensés')}</SectionLabel>
              <div className="lst">
                {clients.data!.map((c) => (
                  <Link key={c.key} to={`/pro/clients/${encodeURIComponent(c.key)}`} className="lst-r">
                    <Avatar name={c.name} size={36} />
                    <span className="lst-t">
                      <span>{c.name}</span>
                      <small>
                        {c.giftAvailable
                          ? t('Cadeau à utiliser avant le {date}', { date: formatDateShortDZ(c.giftExpiresAt!) })
                          : loyalty.data!.mode === 'points'
                            ? t('{n} points sur {total}', { n: c.progress, total: c.threshold })
                            : t('{n} visites sur {total}', { n: c.progress, total: c.threshold })}
                      </small>
                    </span>
                    {c.giftAvailable ? <Badge tone="ok" md>{t('Cadeau')}</Badge> : <Badge tone="pd" md>{`${c.progress}/${c.threshold}`}</Badge>}
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {sheet === 'seuil' && (
        <ValueSheet
          title={t('Cadeau après')}
          value={threshold}
          min={mode === 'points' ? 10 : 2}
          max={mode === 'points' ? 2000 : 20}
          unitLabel={mode === 'points' ? t('points') : t('visites')}
          choices={(mode === 'points' ? [50, 100, 200] : [3, 5, 8, 10]).map((n) => ({ value: n, label: mode === 'points' ? t('{n} points', { n }) : t('{n} visites', { n }) }))}
          onClose={() => setSheet(null)}
          onDone={(n) => {
            setThreshold(n);
            setSheet(null);
          }}
        />
      )}
      {sheet === 'cadeau' && (
        <ValueSheet<LoyaltyRewardKind>
          title={t('Le cadeau')}
          value={value}
          min={kind === 'percent' ? 1 : 50}
          max={kind === 'percent' ? 100 : 100_000}
          unitLabel={kind === 'percent' ? '%' : 'DA'}
          units={[
            { value: 'percent', label: t('% du total') },
            { value: 'amount', label: t('Montant (DA)') },
          ]}
          unit={kind}
          onUnit={(u) => {
            setKind(u);
            setValue(u === 'percent' ? 20 : 1000);
          }}
          choices={(kind === 'percent' ? [10, 20, 30] : [500, 1000, 2000]).map((n) => ({ value: n, label: kind === 'percent' ? `${n} %` : formatDA(n) }))}
          onClose={() => setSheet(null)}
          onDone={(n) => {
            setValue(n);
            setSheet(null);
          }}
        />
      )}
      {sheet === 'minimum' && (
        <ValueSheet
          title={t('Dès un achat de')}
          value={minSpend}
          min={0}
          max={1_000_000}
          unitLabel="DA"
          choices={[0, 1000, 2000, 5000].map((n) => ({ value: n, label: n === 0 ? t('Aucun minimum') : formatDA(n) }))}
          onClose={() => setSheet(null)}
          onDone={(n) => {
            setMinSpend(n);
            setSheet(null);
          }}
        />
      )}
      {sheet === 'validite' && (
        <ValueSheet
          title={mode === 'promo' ? t('Code valable') : t('Cadeau valable')}
          value={months}
          min={1}
          max={6}
          unitLabel={t('mois')}
          choices={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: t('{n} mois', { n }) }))}
          onClose={() => setSheet(null)}
          onDone={(n) => {
            setMonths(n);
            setSheet(null);
          }}
        />
      )}
      {sheet === 'code' && (
        <>
          <Dim onClose={() => setSheet(null)} />
          <BottomSheet modal>
            <div className="h1 !text-[1.429rem]">{t('Le code')}</div>
            <Input
              lg
              className="mono uppercase tracking-[0.06em]"
              value={codeTxt}
              maxLength={12}
              onChange={(e) => setCodeTxt(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="KARIM10"
              aria-label={t('Code promo')}
              autoCapitalize="characters"
            />
            <Button
              icon={ICONE.valider}
              disabled={codeTxt.length < 3}
              onClick={() => {
                setCode(codeTxt);
                setError(null);
                setSheet(null);
              }}
            >
              {t('Valider')}
            </Button>
          </BottomSheet>
        </>
      )}

      {sheet === 'remplacer' && loyalty.data && (
        <>
          <Dim onClose={() => setSheet(null)} />
          <BottomSheet modal>
            <div className="h1 !text-[1.429rem]">
              {t('Remplacer « {ancien} » par « {nouveau} » ?', { ancien: t(MODE_LABEL[loyalty.data.mode]), nouveau: t(MODE_LABEL[mode]) })}
            </div>
            <p className="p">{t('Un seul programme à la fois : l’ancien s’arrête.')}</p>
            <Button
              icon={ICONE.valider}
              loading={save.isPending}
              onClick={() => {
                setSheet(null);
                void submit(true);
              }}
            >
              {t('Remplacer')}
            </Button>
            <Button icon={ICONE.garder} variant="g" onClick={() => setSheet(null)}>
              {t('Garder « {ancien} »', { ancien: t(MODE_LABEL[loyalty.data.mode]) })}
            </Button>
          </BottomSheet>
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

