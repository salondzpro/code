/** Logo « Salon DZ » (même wordmark que le splash, en encre sur fond clair) en pied des pages Profil client et pro. */
export function BrandFooter() {
  const year = new Date().getFullYear();
  return (
    <div className="mt-6 flex flex-col items-center gap-1.5 pb-2 text-center" aria-label="Salon DZ">
      <div className="text-[1.5rem] leading-none tracking-[-0.9px]">
        <span className="font-semibold">Salon</span>
        <span className="ml-[0.16em] font-light text-muted">DZ</span>
      </div>
      <div className="mono text-[0.625rem] tracking-[0.26em] text-subtle">RÉSERVATION EN LIGNE</div>
      <div className="text-[0.75rem] text-subtle">© {year} Salon DZ · Fait en Algérie</div>
    </div>
  );
}
