/**
 * PROMOTIONS SUR LES PRESTATIONS (18 nov. 2026, demandes du propriétaire : « inciter les clients »,
 * puis « design actuel, premium, tout personnalisable »).
 *
 * Charte : une liste (`.lst` + `SettingRow`) des promotions en cours — prestations, fin, badge de la
 * réduction ; toucher = l'arrêter. « Nouvelle promotion » ouvre trois lignes de réglage, chacune dans
 * une fenêtre du bas : les prestations (pastilles), la réduction (% ou DA, choix rapides ET « Autre »),
 * la durée (1 semaine, 2 semaines, 1 mois ET « Autre », en jours).
 */
import { useState } from 'react';
import { CalendarClock, Scissors } from 'lucide-react';
import { useProPromos, useProSalon, useSaveProPromos } from '@salondz/api-client';
import { formatDA, formatDateShortDZ, promoActive, promoLabel, type PromoKind } from '@salondz/constants';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Badge, BottomSheet, Button, Dim, EmptyState, Pill, SectionLabel, SettingRow, TopBar } from '@/components/ui';
import { PageLoading } from '@/components/PageLoading';
import { errorText } from '@/components/ErrorMessage';
import { ValueSheet } from '@/components/ValueSheet';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

type Sheet = null | 'services' | 'reduction' | 'duree' | { stop: string };

