/** PRO-F 03 — Étape 1 : « Vous travaillez pour ? » — le marché définit le catalogue et la marketplace. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import { MARKET_LABELS_FR, categoriesForMarket, type Market } from '@salondz/constants';
import { DESIGN_IMAGES } from '@/lib/authFlow';
import { readProDraft, writeProDraft } from '@/lib/proDraft';
import { I } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { StepBar, StepSheet, stepPath } from './Shared';

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
      <div>
        <h1 className="h1">Vous travaillez pour ?</h1>
        <p className="p mt-3">Ce choix définit votre catalogue de prestations et la marketplace dans laquelle vous apparaissez.</p>
      </div>
      {CARDS.map((c) => (
        <button key={c.id} type="button" onClick={() => setMarket(c.id)} aria-pressed={market === c.id} className={`relative h-[210px] w-full overflow-hidden rounded-[24px] text-left ${market === c.id ? 'ring-2 ring-ink' : ''}`}>
          <img src={c.img} alt="" className="h-full w-full object-cover" />
          <div className="ovl" />
          {market === c.id && (
            <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink">
              <I icon={Check} size={20} />
            </span>
          )}
          <div className="ovl-t">
            <div className="text-[26px] font-bold leading-[1.1] tracking-[-0.6px]">{MARKET_LABELS_FR[c.id]}</div>
            <div className="mt-1 text-[14px] leading-[1.35] text-white/85">
              {categoriesForMarket(c.id)
                .slice(0, c.id === 'men' ? 5 : 4)
                .map((x) => x.labelFr)
                .join(' · ')}
            </div>
          </div>
        </button>
      ))}
      <StepSheet
        disabled={!market}
        onClick={() => {
          writeProDraft({ market });
          navigate(stepPath(2));
        }}
      />
    </Screen>
  );
}
