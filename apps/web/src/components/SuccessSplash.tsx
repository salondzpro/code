/**
 * Écran de validation animé (cercle vert qui s'ouvre, coche, titre qui monte) après une action réussie
 * (ex. : rendez-vous ajouté par le pro). Avec `actions`, l'écran attend le choix ; sinon, suite
 * automatique, ou d'un tap pour ne pas attendre.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { I } from './ui';

export function SuccessSplash({
  title,
  subtitle,
  onDone,
  actions,
  duration = 1500,
}: {
  title: string;
  subtitle?: string;
  onDone?: () => void;
  /** Petits boutons sous le message. */
  actions?: ReactNode;
  /** Durée d'affichage avant la suite automatique (ms). */
  duration?: number;
}) {
  const done = useRef(onDone);
  done.current = onDone;
  const fired = useRef(false);
  const fire = () => {
    if (fired.current) return;
    fired.current = true;
    done.current?.();
  };
  useEffect(() => {
    if (actions) return;
    const t = window.setTimeout(fire, duration);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);
  return (
    <div
      className="anim-fade fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-surface px-6 text-center"
      role="status"
      aria-live="polite"
      onClick={actions ? undefined : fire}
      data-testid="success-splash"
    >
      <div className="anim-pop flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-ok-bg text-ok-fg">
        <I icon={Check} size={64} />
      </div>
      <h1 className="h1 anim-rise">{title}</h1>
      {subtitle && <p className="p anim-rise text-[1rem]">{subtitle}</p>}
      {actions && <div className="anim-rise mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
