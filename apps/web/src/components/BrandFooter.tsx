import { t } from '@/i18n';
/** Logo « Salon DZ » (même wordmark que le splash, en encre sur fond clair) en pied des pages Profil client et pro. */
export function BrandFooter() {
  const year = new Date().getFullYear();
  return (
    <div className="mt-6 flex flex-col items-center gap-1.5 pb-2 text-center" aria-label={t("Salon DZ")}>
      <div className="text-[1.714rem] leading-none tracking-[-0.9px]">
        <span className="font-semibold">Salon</span>
        <span className="ml-[0.16em] font-light text-muted">DZ</span>
      </div>
      <div className="mono text-[0.857rem] tracking-[0.26em] text-subtle">{t("RÉSERVATION EN LIGNE")}</div>
      <div className="text-[0.857rem] text-subtle">© {year} {t("Salon DZ · Fait en Algérie")}</div>
    </div>
  );
}
