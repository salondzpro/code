import { useEffect } from 'react';
import { t } from '@/i18n';

/** AUTH 01 — Splash : logo « Salon DZ » sur fond encre, barre de chargement. */
export function Splash() {
  /**
   * Le bandeau qui masque la barre d'état vit sur `body` (voir `body::before` dans index.css) : une
   * variable posée ici ne l'atteindrait pas, les propriétés CSS descendent mais ne remontent pas.
   * On l'accorde donc sur la racine le temps de l'écran d'ouverture, sinon une bande claire coupe
   * le haut de ce fond d'encre. Remise à sa valeur d'origine en sortant, quelle que soit la sortie.
   */
  useEffect(() => {
    const racine = document.documentElement;
    racine.style.setProperty('--bar-top-bg', 'var(--color-ink)');
    return () => {
      racine.style.removeProperty('--bar-top-bg');
    };
  }, []);

  return (
    <div className="flex h-app flex-col items-center justify-center bg-ink text-white" role="status" aria-label={t("Chargement")}>
      <div className="text-center">
        <div className="text-[2.286rem] leading-none tracking-[-1.2px]">
          <span className="font-semibold">{t("Salon")}</span>
          <span className="ms-[0.16em] font-light text-white/70">{t("DZ")}</span>
        </div>
        <div className="mono mt-2.5 text-[0.857rem] tracking-[0.26em] text-white/40">{t("RÉSERVATION EN LIGNE")}</div>
      </div>
      <div className="absolute bottom-16 h-[0.1875rem] w-[7.5rem] overflow-hidden rounded-sm bg-white/15">
        <div className="h-full w-16 bg-white" style={{ animation: 'shim 1.2s linear infinite' }} />
      </div>
    </div>
  );
}
