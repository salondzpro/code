/**
 * AMBIANCE « POUR FEMMES » (26 nov. 2026, demande du propriétaire) : à l'arrivée sur la place de
 * marché côté femmes (ou au passage vers ce côté), un voile de verre rose très léger s'allume
 * DERRIÈRE le contenu — trois halos du rose de l'espace féminin (`--color-women`) qui dérivent
 * lentement et un reflet qui traverse — puis s'efface. 5 s en tout, puis le calque est retiré.
 * Jamais devant le contenu ni sous le doigt (`pointer-events: none`) ; rien sous
 * `prefers-reduced-motion` (CSS). Styles : `.amb-f*` en fin de `styles/claude.css`.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const DUREE_MS = 5000;

export function AmbianceFemmes({ actif }: { actif: boolean }) {
  // Un numéro par apparition : repasser côté femmes rejoue l'animation depuis le début.
  const [tour, setTour] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!actif) {
      setVisible(false);
      return;
    }
    setTour((n) => n + 1);
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), DUREE_MS + 100);
    return () => window.clearTimeout(id);
  }, [actif]);
  // Le cadre de l'application et <body> sont peints en blanc : pendant l'effet seulement, ils
  // deviennent transparents pour laisser voir le voile, posé sur le fond de <html> (même couleur).
  useEffect(() => {
    if (!visible) return;
    const html = document.documentElement;
    html.classList.add('amb-f-on');
    return () => html.classList.remove('amb-f-on');
  }, [visible]);
  if (!visible) return null;
  // Dans <body> : aucun conteneur de la page ne peut le recouvrir ni le découper.
  return createPortal(
    <div key={tour} className="amb-f" aria-hidden>
      <i className="amb-f-h h1" />
      <i className="amb-f-h h2" />
      <i className="amb-f-h h3" />
      <i className="amb-f-reflet" />
    </div>,
    document.body,
  );
}
