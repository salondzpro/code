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
    return error.details.map((d) => (typeof d === 'string' ? d : (d as { message?: string }).message ?? '')).filter(Boolean);
  }
  return [];
}

export function ErrorMessage({ error, retry, className = '' }: { error: unknown; retry?: () => void; className?: string }) {
  if (!error) return null;
  const details = errorDetails(error);
  return (
    <div role="alert" className={`rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger ${className}`}>
      <p className="font-medium">{errorText(error)}</p>
      {details.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-text/80">
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {retry && (
        <button type="button" onClick={retry} className="mt-2 underline">
          Réessayer
        </button>
      )}
    </div>
  );
}
