/**
 * Logo « Salon DZ », en UN SEUL endroit (règle « zéro doublon »). Depuis le 26 nov. 2026 (demande du
 * propriétaire) c'est EXACTEMENT le logo de l'icône de l'application iPhone : « Salon » en Inter 600,
 * « DZ » en Inter 400 gris, serrés. Encre sur fond clair, blanc sur fond foncé (`light`). Style :
 * `.sdz-logo` en fin de `styles/claude.css`. Icônes (écran d'accueil, appli web, Pro) : `public/logo/`,
 * `apple-touch-icon.png`, `icon-*.png` — même dessin ; l'icône d'onglet garde le « S » seul (16 px).
 */
export function Wordmark({
  size = 1.429,
  className = '',
  light = false,
}: {
  size?: number;
  className?: string;
  /** Posé sur une photo ou un fond sombre. */
  light?: boolean;
}) {
  return (
    // La marque s'écrit de gauche à droite dans toutes les langues.
    <span dir="ltr" className={`sdz-logo${light ? ' light' : ''} ${className}`} style={{ fontSize: `${size}rem` }}>
      <b>Salon</b>
      <i>DZ</i>
    </span>
  );
}
