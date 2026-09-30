import { ApiError } from '@salondz/api-client';
import { Link } from 'react-router';
import { Clock, Lock, RefreshCw, ServerCrash, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react';
import { t } from '@/i18n';

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

/**
 * L'adresse ne mène à rien (salon retiré, lien erroné, rendez-vous supprimé). Ce cas mérite une
 * PAGE, avec une sortie, et non un bandeau rouge au milieu d'un écran vide.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'NOT_FOUND';
}

/** Message FR lisible pour n'importe quelle erreur (ApiError, Supabase, Error). */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) return (FALLBACKS[error.code] ? t(FALLBACKS[error.code]!) : '') || error.message || t('Une erreur est survenue.');
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return t('Une erreur est survenue.');
}

export function errorDetails(error: unknown): string[] {
  if (error instanceof ApiError && Array.isArray(error.details)) {
    return error.details.map((d) => (typeof d === 'string' ? d : (d as { message?: string }).message ?? '')).filter(Boolean);
  }
  return [];
}

/**
 * Un écran qui n'a RIEN à montrer mérite une page, pas un bandeau rouge collé en haut du vide.
 *
 * Chaque cas dit ce qui se passe, pourquoi, et quoi faire — un « Pas de connexion » seul laisse
 * la personne devant un écran blanc sans savoir si c'est elle, son réseau ou le service. Le
 * vocabulaire est celui du métier, jamais un code technique.
 */
const ETATS: Record<string, { icone: LucideIcon; titre: string; texte: string }> = {
  NETWORK: {
    icone: WifiOff,
    titre: 'Pas de connexion',
    texte: 'Votre téléphone ne parvient pas à joindre Salon DZ. Vérifiez votre réseau ou vos données mobiles, puis réessayez.',
  },
  TIMEOUT: {
    icone: Clock,
    titre: 'Connexion trop lente',
    texte: 'Le réseau met trop de temps à répondre. Réessayez dans un instant.',
  },
  INTERNAL_ERROR: {
    icone: ServerCrash,
    titre: 'Service indisponible',
    texte: 'Le problème vient de chez nous, pas de vous. Réessayez dans quelques instants.',
  },
  RATE_LIMITED: {
    icone: Clock,
    titre: 'Trop de tentatives',
    texte: 'Patientez une minute avant de réessayer.',
  },
  UNAUTHORIZED: {
    icone: Lock,
    titre: 'Session expirée',
    texte: 'Reconnectez-vous pour retrouver vos rendez-vous.',
  },
  FORBIDDEN: {
    icone: Lock,
    titre: 'Accès refusé',
    texte: "Vous n'avez pas accès à cette page.",
  },
};

const ETAT_PAR_DEFAUT = {
  icone: TriangleAlert,
  titre: 'Une erreur est survenue',
  texte: "L'opération n'a pas abouti. Réessayez ; si cela se reproduit, écrivez-nous à support@salondz.com.",
};

/**
 * Erreur PLEIN ÉCRAN, centrée. À utiliser quand l'écran ne peut rien afficher d'autre — un garde
 * qui n'a pas pu lire le profil, une liste qui n'a pas pu se charger. Pour une action qui échoue
 * dans un écran par ailleurs rempli (un formulaire), `ErrorMessage` reste le bon outil.
 */
export function ErrorState({
  error,
  retry,
  accueil = true,
}: {
  error: unknown;
  retry?: () => void;
  /** Sortie de secours. On la retire quand on EST déjà à l'accueil. */
  accueil?: boolean;
}) {
  const code = error instanceof ApiError ? error.code : '';
  const { icone: Icone, titre, texte } = ETATS[code] ?? ETAT_PAR_DEFAUT;
  return (
    <div role="alert" className="h-app flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-fill text-muted">
        <Icone size={28} strokeWidth={1.6} aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="h1">{t(titre)}</h1>
        <p className="p max-w-[26rem]">{t(texte)}</p>
      </div>
      <div className="mt-2 flex w-full max-w-[20rem] flex-col gap-2">
        {retry && (
          <button type="button" className="btn-primary flex items-center justify-center gap-2" onClick={retry}>
            <RefreshCw size={18} strokeWidth={1.8} aria-hidden />
            {t('Réessayer')}
          </button>
        )}
        {accueil && (
          <Link to="/" className="btn-ghost">
            {t("Retour à l'accueil")}
          </Link>
        )}
      </div>
    </div>
  );
}

export function ErrorMessage({ error, retry, className = '' }: { error: unknown; retry?: () => void; className?: string }) {
  if (!error) return null;
  const details = errorDetails(error);
  return (
    <div role="alert" className={`rounded-[var(--radius-card)] border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger ${className}`}>
      <p className="font-medium">{errorText(error)}</p>
      {details.length > 0 && (
        <ul className="mt-1 list-disc ps-5 text-text/80">
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {retry && (
        <button type="button" onClick={retry} className="mt-2 underline">
          {t("Réessayer")}
        </button>
      )}
    </div>
  );
}
