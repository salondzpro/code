export function Spinner({ label = 'Chargement…', inline = false }: { label?: string; inline?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={inline ? 'inline-flex items-center gap-2 text-muted' : 'flex items-center justify-center gap-3 py-12 text-muted'}>
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-primary" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
