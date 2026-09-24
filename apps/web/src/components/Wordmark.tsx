/**
 * Logo « Salon DZ », en UN SEUL endroit. Il apparaît dans l'en-tête de la place de marché, en pied des
 * pages de compte, dans l'animation d'ouverture de l'application et en tête des pages de connexion :
 * ces quatre emplacements doivent montrer exactement la même chose, sinon la marque se délite.
 *
 * `Salon` en demi-gras, `DZ` en maigre et gris : c'est la graphie de référence, celle de l'icône de
 * l'application et de l'affiche QR.
 */
export function Wordmark({ size = 1.429, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`leading-none tracking-[-0.6px] ${className}`} style={{ fontSize: `${size}rem` }}>
      <span className="font-semibold">Salon</span>
      <span className="ms-[0.16em] font-light text-muted">DZ</span>
    </span>
  );
}
