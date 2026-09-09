import type {
  BookingSource,
  BookingStatus,
  CancelledBy,
  CategoryId,
  DayOfWeek,
  GenderTarget,
  NotificationType,
  UserRole,
  CancellationKind,
} from '@salondz/constants';

export type UUID = string;
/** ISO 8601 avec fuseau (timestamptz). */
export type ISODateTime = string;
/** "YYYY-MM-DD" (date locale Algérie). */
export type DateKey = string;
/** "HH:mm" (heure locale Algérie). */
export type TimeHM = string;

// ---------- Entités ----------

export interface Profile {
  id: UUID;
  role: UserRole;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  gender: 'male' | 'female' | null;
  locale: 'fr' | 'ar';
  market: 'men' | 'women' | null;
  whatsappReminders: boolean;
  createdAt: ISODateTime;
}

export interface Category {
  id: CategoryId | string;
  labelFr: string;
  labelAr: string;
  icon: string;
  sortOrder: number;
  market: 'men' | 'women' | null;
}

export interface Salon {
  id: UUID;
  ownerId: UUID;
  slug: string;
  name: string;
  description: string | null;
  phone: string | null;
  wilayaCode: number;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  coverUrl: string | null;
  logoUrl: string | null;
  /** Zone d'activité (quartier) affichée sur la page. */
  zone: string | null;
  genderTarget: GenderTarget;
  isPublished: boolean;
  slotIntervalMinutes: number;
  bookingLeadTimeMinutes: number;
  bookingHorizonDays: number;
  autoConfirm: boolean;
  cancelMinHours: number;
  bufferMinutes: number;
  homeService: boolean;
  /** Le client peut déplacer lui-même son rendez-vous (design PRO-F 13 « Report client »). */
  allowClientReschedule: boolean;
  /** Acompte demandé sur place (information affichée au client). */
  depositRequired: boolean;
  ratingAvg: number;
  ratingCount: number;
  categoryIds: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SalonPhoto {
  id: UUID;
  salonId: UUID;
  url: string;
  sortOrder: number;
}

export interface Service {
  id: UUID;
  salonId: UUID;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceDa: number;
  categoryId: string | null;
  /** Groupe libre du catalogue (« Coupes », « Barbe », « Soins »…) — créé par le professionnel. */
  groupName: string | null;
  isActive: boolean;
  sortOrder: number;
  /** Photos de la prestation (design « Prestations illustrées ») — présentes dans les vues salon. */
  photos?: ServicePhoto[];
}

export interface ServicePhoto {
  id: UUID;
  url: string;
  sortOrder: number;
}

export interface Staff {
  id: UUID;
  salonId: UUID;
  userId: UUID | null;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  /** true = réalise toutes les prestations du salon ; sinon `serviceIds` liste celles affectées. */
  allServices: boolean;
  serviceIds: string[];
}

export interface OpeningHour {
  id: UUID;
  salonId: UUID;
  dayOfWeek: DayOfWeek;
  opensAt: TimeHM;
  closesAt: TimeHM;
  isClosed: boolean;
}

export interface StaffHour {
  id: UUID;
  staffId: UUID;
  dayOfWeek: DayOfWeek;
  startsAt: TimeHM;
  endsAt: TimeHM;
}

export interface TimeBlock {
  id: UUID;
  salonId: UUID;
  staffId: UUID | null;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  reason: string | null;
}

export interface Booking {
  id: UUID;
  salonId: UUID;
  clientId: UUID | null;
  staffId: UUID;
  serviceId: UUID;
  serviceName: string;
  durationMinutes: number;
  priceDa: number;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  status: BookingStatus;
  source: BookingSource;
  clientName: string;
  clientPhone: string | null;
  notes: string | null;
  cancelledAt: ISODateTime | null;
  cancelledBy: CancelledBy | null;
  cancellationReason: string | null;
  /** 'late' = annulé par le salon pour retard (> LATE_TOLERANCE_MINUTES), sinon null. */
  cancellationKind: CancellationKind | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Prestations cumulées (absent = une seule prestation, cf. serviceName). */
  items?: BookingItem[];
}

export interface Review {
  id: UUID;
  salonId: UUID;
  bookingId: UUID;
  clientId: UUID;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  createdAt: ISODateTime;
}

export interface Notification {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: ISODateTime | null;
  createdAt: ISODateTime;
}

// ---------- DTOs API (vues composées) ----------

/** Carte salon dans les résultats de recherche (légère pour la 4G). */
export interface SalonSummary {
  id: UUID;
  slug: string;
  name: string;
  city: string;
  wilayaCode: number;
  coverUrl: string | null;
  genderTarget: GenderTarget;
  ratingAvg: number;
  ratingCount: number;
  categoryIds: string[];
  minPriceDa: number | null;
  distanceKm?: number | null;
  /** Quartier et logo (design : « Barbier · Alger-Centre · 0,8 km », vignette ronde). */
  zone: string | null;
  logoUrl: string | null;
  /** Prestations phares : « Coupe 900 DA · Barbe 500 DA ». */
  topServices: { name: string; priceDa: number }[];
  /** Prochains créneaux du jour (HH:mm, heure d'Alger), 3 au plus. */
  nextSlots: string[];
  /** Première journée avec des créneaux (aujourd'hui, sinon les 7 jours suivants) : date locale + heures. */
  nextAvailable: { date: string; slots: string[] } | null;
  /** 7 prochains jours avec le premier créneau libre par moment : cartes « Matin / Après-midi » à la Planity (`planPeriodDays`). */
  periods: PeriodDay[];
  isOpenNow: boolean;
  lat?: number | null;
  lng?: number | null;
}

/** Un jour de la grille « Matin / Après-midi » d'une carte : ouvert ?, heure de fermeture, premier créneau libre (HH:mm) par moment. */
export interface PeriodDay {
  date: DateKey;
  open: boolean;
  closesAt: string | null;
  matin: string | null;
  /** Après-midi et soir confondus (≥ 12 h). */
  apresMidi: string | null;
}

/** Situation d'un client vis-à-vis des règles anti-abus (annulations récentes, absences, suspension en cours). */
export interface ClientStanding {
  /** Annulations par le client sur la fenêtre CANCEL_ABUSE_WINDOW_DAYS. */
  cancellations: number;
  /** Absences signalées par les salons sur la fenêtre NO_SHOW_ABUSE_WINDOW_DAYS. */
  noShows: number;
  /** Réservation en ligne suspendue jusqu'à cette date, sinon null. */
  suspendedUntil: ISODateTime | null;
}

/** Quartier / ville avec le nombre de professionnels publiés (design « Localisation »). */
export interface CityCount {
  /** Quartier (zone) ou ville — valeur à passer au filtre `city` de la recherche. */
  city: string;
  /** Ville parente quand `city` est un quartier (« Hydra » → « Alger »). */
  parentCity: string | null;
  wilayaCode: number;
  salonCount: number;
  distanceKm: number | null;
}

/** Suggestions de recherche (design C-H 07) : salons, prestations et lieux correspondant à la saisie. */
export interface SearchSuggestions {
  salons: { id: UUID; slug: string; name: string; city: string; zone: string | null; wilayaCode: number; logoUrl: string | null; coverUrl: string | null; ratingAvg: number; ratingCount: number; categoryId: string | null }[];
  services: { name: string; salonCount: number; minPriceDa: number | null }[];
  places: { city: string; parentCity: string | null; wilayaCode: number; salonCount: number }[];
}

/** Ligne d'une réservation multi-prestations (snapshot). */
export interface BookingItem {
  id: UUID;
  serviceId: UUID | null;
  serviceName: string;
  durationMinutes: number;
  priceDa: number;
  sortOrder: number;
}

/** Page publique du salon : tout ce qu'il faut en UNE requête. */
/** Fiche publique : sans l'identifiant du propriétaire (compte auth). */
export interface SalonPublic extends Omit<Salon, 'ownerId'> {
  photos: SalonPhoto[];
  services: Service[];
  staff: Pick<Staff, 'id' | 'displayName' | 'avatarUrl'>[];
  openingHours: OpeningHour[];
}

/** Salon vu par son propriétaire (inclut le personnel inactif, etc.). */
export interface SalonOwnerView extends Salon {
  photos: SalonPhoto[];
  services: Service[];
  staff: Staff[];
  openingHours: OpeningHour[];
}

export interface AvailabilitySlot {
  /** ISO — début du créneau. */
  startsAt: ISODateTime;
  /** Membres disponibles pour ce créneau. */
  staffIds: UUID[];
}

export interface AvailabilityResponse {
  salonId: UUID;
  serviceId: UUID;
  serviceIds: UUID[];
  date: DateKey;
  slotIntervalMinutes: number;
  durationMinutes: number;
  slots: AvailabilitySlot[];
  /** Journée complète : prochaine journée avec des créneaux libres pour ces prestations (après `date`), sinon null. */
  nextAvailable: { date: DateKey; slots: string[] } | null;
}

/** Réservation enrichie côté client (nom du salon, etc.). */
export interface BookingWithSalon extends Booking {
  salon: Pick<Salon, 'id' | 'slug' | 'name' | 'city' | 'coverUrl' | 'logoUrl' | 'phone' | 'address' | 'cancelMinHours' | 'allowClientReschedule'>;
  staff: Pick<Staff, 'id' | 'displayName'> | null;
  /** Note déjà donnée par le client pour ce rendez-vous (un seul avis par rendez-vous), sinon null. */
  reviewRating: number | null;
}

/** Réservation enrichie côté pro. */
export interface BookingWithStaff extends Booking {
  staff: Pick<Staff, 'id' | 'displayName'> | null;
}

/** Fiche client agrégée côté pro (un client = compte, sinon numéro, sinon nom). */
export interface ProClient {
  clientKey: string;
  clientId: UUID | null;
  name: string;
  phone: string | null;
  bookingsCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  lastAt: string | null;
  nextAt: string | null;
  lastBookingId: UUID | null;
  blocked: boolean;
  blockedReason: string | null;
  /** E-mail du compte (null pour un client de passage ou un compte technique). */
  email: string | null;
  /** Montant des rendez-vous terminés (DA). */
  spentDa: number;
  /** Notes privées du salon (jamais visibles du client). */
  notes: string | null;
}

/** Ligne d'historique d'un client chez un salon. */
export interface ProClientHistoryItem {
  id: UUID;
  startsAt: string;
  endsAt: string;
  serviceName: string;
  priceDa: number;
  status: BookingStatus;
  cancelledBy: CancelledBy | null;
  staffName: string | null;
}

export interface ProDashboardStats {
  todayCount: number;
  pendingCount: number;
  weekCount: number;
  weekRevenueDa: number;
  todayRevenueDa: number;
  monthCount: number;
  monthRevenueDa: number;
}

/** Statistiques d'une période (design « Chiffre d'affaires » jour / semaine / mois). */
export interface ProStatsRange {
  from: DateKey;
  to: DateKey;
  revenueDa: number;
  bookings: number;
  pending: number;
  collectedDa: number;
  remainingDa: number;
  remainingCount: number;
  byDay: { date: DateKey; revenueDa: number; bookings: number }[];
  byService: { name: string; bookings: number; revenueDa: number }[];
}

export interface Paginated<T> {
  items: T[];
  /** Nombre total de résultats quand la source le fournit (recherche). */
  total?: number;
  nextCursor: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Codes d'erreur métier renvoyés par l'API (stables pour le front). */
export type BookingErrorCode =
  | 'SLOT_TAKEN'
  | 'OUTSIDE_OPENING_HOURS'
  | 'TOO_SOON'
  | 'TOO_FAR'
  | 'SALON_NOT_PUBLISHED'
  | 'SERVICE_INACTIVE'
  | 'STAFF_UNAVAILABLE'
  | 'NOT_SLOT_ALIGNED'
  | 'IN_TIME_BLOCK'
  | 'BOOKING_NOT_CANCELLABLE'
  | 'CANCEL_TOO_LATE'
  | 'IN_PAST';
