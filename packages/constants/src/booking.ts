export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS_FR: Record<BookingStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  completed: 'Terminé',
  no_show: 'Absent',
};

/** Statuts qui bloquent un créneau. */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed'];

export const BOOKING_SOURCES = ['online', 'walk_in', 'phone'] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const CANCELLED_BY = ['client', 'salon', 'system'] as const;
export type CancelledBy = (typeof CANCELLED_BY)[number];

export const GENDER_TARGETS = ['men', 'women', 'unisex'] as const;
export type GenderTarget = (typeof GENDER_TARGETS)[number];
export const GENDER_TARGET_LABELS_FR: Record<GenderTarget, string> = {
  men: 'Hommes',
  women: 'Femmes',
  unisex: 'Mixte',
};

export const USER_ROLES = ['client', 'pro'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Granularité des créneaux (minutes). */
export const SLOT_INTERVALS = [10, 15, 20, 30, 60] as const;
export const DEFAULT_SLOT_INTERVAL = 15;
/** Délai minimum avant un RDV en ligne (minutes). */
export const DEFAULT_LEAD_TIME_MINUTES = 60;
/** Horizon de réservation en ligne (jours). */
export const DEFAULT_BOOKING_HORIZON_DAYS = 30;
/** Durée max d'un service (minutes). */
export const MAX_SERVICE_DURATION_MINUTES = 8 * 60;
/** Délai d'annulation côté client (heures avant le RDV). */
export const CLIENT_CANCEL_MIN_HOURS = 1;

export const NOTIFICATION_TYPES = [
  'booking_created',
  'booking_confirmed',
  'booking_cancelled',
  'booking_rescheduled',
  'booking_reminder',
  'booking_completed',
  /** Absence signalée par le salon : la cliente doit le savoir, une absence compte double
   *  dans les règles anti-abus (voir NO_SHOW_ABUSE_MAX). Ajouté par la migration 0028. */
  'booking_no_show',
  /** Un créneau s'est libéré (annulation, report, expiration, blocage retiré) : liste d'attente et clients ayant rendez-vous plus tard. */
  'slot_freed',
  /** Relance du professionnel : une demande attend sa réponse depuis PENDING_REMINDER_HOURS. */
  'request_pending',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Garde-fous anti-abus (API) : rendez-vous à venir par client, taille de l'équipe et du catalogue. */
export const MAX_UPCOMING_BOOKINGS_PER_CLIENT = 10;
/** Réservations POUR QUELQU'UN D'AUTRE par compte et par 24 h : un tiers ne doit pas pouvoir saturer ou faire suspendre autrui. */
export const MAX_FOR_OTHER_PER_DAY = 5;
/**
 * Validation manuelle : une demande bloque le créneau pour les autres clients tant que le salon n'a pas
 * répondu. Le salon est relancé après PENDING_REMINDER_HOURS ; sans réponse au bout de
 * PENDING_REQUEST_TTL_HOURS (ou à l'heure du rendez-vous si elle arrive avant), la demande expire et le
 * créneau est libéré — le client est prévenu et peut réserver ailleurs.
 */
export const PENDING_REMINDER_HOURS = 2;
/**
 * Rappel au PROFESSIONNEL : une notification PRO_REMINDER_LEAD_MINUTES avant chaque rendez-vous confirmé
 * (envoyée au propriétaire du salon). Elle remplace le message WhatsApp qu'on s'envoyait à soi-même pour ne
 * pas oublier. Un rendez-vous pris moins de 15 minutes avant l'heure du rappel n'en reçoit pas : le pro vient
 * d'être prévenu par la notification de la réservation elle-même.
 */
export const PRO_REMINDER_LEAD_MINUTES = 60;
export const PENDING_REQUEST_TTL_HOURS = 24;
/** Alertes « créneau libéré » actives au plus par client. */
export const SLOT_ALERT_MAX_PER_CLIENT = 10;
/** Clients ayant un rendez-vous plus tard prévenus d'un créneau plus tôt (les plus éloignés d'abord). */
export const SLOT_FREED_MAX_LATER_CLIENTS = 10;
export const MAX_STAFF_PER_SALON = 30;
export const MAX_SERVICES_PER_SALON = 200;
/**
 * Anti-abus d'annulation (API `assertClientCanBook`). Annuler reste un droit : le client peut annuler
 * jusqu'à CANCEL_ABUSE_MAX rendez-vous sur CANCEL_ABUSE_WINDOW_DAYS jours sans aucune conséquence.
 * Ce n'est qu'au-delà (strictement plus d'annulations que ce seuil) que la réservation en ligne est
 * suspendue CANCEL_ABUSE_BLOCK_DAYS jours après la dernière annulation.
 * Les absences (« Client absent » signalé par le pro) restent plus sévères : la suspension tombe dès
 * NO_SHOW_ABUSE_MAX absences, parce qu'un créneau perdu sans prévenir ne se rattrape pas.
 * Les rendez-vous déjà pris restent valables ; le client peut toujours appeler le salon.
 */
/** Annulations tolérées par client sur la fenêtre (la suspension ne démarre qu'au-delà). */
export const CANCEL_ABUSE_MAX = 8;
export const CANCEL_ABUSE_WINDOW_DAYS = 30;
export const CANCEL_ABUSE_BLOCK_DAYS = 7;
/** Absences tolérées : la suspension tombe dès la NO_SHOW_ABUSE_MAX-ième. */
export const NO_SHOW_ABUSE_MAX = 2;
export const NO_SHOW_ABUSE_WINDOW_DAYS = 60;
export const NO_SHOW_ABUSE_BLOCK_DAYS = 14;

/** Nombre de reports en ligne autorisés par rendez-vous pour le client (au-delà : contacter le salon). */
export const MAX_CLIENT_RESCHEDULES = 1;

/** Durée maximale d'un blocage (congés) : un an. */
export const MAX_TIME_BLOCK_DAYS = 366;

/**
 * Durée de vie des notifications (comme les outils du métier : une notification est une
 * information du moment, pas une archive — l'historique, ce sont les rendez-vous).
 * Lue : supprimée NOTIFICATION_READ_TTL_DAYS jours après sa lecture. Non lue : supprimée
 * quand même NOTIFICATION_MAX_AGE_DAYS jours après sa création. Le cron (`/internal/cron/tick`)
 * fait la purge ; la table ne grossit jamais sans fin.
 */
export const NOTIFICATION_READ_TTL_DAYS = 7;
export const NOTIFICATION_MAX_AGE_DAYS = 30;
