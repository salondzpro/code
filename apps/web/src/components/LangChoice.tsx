/**
 * CHOIX DE LA LANGUE AU PREMIER LANCEMENT DE L'APPLICATION (14 nov. 2026, demande du propriétaire),
 * côté client comme côté pro. Montré une seule fois, avant l'écran d'ouverture ; le choix est gardé
 * sur l'appareil (`chooseLocale`) jusqu'à ce qu'on le change dans les réglages (`LangSwitch`).
 *
 * Même facture que l'ouverture (`.pwo-*`) : photo floutée qui dérive, halos, voile clair. Le titre
 * est écrit dans les trois langues — on ne sait pas encore laquelle la personne lit. La langue
 * détectée sur le téléphone est présélectionnée ; un toucher la change, « Continuer » l'enregistre.
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { LOCALES, chooseLocale, getLocale, type Locale } from '@/i18n';
import { HeroSlides } from './HeroSlides';
import { Flag } from './LangSwitch';
import { Wordmark } from './Wordmark';
import { I } from './ui';
import { ICONE } from '@/lib/actionIcons';

const CONTINUER: Record<Locale, string> = { fr: 'Continuer', ar: 'متابعة', en: 'Continue' };

export function LangChoice({ photos, pro = false, onDone }: { photos: string[]; pro?: boolean; onDone: () => void }) {
  const [choix, setChoix] = useState<Locale>(getLocale());
  const valider = () => {
    // Même langue que celle déjà affichée : rien à recharger, on passe à l'ouverture.
    if (!chooseLocale(choix)) onDone();
  };

  return (
    <div className="pwo pwo-anim lgc h-app" dir="ltr">
      <div className="pwo-ph" aria-hidden>
        <HeroSlides photos={photos} intervalle={7000} />
      </div>
      <span className="pwo-aura" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="pwo-voile" aria-hidden />

      <header className="pwo-bar">
        <span className="flex items-center gap-2">
          <Wordmark size={1.143} light />
          {pro && <span className="aph-pro">PRO</span>}
        </span>
      </header>

      <main className="pwo-copy">
        <p className="pwo-k">Langue · اللغة · Language</p>
        <h1 className="pwo-t lgc-t">
          <span className="pwo-mot" style={{ animationDelay: '0.25s' }}>
            Choisissez votre langue
          </span>
        </h1>
        <p className="pwo-s lgc-s">
          <span dir="rtl">اختر لغتك</span> · Choose your language
        </p>
      </main>

      <footer className="pwo-bas">
        <div className="lgc-l" role="radiogroup" aria-label="Langue">
          {LOCALES.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={choix === l.value}
              className={`lgc-o ${choix === l.value ? 'on' : ''}`}
              onClick={() => setChoix(l.value)}
            >
              <Flag l={l.value} />
              <span className="lgc-n" dir={l.dir}>
                {l.label}
              </span>
              <span className="lgc-r" aria-hidden>
                {choix === l.value && <I icon={Check} size={14} strokeWidth={3} />}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="pa-btn pwo-cta" onClick={valider}>
          <I icon={ICONE.continuer} size={18} className={choix === 'ar' ? '-scale-x-100' : ''} />
          <span dir={LOCALES.find((l) => l.value === choix)?.dir}>{CONTINUER[choix]}</span>
        </button>
      </footer>
    </div>
  );
}
