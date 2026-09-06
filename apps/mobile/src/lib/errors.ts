import { ApiError } from '@salondz/api-client';

const FALLBACKS: Record<string, string> = {
  NETWORK: 'Pas de connexion. Vérifiez votre réseau puis réessayez.',
  TIMEOUT: 'Connexion trop lente. Réessayez.',
  UNAUTHORIZED: 'Connectez-vous pour continuer.',
  FORBIDDEN: 'Accès refusé.',
  NOT_FOUND: 'Introuvable.',
  VALIDATION_ERROR: 'Certaines informations sont invalides.',
  RATE_LIMITED: 'Trop de requêtes. Patientez un instant.',
  INTERNAL_ERROR: 'Erreur du serveur. Réessayez dans un instant.',
};

/** Message FR lisible pour n'importe quelle erreur (ApiError, Supabase, Error). */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message || FALLBACKS[error.code] || 'Une erreur est survenue.';
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return 'Une erreur est survenue.';
}

export function errorDetails(error: unknown): string[] {
  if (error instanceof ApiError && Array.isArray(error.details)) {
    return error.details.map((d) => (typeof d === 'string' ? d : ((d as { message?: string }).message ?? ''))).filter(Boolean);
  }
  return [];
}

export const isNetworkError = (error: unknown): boolean => (error instanceof ApiError && error.isNetwork) || /network|fetch|réseau/i.test(errorText(error));
