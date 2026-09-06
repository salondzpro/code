/** AUTH 01 — Splash : logo « Salon DZ » sur fond encre, barre de chargement. */
export function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink text-white" role="status" aria-label="Chargement">
      <div className="text-center">
        <div className="text-[40px] leading-none tracking-[-1.2px]">
          <span className="font-semibold">Salon</span>
          <span className="ml-[0.16em] font-light text-white/70">DZ</span>
        </div>
        <div className="mono mt-2.5 text-[11px] tracking-[0.26em] text-white/40">RÉSERVATION BEAUTÉ</div>
      </div>
      <div className="absolute bottom-16 h-[3px] w-[120px] overflow-hidden rounded-sm bg-white/15">
        <div className="h-full w-16 bg-white" style={{ animation: 'shim 1.2s linear infinite' }} />
      </div>
    </div>
  );
}
