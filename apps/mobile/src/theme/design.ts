/**
 * Jetons de design — source : Claude Design « App Beaute Hi-Fi » (design/App Beaute Hi-Fi.dc.html).
 * Mêmes valeurs que apps/web/src/styles/tokens.css ; ne pas inventer de couleur ici.
 */
import type { TextStyle, ViewStyle } from 'react-native';

export const C = {
  canvas: '#EDEEEF',
  bg: '#F8F9FA',
  surface: '#FFFFFF',
  fill: '#F4F5F6',
  line: '#E6E7E9',
  lineSoft: '#EFF0F1',
  text: '#17181A',
  muted: '#6B6F73',
  subtle: '#9A9EA3',
  disabled: '#C4C7CA',
  ink: '#111214',
  onInk: '#FFFFFF',
  danger: '#E5484D',
  dangerLine: '#F4D7D8',
  okBg: '#E2F6EC',
  okFg: '#0E7A4D',
  pendingBg: '#FCE8D8',
  pendingFg: '#96551F',
  cancelBg: '#FDE8E8',
  cancelFg: '#B22F33',
  green: '#18A66A',
  dim: 'rgba(23,24,26,0.32)',
  white70: 'rgba(255,255,255,0.7)',
  white85: 'rgba(255,255,255,0.85)',
} as const;

/** Tons des catégories (agenda, badges de prestations). */
export const CAT: Record<string, { bg: string; line: string; fg: string }> = {
  hair: { bg: '#DDF3F4', line: '#38AEB5', fg: '#0E5A5F' },
  barb: { bg: '#DCE7FF', line: '#6D8FE8', fg: '#2C4A93' },
  nail: { bg: '#FBE1EA', line: '#D97898', fg: '#8F3556' },
  lash: { bg: '#E7DFFF', line: '#8A63D8', fg: '#4B2C91' },
  skin: { bg: '#DFF3E7', line: '#55A873', fg: '#1F6B41' },
  lasr: { bg: '#FCE8D8', line: '#D88C52', fg: '#8A4B18' },
};

export const R = { card: 20, cardSm: 16, btn: 16, input: 14, slot: 14, img: 18, pill: 999, sheet: 28 } as const;

export const FONT = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const SHADOW: Record<'card' | 'sheet' | 'fab' | 'toast' | 'knob' | 'seg', ViewStyle> = {
  card: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  sheet: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: -8 }, elevation: 12 },
  fab: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  toast: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  knob: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  seg: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
};

/** Espace réservé sous le contenu quand une feuille basse est affichée (design). */
export const SHEET_PAD = 150;
export const NAV_PAD = 24;

/** Chiffres à chasse fixe (design .mono). */
export const MONO: TextStyle = { fontVariant: ['tabular-nums'] };
