/**
 * PROMOTIONS SUR LES PRESTATIONS (18 nov. 2026, demande du propriétaire : « inciter les clients »).
 *
 * En haut : les promotions en cours (prestations, réduction, fin), chacune se retire d'un toucher.
 * « Nouvelle promotion » : 1. les prestations (puces), 2. la réduction (choix tout prêts), 3. la durée
 * (1 semaine, 2 semaines, 1 mois) — puis « Lancer ». Un tag s'affiche aussitôt sur la carte du salon et
 * sur les prestations concernées, côté clients.
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { useProPromos, useProSalon, useSaveProPromos } from '@salondz/api-client';
import { PROMO_DURATIONS, PROMO_PRESETS, formatDA, formatDateShortDZ, promoActive, promoLabel, promoPrice, type PromoKind } from '@salondz/constants';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { BottomSheet, Button, EmptyState, I, SectionLabel, TopBar } from '@/components/ui';
import { PageLoading } from '@/components/PageLoading';
import { errorText } from '@/components/ErrorMessage';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

export function ProPromos() {
  const salon = useProSalon().data?.salon ?? null;
  const promos = useProPromos();
  const save = useSaveProPromos();
  const [creating, setCreating] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [reduc, setReduc] = useState<{ kind: PromoKind; value: number }>({ kind: 'percent', value: 20 });
  const [days, setDays] = useState<number>(14);
  const [error, setError] = useState<string | null>(null);

  if (!salon || promos.isPending) return <PageLoading />;
  const services = salon.services.filter((s) => s.isActive);
  const list = (promos.data ?? []).filter((p) => promoActive(p) || new Date(p.startsAt) > new Date());
  const nameOf = (id: string) => services.find((s) => s.id === id)?.name ?? '';

  const launch = async () => {
    setError(null);
    if (chosen.length === 0) return setError(t('Choisissez au moins une prestation.'));
    const now = new Date();
    const end = new Date(now.getTime() + days * 86_400_000);
    try {
      await save.mutateAsync([...(promos.data ?? []), { serviceIds: chosen, kind: reduc.kind, value: reduc.value, startsAt: now.toISOString(), endsAt: end.toISOString() }]);
      setCreating(false);
      setChosen([]);
    } catch (err) {
      setError(errorText(err));
    }
  };
  const remove = (id: string) => void save.mutateAsync((promos.data ?? []).filter((p) => p.id !== id)).catch((err) => setError(errorText(err)));

  return (
    <Screen bottom={SHEET_PAD} gap={14}>
      <TopBar backTo="/pro/parametres" title={t('Promotions')} />

      {!creating && list.length === 0 && (
        <EmptyState icon={ICONE.promo} title={t('Aucune promotion en cours')} />
      )}
      {!creating &&
        list.map((p) => (
          <div key={p.id} className="crd !gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="promo-tag">{promoLabel(p)}</span>
              <span className="text-[0.857rem] text-muted">{t('Jusqu’au {date}', { date: formatDateShortDZ(p.endsAt) })}</span>
            </div>
            <b className="text-[1rem] font-semibold">{p.serviceIds.map(nameOf).filter(Boolean).join(' · ')}</b>
            <Button icon={ICONE.supprimer} variant="g" sm auto onClick={() => remove(p.id)} disabled={save.isPending}>
              {t('Arrêter')}
            </Button>
          </div>
        ))}

      {creating && (
        <>
          <SectionLabel>{t('Les prestations')}</SectionLabel>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Les prestations')}>
            {services.map((s) => {
              const on = chosen.includes(s.id);
              return (
                <button key={s.id} type="button" aria-pressed={on} className={`pill lg ${on ? 'on' : ''}`} onClick={() => setChosen((v) => (on ? v.filter((x) => x !== s.id) : [...v, s.id]))}>
                  {s.name}
                </button>
              );
            })}
          </div>

          <SectionLabel>{t('La réduction')}</SectionLabel>
          <div className="dp-presets" role="radiogroup" aria-label={t('La réduction')}>
            {PROMO_PRESETS.map((r) => {
              const sel = reduc.kind === r.kind && reduc.value === r.value;
              const ex = chosen[0] ? services.find((s) => s.id === chosen[0]) : null;
              return (
                <button key={`${r.kind}${r.value}`} type="button" role="radio" aria-checked={sel} className={`dp-tile${sel ? ' on' : ''}`} onClick={() => setReduc(r)}>
                  {sel && <I icon={Check} size={14} strokeWidth={2.6} className="dp-tile-ok" />}
                  <b dir="ltr">{promoLabel(r)}</b>
                  {ex && <small dir="ltr">{formatDA(promoPrice(ex.priceDa, r))}</small>}
                </button>
              );
            })}
          </div>

          <SectionLabel>{t('Pendant')}</SectionLabel>
          <div className="dp-presets" role="radiogroup" aria-label={t('Pendant')}>
            {PROMO_DURATIONS.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={days === d} className={`dp-tile${days === d ? ' on' : ''}`} onClick={() => setDays(d)}>
                {days === d && <I icon={Check} size={14} strokeWidth={2.6} className="dp-tile-ok" />}
                <b>{d === 30 ? t('1 mois') : d === 7 ? t('1 semaine') : t('2 semaines')}</b>
              </button>
            ))}
          </div>
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
