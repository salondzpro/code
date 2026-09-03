/**
 * Numéros algériens : mobiles 05/06/07 + 8 chiffres (Mobilis/Djezzy/Ooredoo),
 * fixes 0[2-4] + 7/8 chiffres. Format E.164 : +213XXXXXXXXX.
 */
export const DZ_COUNTRY_CODE = '+213';
export const DZ_PHONE_REGEX = /^(?:\+213|00213|0)([5-7]\d{8}|[2-4]\d{7,8})$/;

/** Normalise vers E.164 (+213…). Retourne null si invalide. */
export function normalizeDZPhone(input: string): string | null {
  const cleaned = input.replace(/[\s.\-()]/g, '');
  const m = cleaned.match(DZ_PHONE_REGEX);
  if (!m) return null;
  return `${DZ_COUNTRY_CODE}${m[1]}`;
}

/** Affichage local : +213661234567 -> "06 61 23 45 67". */
export function formatDZPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = e164.match(/^\+213(\d{8,9})$/);
  if (!m) return e164;
  const local = `0${m[1]}`;
  return local.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}
