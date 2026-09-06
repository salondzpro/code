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
export const CLIENT_CANCEL_MIN_HOURS = 2;

export const NOTIFICATION_TYPES = [
  'booking_created',
  'booking_confirmed',
  'booking_cancelled',
  'booking_rescheduled',
  'booking_reminder',
  'booking_completed',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Garde-fous anti-abus (API) : rendez-vous à venir par client, taille de l'équipe et du catalogue. */
export const MAX_UPCOMING_BOOKINGS_PER_CLIENT = 10;
export const MAX_STAFF_PER_SALON = 30;
export const MAX_SERVICES_PER_SALON = 200;
/** Durée maximale d'un blocage (congés) : un an. */
export const MAX_TIME_BLOCK_DAYS = 366;
