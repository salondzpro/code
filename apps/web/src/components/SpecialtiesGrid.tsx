/**
 * Grille des spécialités d'un marché (ongles, cheveux, cils, sourcils… ou cheveux, barbe, lissage, soins…) :
 * cases à choix multiple, au plus MAX_SPECIALTIES. Inscription (étape 1) et Mon salon → Spécialités.
 */
import { Brush, Check, Droplets, Eye, Feather, Flower2, Hand, Palette, Scissors, Sparkles, Wand2, Zap, type LucideIcon } from 'lucide-react';
import { categoriesForMarket, type CategoryDef, type Market } from '@salondz/constants';
import { I } from '@/components/ui';
import { t } from '@/i18n';

const ICONS: Record<string, LucideIcon> = { scissors: Scissors, wand: Wand2, palette: Palette, sparkles: Sparkles, brush: Brush, hand: Hand, eye: Eye, flower: Flower2, zap: Zap, feather: Feather, droplets: Droplets };
export const MAX_SPECIALTIES = 6;

/** Spécialités proposables à un salon : celles de son marché, les deux marchés pour un salon mixte. */
export function specialtiesFor(target: Market | 'unisex'): CategoryDef[] {
  return target === 'unisex' ? [...categoriesForMarket('women'), ...categoriesForMarket('men')] : categoriesForMarket(target);
}

export function SpecialtiesGrid({ items, chosen, onChange }: { items: CategoryDef[]; chosen: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) =>
    onChange(chosen.includes(id) ? chosen.filter((x) => x !== id) : chosen.length >= MAX_SPECIALTIES ? chosen : [...chosen, id]);
  return (
    <div className="g2">
      {items.map((c) => {
        const on = chosen.includes(c.id);
        const Icon = ICONS[c.icon] ?? Sparkles;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            aria-pressed={on}
            className={`relative flex min-h-[5.5rem] flex-col items-start gap-2 rounded-[var(--radius-card)] border p-3.5 text-start transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-line bg-surface'}`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${on ? 'bg-white/15' : 'bg-fill'}`}>
              <I icon={Icon} size={18} />
            </span>
            <span className="text-[1rem] font-semibold leading-tight">{t(c.labelFr)}</span>
            {on && (
              <span className="absolute end-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-ink">
                <I icon={Check} size={12} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
