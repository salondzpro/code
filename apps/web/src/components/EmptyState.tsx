import type { ReactNode } from 'react';

/** Écran vide — l'illustration viendra du design (slot `illustration`). */
export function EmptyState({
  title,
  description,
  action,
  illustration,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-5 py-6 text-center">
      {illustration ?? <div aria-hidden className="h-16 w-16 rounded-full bg-accent/20" />}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}
