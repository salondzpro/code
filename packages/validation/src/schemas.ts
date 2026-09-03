import { z } from 'zod';
import {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  GENDER_TARGETS,
  SALON_MAX_PHOTOS,
  USER_ROLES,
} from '@salondz/constants';
import * as p from './primitives';

// ---------- Profil ----------
export const updateProfileSchema = z.object({
  fullName: p.shortText(80).optional(),
  phone: p.phoneDZ.nullable().optional(),
  gender: z.enum(['male', 'female']).nullable().optional(),
  locale: z.enum(['fr', 'ar']).optional(),
  avatarUrl: p.httpUrl.nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const chooseRoleSchema = z.object({ role: z.enum(USER_ROLES) });

// ---------- Salon (pro) ----------
export const createSalonSchema = z.object({
  name: p.shortText(80),
  description: p.longText(1500).optional(),
  phone: p.phoneDZ.optional(),
  wilayaCode: p.wilayaCode,
  city: p.shortText(80),
  address: p.shortText(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  genderTarget: z.enum(GENDER_TARGETS).default('unisex'),
  categoryIds: z.array(p.categoryId).min(1).max(4),
});
export type CreateSalonInput = z.infer<typeof createSalonSchema>;

export const updateSalonSchema = createSalonSchema.partial().extend({
  slug: p.slug.optional(),
  coverUrl: p.httpUrl.nullable().optional(),
  isPublished: z.boolean().optional(),
  slotIntervalMinutes: p.slotInterval.optional(),
  bookingLeadTimeMinutes: z.number().int().min(0).max(7 * 24 * 60).optional(),
  bookingHorizonDays: z.number().int().min(1).max(90).optional(),
  autoConfirm: z.boolean().optional(),
});
export type UpdateSalonInput = z.infer<typeof updateSalonSchema>;

export const setSalonPhotosSchema = z.object({
  photos: z.array(z.object({ url: p.httpUrl })).max(SALON_MAX_PHOTOS),
});

// ---------- Services ----------
export const createServiceSchema = z.object({
  name: p.shortText(80),
  description: p.longText(500).optional(),
  durationMinutes: p.durationMinutes,
  priceDa: p.priceDa,
  categoryId: p.categoryId.nullable().optional(),
  isActive: z.boolean().default(true),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export const updateServiceSchema = createServiceSchema.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

// ---------- Horaires ----------
export const openingHourSchema = z
  .object({
    dayOfWeek: p.dayOfWeek,
    opensAt: p.timeHM,
    closesAt: p.timeHM,
    isClosed: z.boolean().default(false),
  })
  .refine((h) => h.isClosed || h.opensAt < h.closesAt, {
    message: "L'heure d'ouverture doit précéder la fermeture",
    path: ['closesAt'],
  });
/** Remplace l'intégralité des horaires (max 2 plages par jour : ex. coupure déjeuner). */
export const setOpeningHoursSchema = z.object({
  hours: z.array(openingHourSchema).min(1).max(14),
});
export type SetOpeningHoursInput = z.infer<typeof setOpeningHoursSchema>;

// ---------- Équipe ----------
export const createStaffSchema = z.object({
  displayName: p.shortText(60),
  avatarUrl: p.httpUrl.nullable().optional(),
});
export const updateStaffSchema = createStaffSchema.partial().extend({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export const setStaffHoursSchema = z.object({
  hours: z
    .array(
      z
        .object({ dayOfWeek: p.dayOfWeek, startsAt: p.timeHM, endsAt: p.timeHM })
        .refine((h) => h.startsAt < h.endsAt, { message: 'Plage invalide', path: ['endsAt'] }),
    )
    .max(14),
});

// ---------- Blocages (congés, pauses) ----------
export const createTimeBlockSchema = z
  .object({
    staffId: p.uuid.nullable().optional(),
    startsAt: p.isoDateTime,
    endsAt: p.isoDateTime,
    reason: p.shortText(120).optional(),
  })
  .refine((b) => new Date(b.startsAt) < new Date(b.endsAt), {
    message: 'La fin doit être après le début',
    path: ['endsAt'],
  });
export type CreateTimeBlockInput = z.infer<typeof createTimeBlockSchema>;

// ---------- Réservations ----------
export const createBookingSchema = z.object({
  salonId: p.uuid,
  serviceId: p.uuid,
  /** null/absent = "n'importe quel membre disponible". */
  staffId: p.uuid.nullable().optional(),
  startsAt: p.isoDateTime,
  notes: p.longText(300).optional(),
  /** Requis si le client n'a pas de nom sur son profil. */
  clientName: p.shortText(80).optional(),
  clientPhone: p.phoneDZ.optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/** Réservation créée par le pro (client de passage / téléphone). */
export const createWalkInBookingSchema = z.object({
  serviceId: p.uuid,
  staffId: p.uuid,
  startsAt: p.isoDateTime,
  clientName: p.shortText(80),
  clientPhone: p.phoneDZ.optional(),
  notes: p.longText(300).optional(),
  source: z.enum(BOOKING_SOURCES).default('walk_in'),
});
export type CreateWalkInBookingInput = z.infer<typeof createWalkInBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: p.shortText(200).optional(),
});

export const rescheduleBookingSchema = z.object({
  startsAt: p.isoDateTime,
  staffId: p.uuid.nullable().optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['confirmed', 'completed', 'no_show']),
});

export const listBookingsQuerySchema = z.object({
  from: p.dateKey.optional(),
  to: p.dateKey.optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  staffId: p.uuid.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;

export const myBookingsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type MyBookingsQuery = z.infer<typeof myBookingsQuerySchema>;

// ---------- Recherche & disponibilité (public) ----------
export const searchSalonsQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  wilaya: z.coerce.number().int().min(1).max(58).optional(),
  city: z.string().trim().max(80).optional(),
  category: p.categoryId.optional(),
  gender: z.enum(GENDER_TARGETS).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});
export type SearchSalonsQuery = z.infer<typeof searchSalonsQuerySchema>;

export const availabilityQuerySchema = z.object({
  serviceId: p.uuid,
  date: p.dateKey,
  staffId: p.uuid.optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

// ---------- Avis ----------
export const createReviewSchema = z.object({
  bookingId: p.uuid,
  rating: z.number().int().min(1).max(5),
  comment: p.longText(600).optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

// ---------- Push ----------
export const registerPushTokenSchema = z.object({
  token: z.string().min(10).max(300),
  platform: z.enum(['ios', 'android', 'web']),
  deviceName: z.string().max(80).optional(),
});

// ---------- Auth ----------
export const emailOtpRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(USER_ROLES).optional(),
});
export const emailOtpVerifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().regex(/^\d{6,8}$/),
});
