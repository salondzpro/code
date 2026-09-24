import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Wordmark } from './Wordmark';
import { t } from '@/i18n';
/** Logo « Salon DZ » (même wordmark que le splash, en encre sur fond clair) en pied des pages Profil client et pro. */
export function BrandFooter() {
  const year = new Date().getFullYear();
  // Version de l'APPLICATION installée, jamais affichée sur le site. Sans elle, impossible de savoir
  // au téléphone quelle version tourne — on a perdu des heures à commenter des écrans d'une version
  // précédente en croyant regarder la nouvelle.
  const [build, setBuild] = useState<string | null>(null);
  useEffect(() => {
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    void import('@capacitor/app')
      .then(({ App }) => App.getInfo())
      .then((info) => setBuild(`${info.version} (${info.build})`))
      .catch(() => undefined);
  }, []);
  return (
    <div className="mt-6 flex flex-col items-center gap-1.5 pb-2 text-center" aria-label={t("Salon DZ")}>
      <Wordmark size={1.714} className="!tracking-[-0.9px]" />
      <div className="mono text-[0.857rem] tracking-[0.26em] text-subtle">{t("RÉSERVATION EN LIGNE")}</div>
      <div className="text-[0.857rem] text-subtle">© {year} {t("Salon DZ · Fait en Algérie")}</div>
      {build && <div className="text-[0.857rem] text-subtle">{t("Application")} {build}</div>}
      <nav className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[0.857rem] text-muted" aria-label={t("Informations légales")}>
        <Link to="/cgu">{t("CGU")}</Link>
        <Link to="/confidentialite">{t("Confidentialité")}</Link>
        <Link to="/aide">{t("Aide")}</Link>
      </nav>
    </div>
  );
}
