/** Devise unique de l'application : Dinar Algérien. Jamais d'euros. */
export const CURRENCY_CODE = 'DZD' as const;
export const CURRENCY_SYMBOL = 'DA' as const;

/**
 * Formate un montant en DA : 1500 -> "1 500 DA".
 * Les prix sont stockés en entiers (dinars), pas de centimes en pratique.
 */
export function formatDA(amount: number, opts: { withSymbol?: boolean } = {}): string {
  const { withSymbol = true } = opts;
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  // Séparateur de milliers : espace insécable (usage FR/DZ)
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = rounded < 0 ? '-' : '';
  return withSymbol ? `${sign}${grouped} ${CURRENCY_SYMBOL}` : `${sign}${grouped}`;
}

/** Formate une fourchette de prix : "800 DA" ou "800 – 1 500 DA". */
export function formatPriceRange(min: number, max: number): string {
  if (min === max) return formatDA(min);
  return `${formatDA(min, { withSymbol: false })} – ${formatDA(max)}`;
}

/** "à partir de 800 DA" */
export function formatFromPrice(min: number): string {
  return `à partir de ${formatDA(min)}`;
}
