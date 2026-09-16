/** PRO-F 03 — Étape 1 : « Pour qui travaillez-vous ? » — le marché définit le catalogue et la marketplace. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import { MARKET_LABELS_FR, categoriesForMarket, type Market } from '@salondz/constants';
import { DESIGN_IMAGES } from '@/lib/authFlow';
import { readProDraft, writeProDraft } from '@/lib/proDraft';
import { I } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { StepBar, StepSheet, StepTitle, stepPath } from './Shared';
import { t } from '@/i18n';

const CARDS: { id: Market; img: string }[] = [
  { id: 'men', img: DESIGN_IMAGES.marketMen.src },
  { id: 'women', img: DESIGN_IMAGES.marketWomen.src },
];

export function Step1Market() {
  const navigate = useNavigate();
  const [market, setMarket] = useState<Market | undefined>(readProDraft().market);
  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={1} backTo="/pro/bienvenue" />
      <StepTitle sub={t("Ce choix définit votre catalogue de prestations et la marketplace dans laquelle vous apparaissez.")}>
        {t("Pour qui travaillez-vous ?")}
      </StepTitle>
      {CARDS.map((c) => {
        const on = market === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => setMarket(c.id)}
            aria-pressed={on}
            className={`relative h-[9.5rem] w-full overflow-hidden rounded-[var(--radius-card)] text-left transition-[box-shadow,opacity] ${on ? 'ring-2 ring-ink ring-offset-2 ring-offset-bg' : market ? 'opacity-70' : ''}`}
          >
            <img src={c.img} alt="" className="h-full w-full object-cover" />
            <div className="ovl" />
            <span
              className={`absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border-2 ${on ? 'border-white bg-white text-ink' : 'border-white/70 text-transparent'}`}
              aria-hidden
            >
              <I icon={Check} size={18} />
            </span>
            <div className="ovl-t">
              <div className="text-[1.429rem] font-bold leading-[1.1] tracking-[-0.6px]">{t(MARKET_LABELS_FR[c.id])}</div>
              <div className="mt-1 text-[0.857rem] leading-[1.35] text-white/85">
                {categoriesForMarket(c.id)
                  .slice(0, c.id === 'men' ? 5 : 4)
                  .map((x) => t(x.labelFr))
                  .join(' · ')}
              </div>
            </div>
          </button>
        );
      })}
      <StepSheet
        disabled={!market}
        hint={t("Modifiable ensuite depuis Mon salon.")}
        onClick={() => {
          writeProDraft({ market });
          navigate(stepPath(2));
        }}
      />
    </Screen>
  );
}
