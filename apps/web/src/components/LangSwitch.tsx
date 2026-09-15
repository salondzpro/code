/**
 * Sélecteur de langue compact (FR · AR · EN) pour les écrans d'entrée, avant connexion :
 * un visiteur arabophone ou anglophone doit pouvoir basculer dès le premier écran.
 */
import { LOCALES, switchLocale, useLocale } from '@/i18n';

const SHORT: Record<string, string> = { fr: 'FR', ar: 'ع', en: 'EN' };

export function LangSwitch({ className = '' }: { className?: string }) {
  const [locale] = useLocale();
  return (
    <div
      className={`flex items-center gap-0.5 rounded-[var(--radius-pill)] bg-black/45 p-0.5 backdrop-blur ${className}`}
      role="radiogroup"
      aria-label="Langue"
    >
      {LOCALES.map((l) => (
        <button
          key={l.value}
          type="button"
          role="radio"
          aria-checked={locale === l.value}
          aria-label={l.label}
          onClick={() => switchLocale(l.value)}
          className={`min-w-[2.25rem] rounded-[var(--radius-pill)] px-2 py-1 text-[0.857rem] font-semibold ${locale === l.value ? 'bg-white text-ink' : 'text-white/85'}`}
        >
          {SHORT[l.value]}
        </button>
      ))}
    </div>
  );
}