export function ProPromos() {
  const salon = useProSalon().data?.salon ?? null;
  const promos = useProPromos();
  const save = useSaveProPromos();
  const [creating, setCreating] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [kind, setKind] = useState<PromoKind>('percent');
  const [value, setValue] = useState(20);
  const [days, setDays] = useState(14);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState<string | null>(null);

  if (!salon || promos.isPending) return <PageLoading />;
  const services = salon.services.filter((s) => s.isActive);
  const list = (promos.data ?? []).filter((p) => promoActive(p) || new Date(p.startsAt) > new Date());
  const nameOf = (id: string) => services.find((s) => s.id === id)?.name ?? '';
  const dureeTxt = days === 7 ? t('1 semaine') : days === 14 ? t('2 semaines') : days === 30 ? t('1 mois') : t('{n} jours', { n: days });

  const launch = async () => {
    setError(null);
    if (chosen.length === 0) {
      setSheet('services');
      return setError(t('Choisissez au moins une prestation.'));
    }
    const now = new Date();
    try {
      await save.mutateAsync([...(promos.data ?? []), { serviceIds: chosen, kind, value, startsAt: now.toISOString(), endsAt: new Date(now.getTime() + days * 86_400_000).toISOString() }]);
      setCreating(false);
      setChosen([]);
    } catch (err) {
      setError(errorText(err));
    }
  };
  const stop = async (id: string) => {
    setSheet(null);
    try {
      await save.mutateAsync((promos.data ?? []).filter((p) => p.id !== id));
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo="/pro/parametres" title={t('Promotions')} />

      {!creating && list.length === 0 && <EmptyState icon={ICONE.promo} title={t('Aucune promotion en cours')} />}
      {!creating && list.length > 0 && (
        <div className="lst">
          {list.map((p) => (
            <SettingRow
              key={p.id}
              icon={ICONE.promo}
              title={p.serviceIds.map(nameOf).filter(Boolean).join(' · ')}
              sub={t('Jusqu’au {date}', { date: formatDateShortDZ(p.endsAt) })}
              onClick={() => setSheet({ stop: p.id })}
              right={<Badge tone="cn" md dot={false}>{promoLabel(p)}</Badge>}
            />
          ))}
        </div>
      )}

      {creating && (
        <>
          <SectionLabel>{t('Nouvelle promotion')}</SectionLabel>
          <div className="lst">
            <SettingRow
              icon={Scissors}
              title={t('Les prestations')}
              sub={chosen.length ? chosen.map(nameOf).join(' · ') : undefined}
              onClick={() => setSheet('services')}
              right={<b className="text-[1rem]">{chosen.length || '—'}</b>}
            />
            <SettingRow icon={ICONE.promo} title={t('La réduction')} onClick={() => setSheet('reduction')} right={<Badge tone="cn" md dot={false}>{promoLabel({ kind, value })}</Badge>} />
            <SettingRow icon={CalendarClock} title={t('Pendant')} onClick={() => setSheet('duree')} right={<b className="text-[1rem]">{dureeTxt}</b>} />
          </div>
        </>
      )}

      {sheet === 'services' && (
        <>
          <Dim onClose={() => setSheet(null)} />
          <BottomSheet modal>
            <div className="h1 !text-[1.429rem]">{t('Les prestations')}</div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('Les prestations')}>
              {services.map((s) => {
                const on = chosen.includes(s.id);
                return (
                  <Pill key={s.id} lg on={on} aria-pressed={on} onClick={() => setChosen((v) => (on ? v.filter((x) => x !== s.id) : [...v, s.id]))}>
                    {s.name} · <span dir="ltr">{formatDA(s.priceDa)}</span>
                  </Pill>
                );
              })}
            </div>
            <Button icon={ICONE.valider} onClick={() => setSheet(null)}>
              {t('Valider')}
            </Button>
          </BottomSheet>
        </>
      )}
      {sheet === 'reduction' && (
        <ValueSheet<PromoKind>
          title={t('La réduction')}
          value={value}
          min={kind === 'percent' ? 1 : 50}
          max={kind === 'percent' ? 90 : 100_000}
          unitLabel={kind === 'percent' ? '%' : 'DA'}
          units={[
            { value: 'percent', label: t('Pourcentage') },
            { value: 'amount', label: t('Montant (DA)') },
          ]}
          unit={kind}
          onUnit={(u) => {
            setKind(u);
            setValue(u === 'percent' ? 20 : 500);
          }}
          choices={(kind === 'percent' ? [10, 20, 30] : [200, 500, 1000]).map((n) => ({ value: n, label: kind === 'percent' ? `−${n} %` : `−${formatDA(n)}` }))}
          onClose={() => setSheet(null)}
          onDone={(n) => {
            setValue(n);
            setSheet(null);
          }}
        />
      )}
      {sheet === 'duree' && (
        <ValueSheet
          title={t('Pendant')}
          value={days}
          min={1}
          max={90}
          unitLabel={t('jours')}
          choices={[
            { value: 7, label: t('1 semaine') },
            { value: 14, label: t('2 semaines') },
            { value: 30, label: t('1 mois') },
          ]}
          onClose={() => setSheet(null)}
          onDone={(n) => {
            setDays(n);
            setSheet(null);
          }}
        />
      )}
      {sheet && typeof sheet === 'object' && (
        <>
          <Dim onClose={() => setSheet(null)} />
          <BottomSheet modal>
            <div className="h1 !text-[1.429rem]">{t('Arrêter cette promotion ?')}</div>
            <Button icon={ICONE.supprimer} variant="d" onClick={() => void stop(sheet.stop)} loading={save.isPending}>
              {t('Arrêter la promotion')}
            </Button>
            <Button icon={ICONE.garder} variant="g" onClick={() => setSheet(null)}>
              {t('Garder')}
            </Button>
          </BottomSheet>
        </>
      )}

      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <BottomSheet>
        {creating ? (
          <div className="flex gap-2.5">
            <Button icon={ICONE.fermerFenetre} variant="g" auto onClick={() => setCreating(false)}>
              {t('Annuler')}
            </Button>
            <Button icon={ICONE.publier} className="flex-1" onClick={() => void launch()} loading={save.isPending}>
              {t('Lancer la promotion')}
            </Button>
          </div>
        ) : (
          <Button icon={ICONE.ajouter} onClick={() => setCreating(true)}>
            {t('Nouvelle promotion')}
          </Button>
        )}
      </BottomSheet>
    </Screen>
  );
}
