import type {
  BookingSource,
  BookingStatus,
  CancelledBy,
  CategoryId,
  DayOfWeek,
  GenderTarget,
  NotificationType,
  UserRole,
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
  isOpenNow: boolean;
  lat?: number | null;
  lng?: number | null;
}

/** Quartier / ville avec le nombre de professionnels publiés (design « Localisation »). */
export interface CityCount {
  city: string;
  wilayaCode: number;
  salonCount: number;
  distanceKm: number | null;
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
export interface SalonPublic extends Salon {
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
}

/** Réservation enrichie côté client (nom du salon, etc.). */
export interface BookingWithSalon extends Booking {
  salon: Pick<Salon, 'id' | 'slug' | 'name' | 'city' | 'coverUrl' | 'phone' | 'address'>;
  staff: Pick<Staff, 'id' | 'displayName'> | null;
}

/** Réservation enrichie côté pro. */
export interface BookingWithStaff extends Booking {
  staff: Pick<Staff, 'id' | 'displayName'> | null;
}

export interface ProDashboardStats {
  todayCount: number;
  pendingCount: number;
  weekCount: number;
  weekRevenueDa: number;
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
