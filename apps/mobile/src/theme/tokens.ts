/**
 * Jetons de design — PLACEHOLDERS à remplacer par les valeurs du fichier
 * Claude Design (App Beaute Hi-Fi). Un seul endroit à modifier.
 */
export const colors = {
  primary: '#7C3AED',
  primaryDark: '#5B21B6',
  primarySoft: '#EDE9FE',
  accent: '#F59E0B',
  accentSoft: '#FEF3C7',
  bg: '#FFFFFF',
  surface: '#F7F5FB',
  surfaceAlt: '#EFEBF7',
  text: '#1A1523',
  textMuted: '#6B6478',
  textOnPrimary: '#FFFFFF',
  border: '#E6E1F0',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#2563EB',
  infoSoft: '#DBEAFE',
  overlay: 'rgba(26,21,35,0.5)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;

export const font = {
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

export const shadow = {
  card: {
    shadowColor: '#1A1523',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

/** Couleurs par statut de réservation. */
export const statusColors = {
  pending: { fg: colors.warning, bg: colors.warningSoft },
  confirmed: { fg: colors.success, bg: colors.successSoft },
  cancelled: { fg: colors.danger, bg: colors.dangerSoft },
  completed: { fg: colors.info, bg: colors.infoSoft },
  no_show: { fg: colors.textMuted, bg: colors.surfaceAlt },
} as const;
