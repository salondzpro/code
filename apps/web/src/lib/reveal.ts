/**
 * Apparitions au défilement, sans dépendance et sans coût.
 *
 * Un seul `IntersectionObserver` pour toute la page : il pose la classe `.in` sur chaque élément
 * marqué `data-reveal` quand il entre dans l'écran, puis CESSE de l'observer. Pas d'écoute du
 * défilement, pas de calcul par image — le navigateur fait le travail, l'animation vit en CSS.
 *
 * `prefers-reduced-motion` est respecté : les personnes qui ont demandé moins d'animations voient
 * la page complète d'emblée. Ce n'est pas un détail de confort, c'est un réglage d'accessibilité
 * que certaines personnes activent pour des raisons médicales.
 */
import { useEffect } from 'react';

export function useReveal(): void {
  useEffect(() => {
    const cibles = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!cibles.length) return;

    const sobre = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sobre || typeof IntersectionObserver === 'undefined') {
      for (const el of cibles) el.classList.add('in');
      return;
    }

    const obs = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          obs.unobserve(e.target); // une apparition ne se rejoue pas : on relâche tout de suite
        }
      },
      // Déclenché un peu AVANT le bord bas : l'élément est déjà en place quand le regard l'atteint.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    for (const el of cibles) obs.observe(el);
    return () => obs.disconnect();
  }, []);
}
