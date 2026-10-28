/**
 * Sélecteur de langue (28 oct. 2026) : un bouton « drapeau + langue » qui OUVRE une liste, et la
 * referme au choix, au toucher ailleurs ou à Échap. Il remplace les trois pastilles FR · ع · EN :
 * une abréviation se devine, un drapeau et un nom se reconnaissent.
 *
 * Les drapeaux sont dessinés en SVG : les drapeaux émoji ne s'affichent pas sous Windows (on y lit
 * « FR », « DZ »). L'arabe porte le drapeau ALGÉRIEN — c'est l'arabe de nos clients.
 *
 * La liste s'ouvre vers l'INTÉRIEUR de l'écran : ancrée au bord « fin » du bouton (à droite en
 * français, à gauche en arabe), bornée à la largeur de l'écran.
 */
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { LOCALES, switchLocale, useLocale, type Locale } from '@/i18n';
import { I } from './ui';

/** `tone="light"` : sur fond clair (écrans d'authentification). Par défaut, sur photo ou fond sombre. */
export function LangSwitch({ className = '', tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  const [locale] = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = LOCALES.find((l) => l.value === locale) ?? LOCALES[0]!;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <div ref={root} className={`lng ${tone === 'light' ? 'light' : ''} ${className}`}>
      <button
        type="button"
        className="lng-b"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Langue : ${current.label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Flag l={current.value} />
        <span className="lng-n">{current.label}</span>
        <I icon={ChevronDown} size={15} className={`lng-c ${open ? 'on' : ''}`} />
      </button>
      {open && (
        <ul className="lng-m" role="listbox" aria-label="Langue">
          {LOCALES.map((l) => (
            <li key={l.value}>
              <button
                type="button"
                role="option"
                aria-selected={l.value === locale}
                className={l.value === locale ? 'on' : ''}
                onClick={() => {
                  setOpen(false);
                  if (l.value !== locale) switchLocale(l.value);
                }}
              >
                <Flag l={l.value} />
                <span className="flex-1 text-start" dir={l.dir}>
                  {l.label}
                </span>
                {l.value === locale && <I icon={Check} size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Drapeaux simplifiés, lisibles à 20 px. */
function Flag({ l }: { l: Locale }) {
  return (
    <svg className="lng-f" viewBox="0 0 30 20" width="22" height="15" aria-hidden>
      {l === 'fr' && (
        <>
          <rect width="10" height="20" fill="#0055A4" />
          <rect x="10" width="10" height="20" fill="#fff" />
          <rect x="20" width="10" height="20" fill="#EF4135" />
        </>
      )}
      {l === 'ar' && (
        <>
          <rect width="15" height="20" fill="#006233" />
          <rect x="15" width="15" height="20" fill="#fff" />
          <circle cx="15" cy="10" r="5.2" fill="#D21034" />
          <circle cx="16.6" cy="10" r="4.2" fill="#fff" />
          <path d="M18.2 7.6l.62 1.9h2l-1.62 1.18.62 1.9-1.62-1.18-1.62 1.18.62-1.9-1.62-1.18h2z" fill="#D21034" />
        </>
      )}
      {l === 'en' && (
        <>
          <rect width="30" height="20" fill="#012169" />
          <path d="M0 0l30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
          <path d="M0 0l30 20M30 0L0 20" stroke="#C8102E" strokeWidth="1.6" />
          <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
          <path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth="3.4" />
        </>
      )}
    </svg>
  );
}
