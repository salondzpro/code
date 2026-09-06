import type { PostgrestError } from '@supabase/supabase-js';

/** Erreur applicative avec code stable pour le front. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what = 'Ressource') => new AppError(404, 'NOT_FOUND', `${what} introuvable`);
export const unauthorized = (msg = 'Authentification requise') => new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Accès refusé') => new AppError(403, 'FORBIDDEN', msg);
export const badRequest = (code: string, msg: string, details?: unknown) =>
  new AppError(400, code, msg, details);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);

/** Messages FR pour les codes métier levés par les fonctions SQL. */
const BUSINESS_MESSAGES: Record<string, { status: number; message: string }> = {
  SLOT_TAKEN: { status: 409, message: "Ce créneau vient d'être réservé. Choisissez-en un autre." },
  OUTSIDE_OPENING_HOURS: { status: 400, message: 'Le salon est fermé à cet horaire.' },
  TOO_SOON: { status: 400, message: 'Ce créneau est trop proche. Choisissez un horaire plus tard.' },
  TOO_FAR: { status: 400, message: 'Ce créneau est trop loin dans le futur.' },
  IN_PAST: { status: 400, message: 'Ce créneau est déjà passé.' },
  SALON_NOT_PUBLISHED: { status: 400, message: "Ce salon n'accepte pas encore de réservations en ligne." },
  SERVICE_INACTIVE: { status: 400, message: "Ce service n'est plus proposé." },
  STAFF_UNAVAILABLE: { status: 400, message: "Ce membre de l'équipe n'est pas disponible." },
  BOOKING_NOT_CANCELLABLE: { status: 409, message: 'Cette réservation ne peut plus être modifiée.' },
  CANCEL_TOO_LATE: { status: 409, message: 'Trop tard pour modifier en ligne. Contactez le salon.' },
  RESCHEDULE_DISABLED: { status: 409, message: 'Ce salon ne permet pas le report en ligne. Contactez-le.' },
  SALON_NOT_FOUND: { status: 404, message: 'Salon introuvable.' },
  BOOKING_NOT_FOUND: { status: 404, message: 'Réservation introuvable.' },
  UNAUTHENTICATED: { status: 401, message: 'Authentification requise.' },
};

export type PgErrorLike = Pick<PostgrestError, 'code' | 'message'> & Partial<Pick<PostgrestError, 'details' | 'hint'>>;

/** Convertit une erreur PostgREST/Postgres en AppError lisible. */
export function fromPostgrest(err: PgErrorLike, fallback = 'Erreur base de données'): AppError {
  const known = BUSINESS_MESSAGES[err.message];
  if (known) return new AppError(known.status, err.message, known.message);
  switch (err.code) {
    case '23505':
      return new AppError(409, 'DUPLICATE', 'Cette valeur existe déjà.', err.details);
    case '23P01':
      return new AppError(409, 'SLOT_TAKEN', BUSINESS_MESSAGES.SLOT_TAKEN!.message);
    case '23503':
      return new AppError(400, 'INVALID_REFERENCE', 'Référence invalide.', err.details);
    case '23514':
      return new AppError(400, 'CHECK_VIOLATION', 'Valeur non autorisée.', err.details);
    case 'PGRST116':
      return new AppError(404, 'NOT_FOUND', 'Ressource introuvable.');
    default:
      return new AppError(500, 'DB_ERROR', fallback, { code: err.code, message: err.message });
  }
}

/** Lance si la réponse Supabase contient une erreur ; sinon renvoie data typé. */
export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }, what?: string): T {
  if (res.error) throw fromPostgrest(res.error);
  if (res.data === null || res.data === undefined) throw notFound(what);
  return res.data;
}
