import type { Booking, BookingWithSalon, BookingWithStaff, SalonOwnerView, SalonPublic, BookingItem } from '@salondz/types';
import { db } from './supabase';
import { camelize, hm } from './mappers';
import { notFound, unwrap } from './errors';
import { mapSalon, SALON_COLUMNS } from '../plugins/auth';

export const PHOTO_COLS = 'id, salon_id, url, sort_order';
export const SERVICE_COLS =
  'id, salon_id, name, description, duration_minutes, price_da, category_id, is_active, sort_order';
export const STAFF_COLS = 'id, salon_id, user_id, display_name, avatar_url, is_active, sort_order';
export const HOURS_COLS = 'id, salon_id, day_of_week, opens_at, closes_at, is_closed';
export const BOOKING_COLS =
  'id, salon_id, client_id, staff_id, service_id, service_name, duration_minutes, price_da, starts_at, ends_at, status, source, client_name, client_phone, notes, cancelled_at, cancelled_by, cancellation_reason, created_at, updated_at';

export const SERVICE_PHOTO_COLS = 'id, url, sort_order';
const FULL_SALON_SELECT = `${SALON_COLUMNS}, salon_photos(${PHOTO_COLS}), services(${SERVICE_COLS}, service_photos(${SERVICE_PHOTO_COLS})), staff(${STAFF_COLS}), opening_hours(${HOURS_COLS})`;

type Row = Record<string, unknown>;

function sortBy<T extends { sortOrder: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.sortOrder - b.sortOrder);
}

function mapHours(rows: Row[]) {
  return camelize<SalonOwnerView['openingHours']>(rows)
    .map((h) => ({ ...h, opensAt: hm(h.opensAt), closesAt: hm(h.closesAt) }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.opensAt.localeCompare(b.opensAt));
}

function composeSalon(row: Row): SalonOwnerView {
  const { salon_photos, services, staff, opening_hours, ...salonRow } = row as Row & {
    salon_photos: Row[];
    services: Row[];
    staff: Row[];
    opening_hours: Row[];
  };
  return {
    ...mapSalon(salonRow),
    photos: sortBy(camelize<SalonOwnerView['photos']>(salon_photos ?? [])),
    services: sortBy(
      (services ?? []).map((svc) => {
        const { service_photos, ...rest } = svc as Row & { service_photos?: Row[] | null };
        return { ...camelize<SalonOwnerView['services'][number]>(rest), photos: sortBy(camelize<{ id: string; url: string; sortOrder: number }[]>(service_photos ?? [])) };
      }),
    ),
    staff: sortBy(camelize<SalonOwnerView['staff']>(staff ?? [])),
    openingHours: mapHours(opening_hours ?? []),
  };
}

/** Vue propriétaire complète (inclut inactifs). */
export async function loadOwnerView(salonId: string): Promise<SalonOwnerView> {
  const res = await db.from('salons').select(FULL_SALON_SELECT).eq('id', salonId).maybeSingle();
  return composeSalon(unwrap(res, 'Salon') as Row);
}

/** Vue publique (services/staff actifs uniquement). Retourne null si absent. */
/** `ownerId` est renvoyé pour le contrôle d'accès de la route, qui le retire de la réponse publique. */
export async function loadPublicBySlug(slug: string): Promise<(SalonPublic & { ownerId: string }) | null> {
  const res = await db
    .from('salons')
    .select(FULL_SALON_SELECT)
    .eq('slug', slug)
    .eq('services.is_active', true)
    .eq('staff.is_active', true)
    .maybeSingle();
  if (res.error) throw res.error;
  if (!res.data) return null;
  const full = composeSalon(res.data as Row);
  return {
    ...full,
    staff: full.staff.map((s) => ({ id: s.id, displayName: s.displayName, avatarUrl: s.avatarUrl })),
  };
}

export function mapBooking(row: Row): Booking {
  return camelize<Booking>(row);
}

export function mapBookingWithStaff(row: Row): BookingWithStaff {
  const { staff, booking_items, ...rest } = row as Row & { staff: Row | null; booking_items?: Row[] | null };
  return { ...mapBooking(rest), staff: staff ? camelize(staff) : null, items: mapItems(booking_items) };
}

function mapItems(rows: Row[] | null | undefined): BookingItem[] {
  return (rows ?? []).map((r) => camelize<BookingItem>(r)).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function mapBookingWithSalon(row: Row): BookingWithSalon {
  const { staff, salons, booking_items, ...rest } = row as Row & { staff: Row | null; salons: Row; booking_items?: Row[] | null };
  return { ...mapBooking(rest), salon: camelize(salons), staff: staff ? camelize(staff) : null, items: mapItems(booking_items) };
}

export const BOOKING_ITEM_COLS = 'id, service_id, service_name, duration_minutes, price_da, sort_order';
export const BOOKING_WITH_SALON_SELECT = `${BOOKING_COLS}, salons!inner(id, slug, name, city, cover_url, logo_url, phone, address, cancel_min_hours, allow_client_reschedule), staff(id, display_name), booking_items(${BOOKING_ITEM_COLS})`;
export const BOOKING_WITH_STAFF_SELECT = `${BOOKING_COLS}, staff(id, display_name), booking_items(${BOOKING_ITEM_COLS})`;

export async function getBookingWithSalon(id: string): Promise<BookingWithSalon> {
  const res = await db.from('bookings').select(BOOKING_WITH_SALON_SELECT).eq('id', id).maybeSingle();
  if (res.error) throw res.error;
  if (!res.data) throw notFound('Réservation');
  return mapBookingWithSalon(res.data as Row);
}

export async function getBookingWithStaff(id: string): Promise<BookingWithStaff> {
  const res = await db.from('bookings').select(BOOKING_WITH_STAFF_SELECT).eq('id', id).maybeSingle();
  if (res.error) throw res.error;
  if (!res.data) throw notFound('Réservation');
  return mapBookingWithStaff(res.data as Row);
}
