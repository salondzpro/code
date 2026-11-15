/**
 * INSCRIPTION PRO EN 3 ÉCRANS (15 nov. 2026, demande du propriétaire : « droit au but, pré-remplis le
 * reste »). Écran 1 sur 3 : « Votre salon » — pour qui (Hommes / Femmes, deux tuiles) ET le nom, avec
 * le lien de réservation vérifié en direct. Plus de question « spécialités » : toutes celles du marché
 * sont prises d'office (au plus 6), modifiables ensuite dans Mon salon. Suite : l'adresse (écran 2),
 * puis les prestations pré-remplies (écran 3) et la mise en ligne.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Store } from 'lucide-react';
import { useApi } from '@salondz/api-client';
import { MARKET_LABELS_FR, SERVICE_TEMPLATES, categoriesForMarket, type Market } from '@salondz/constants';
import { DESIGN_IMAGES } from '@/lib/authFlow';
import { readProDraft, writeProDraft } from '@/lib/proDraft';
import { Badge, Field, I, Input } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { StepBar, StepSheet, StepTitle, stepPath } from './Shared';
import { env } from '@/lib/env';
import { t } from '@/i18n';

const CARDS: { id: Market; img: string }[] = [
  { id: 'men', img: DESIGN_IMAGES.marketMen.src },
  { id: 'women', img: DESIGN_IMAGES.marketWomen.src },
];

/** Spécialités prises d'office : celles du marché qui ont des prestations types, au plus 6. */
export function defaultSpecialties(market: Market): string[] {
  const cats = categoriesForMarket(market);
  const withTpl = cats.filter((c) => (SERVICE_TEMPLATES[c.id as keyof typeof SERVICE_TEMPLATES] ?? []).length > 0);
  return (withTpl.length ? withTpl : cats).slice(0, 6).map((c) => c.id);
}

export function Step1Market() {
  const navigate = useNavigate();
  const { api } = useApi();
  const draft = readProDraft();
  const [market, setMarket] = useState<Market | undefined>(draft.market);
  const [name, setName] = useState(draft.name ?? '');
  const [check, setCheck] = useState<{ slug: string; available: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const host = env.siteUrl.replace(/^https?:\/\/(www\.)?/, '');

  useEffect(() => {
    const v = name.trim();
    if (v.length < 2) return setCheck(null);
    setChecking(true);
    const timer = setTimeout(() => {
      api.pro
        .slugCheck(v)
        .then((r) => setCheck(r))
        .catch(() => setCheck(null))
        .finally(() => setChecking(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [name, api]);

  const taken = !!check && !check.available && !checking;
  const ready = !!market && name.trim().length >= 2 && !taken;

  return (
    <Screen bottom={SHEET_PAD} gap={14}>
      <StepBar step={1} backTo="/pro/bienvenue" />
      <StepTitle icon={Store}>
        {t('Votre salon')}
      </StepTitle>

      <div className="obm" role="radiogroup" aria-label={t('Pour qui travaillez-vous ?')}>
        {CARDS.map((c) => {
          const on = market === c.id;
          return (
            <button key={c.id} type="button" role="radio" aria-checked={on} className={`obm-c${on ? ' on' : ''}`} onClick={() => setMarket(c.id)}>
              <img src={c.img} alt="" />
              <span className="obm-v" />
              {on && (
                <span className="obm-ok" aria-hidden>
                  <I icon={Check} size={16} strokeWidth={2.6} />
                </span>
              )}
              <b>{t(MARKET_LABELS_FR[c.id])}</b>
            </button>
          );
        })}
      </div>

      <Field label={t('Nom du salon')} htmlFor="salon-name">
        <Input id="salon-name" lg className={name ? 'f' : ''} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t('Salon Sarah')} />
      </Field>
      {check && (
        <div className="flex items-center gap-2 px-1">
          <span className="min-w-0 flex-1 truncate text-[0.929rem] text-muted" dir="ltr">
            {host}/{check.slug}
          </span>
          <Badge tone={taken ? 'cn' : 'ok'} md>
            {checking ? t('Vérification…') : taken ? t('Déjà pris') : t('Disponible')}
          </Badge>
        </div>
      )}

      <StepSheet
        disabled={!ready}
        onClick={() => {
          writeProDraft({ market, name: name.trim(), categoryIds: defaultSpecialties(market!) });
          navigate(stepPath(4));
        }}
      />
    </Screen>
  );
}
