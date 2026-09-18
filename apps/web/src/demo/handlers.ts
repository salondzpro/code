/**
 * Routeur de la démonstration : les mêmes chemins, formes et codes d'erreur que l'API Salon DZ, servis
 * depuis le monde en mémoire (`world.ts`). Chaque appel fait d'abord avancer le monde (`advance`), puis
 * répond. Les règles métier (délais, horizon, créneau pris, anti-abus, transitions) sont reprises de
 * l'API et des fonctions SQL pour que la démonstration se comporte comme la vraie application.
 */
import {
  CANCEL_ABUSE_WINDOW_DAYS,
  CATEGORIES,
  CLIENT_CANCEL_MIN_HOURS,
  LATE_TOLERANCE_MINUTES,
  MAX_CLIENT_RESCHEDULES,
  MAX_SERVICES_PER_SALON,
  MAX_STAFF_PER_SALON,
  MAX_UPCOMING_BOOKINGS_PER_CLIENT,
  NO_SHOW_ABUSE_MAX,
  NO_SHOW_ABUSE_WINDOW_DAYS,
  SLOT_ALERT_MAX_PER_CLIENT,
  WILAYAS,
  addDaysToKey,
  categoryLabel,
  dayOfWeekFromKey,
  isLate,
  localDateTimeToISO,
  toLocalDateKey,
} from '@salondz/constants';
import type { Booking, BookingWithSalon, BookingWithStaff, OutsideBooking, SalonOwnerView, SalonPublic, Service, Staff, StaffHour, TimeBlock } from '@salondz/types';
import { availableSlots, clientKeyOf, clientStanding, concerns, dashboardStats, daysUntilMax, hm, nextAvailability, proClients, statsRange, summary, unaccent } from './engine';
import { advance, bookingRow, fmtWhen, getWorld, notify, onBookingChange, refreshRating, resetWorld, saveWorld, uid, type DemoProfile, type World } from './world';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
const bad = (code: string, msg: string, details?: unknown) => new HttpError(400, code, msg, details);
const conflict = (code: string, msg: string, details?: unknown) => new HttpError(409, code, msg, details);
const notFound = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} introuvable.`);
const unauthorized = () => new HttpError(401, 'UNAUTHORIZED', 'Connectez-vous pour continuer.');

export interface Ctx {
  w: World;
  user: DemoProfile | null;
  method: string;
  path: string;
  query: URLSearchParams;
  body: Record<string, unknown>;
  now: number;
}
export interface Result {
  status: number;
  body?: unknown;
}
type Handler = (c: Ctx, p: Record<string, string>) => Result;
interface Route {
  m: string;
  re: RegExp;
  keys: string[];
  h: Handler;
}
const routes: Route[] = [];
function on(m: string, pattern: string, h: Handler) {
  const keys: string[] = [];
  const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_m, k: string) => {
    keys.push(k);
    return '([^/]+)';
  }) + '$');
  routes.push({ m, re, keys, h });
}
const ok = (body: unknown): Result => ({ status: 200, body });
const created = (body: unknown): Result => ({ status: 201, body });
const none = (): Result => ({ status: 204 });
const num = (v: string | null, d: number) => (v == null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const page = <T,>(items: T[], offset: number, limit: number) => ({ items: items.slice(offset, offset + limit), nextCursor: offset + limit < items.length ? String(offset + limit) : null });

// ---------------------------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------------------------
const requireUser = (c: Ctx): DemoProfile => {
  if (!c.user) throw unauthorized();
  return c.user;
};
const ownedSalon = (c: Ctx): SalonOwnerView => {
  const u = requireUser(c);
  const s = c.w.salons.find((x) => x.ownerId === u.id);
  if (!s) throw new HttpError(404, 'NO_SALON', "Vous n'avez pas encore de salon.");
  return s;
};
const salonById = (w: World, id: string) => w.salons.find((s) => s.id === id);
const staffPick = (s: SalonOwnerView, id: string | null | undefined) => (id ? s.staff.find((x) => x.id === id && x.isActive) ?? null : null);

function withSalon(w: World, b: Booking): BookingWithSalon {
  const s = salonById(w, b.salonId)!;
  const st = s.staff.find((x) => x.id === b.staffId);
  const review = w.reviews.find((r) => r.bookingId === b.id);
  return {
    ...b,
    salon: { id: s.id, slug: s.slug, name: s.name, city: s.city, coverUrl: s.coverUrl, logoUrl: s.logoUrl, phone: s.phone, address: s.address, cancelMinHours: s.cancelMinHours, allowClientReschedule: s.allowClientReschedule },
    staff: st ? { id: st.id, displayName: st.displayName } : null,
    items: [],
    reviewRating: review?.rating ?? null,
  };
}
function withStaff(w: World, b: Booking): BookingWithStaff {
  const s = salonById(w, b.salonId)!;
  const st = s.staff.find((x) => x.id === b.staffId);
  return { ...b, staff: st ? { id: st.id, displayName: st.displayName } : null, items: [] };
}
const publicView = (s: SalonOwnerView): SalonPublic => {
  const { ownerId: _o, ...rest } = s;
  return { ...rest, services: s.services.filter((x) => x.isActive), staff: s.staff.filter((x) => x.isActive).map((x) => ({ id: x.id, displayName: x.displayName, avatarUrl: x.avatarUrl })) };
};
const touch = (w: World, s: SalonOwnerView) => {
  s.updatedAt = new Date().toISOString();
  saveWorld();
  return s;
};

function syncCategories(s: SalonOwnerView) {
  const ids = [...new Set(s.services.filter((x) => x.isActive).map((x) => x.categoryId).filter((x): x is string => !!x))].sort();
  if (ids.length) s.categoryIds = ids;
}

/** Rendez-vous à venir hors des plages données (port de `bookingsOutsideHours`). */
function outsideHours(w: World, salonId: string, ranges: { dayOfWeek: number; start: string; end: string }[], staffId?: string, now = Date.now()): OutsideBooking[] {
  const nowI = new Date(now).toISOString();
  return w.bookings
    .filter((b) => b.salonId === salonId && (b.status === 'pending' || b.status === 'confirmed') && b.startsAt >= nowI && (!staffId || b.staffId === staffId))
    .filter((b) => {
      const key = toLocalDateKey(new Date(b.startsAt));
      const dow = dayOfWeekFromKey(key);
      const s = hm(b.startsAt);
      const endKey = toLocalDateKey(new Date(b.endsAt));
      const e = endKey !== key || hm(b.endsAt) === '00:00' ? '24:00' : hm(b.endsAt);
      return !ranges.some((r) => r.dayOfWeek === dow && r.start.slice(0, 5) <= s && e <= r.end.slice(0, 5));
    })
    .map((b) => ({ id: b.id, clientName: b.clientName, serviceName: b.serviceName, startsAt: b.startsAt }));
}

function standingMessage(c: Ctx, salonId: string) {
  const u = requireUser(c);
  const standing = clientStanding(c.w, { id: u.id, phone: u.phone }, c.now);
  const blocked = c.w.blocked.some((x) => x.salonId === salonId && ((x.clientId && x.clientId === u.id) || (x.phone && x.phone === u.phone)));
  let message: string | null = null;
  if (blocked) message = "Ce salon n'accepte pas vos réservations en ligne. Contactez-le directement.";
  else if (standing.suspendedUntil) {
    const why = standing.noShows >= NO_SHOW_ABUSE_MAX ? `${standing.noShows} absences signalées en ${NO_SHOW_ABUSE_WINDOW_DAYS} jours` : `${standing.cancellations} annulations en ${CANCEL_ABUSE_WINDOW_DAYS} jours`;
    message = `Réservation en ligne suspendue jusqu'au ${fmtWhen(standing.suspendedUntil)} (${why}).`;
  }
  return { ...standing, blocked, canBook: message === null, message };
}

/** Le créneau est-il libre pour ce membre (ou pour n'importe lequel) ? Renvoie le membre retenu. */
function pickStaffFor(w: World, s: SalonOwnerView, startsAt: string, duration: number, staffId: string | null | undefined, serviceIds: string[] | undefined, enforce: boolean, exclude?: string, now = Date.now()): Staff {
  const key = toLocalDateKey(new Date(startsAt));
  const slots = availableSlots(w, s, key, duration, { staffId: staffId ?? undefined, serviceIds, enforceLeadTime: enforce, excludeBookingId: exclude, now });
  const wanted = new Date(startsAt).toISOString();
  const slot = slots.find((x) => x.startsAt === wanted);
  if (!slot) {
    // Diagnostic fidèle à la base : hors horaires, ou simplement pris.
    const dow = dayOfWeekFromKey(key);
    const open = s.openingHours.some((h) => h.dayOfWeek === dow && !h.isClosed && h.opensAt <= hm(startsAt) && hm(startsAt) < h.closesAt);
    if (!open) throw conflict('OUTSIDE_OPENING_HOURS', 'Le salon est fermé à cet horaire.');
    throw conflict(staffId ? 'STAFF_UNAVAILABLE' : 'SLOT_TAKEN', staffId ? "Ce membre n'est pas disponible à cet horaire." : 'Ce créneau vient d’être pris. Choisissez-en un autre.');
  }
  const id = staffId && slot.staffIds.includes(staffId) ? staffId : slot.staffIds[0]!;
  return s.staff.find((x) => x.id === id)!;
}

const setStatus = (w: World, b: Booking, patch: Partial<Booking>) => {
  const before = { ...b };
  Object.assign(b, patch, { updatedAt: new Date().toISOString() });
  onBookingChange(w, before, b);
  saveWorld();
};

// ---------------------------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------------------------
on('GET', '/categories', () => ok(CATEGORIES.filter((c) => !c.legacy).map((c) => ({ id: c.id, labelFr: c.labelFr, labelAr: c.labelAr, icon: c.icon, sortOrder: c.sortOrder, market: c.market }))));
on('GET', '/wilayas', () => ok(WILAYAS));

const published = (w: World) => w.salons.filter((s) => s.isPublished);
const matchGender = (s: SalonOwnerView, g: string | null) => !g || s.genderTarget === g || s.genderTarget === 'unisex';

on('GET', '/salons/cities', (c) => {
  const q = c.query;
  const gender = q.get('gender');
  const wilaya = q.get('wilaya');
  const text = q.get('q') ? unaccent(q.get('q')!) : '';
  const map = new Map<string, { city: string; parentCity: string | null; wilayaCode: number; salonCount: number; distanceKm: number | null }>();
  for (const s of published(c.w)) {
    if (!matchGender(s, gender) || (wilaya && s.wilayaCode !== Number(wilaya))) continue;
    const city = s.zone ?? s.city;
    if (text && !unaccent(city).includes(text) && !unaccent(s.city).includes(text)) continue;
    const cur = map.get(city) ?? { city, parentCity: s.zone && s.zone !== s.city ? 'Alger' : null, wilayaCode: s.wilayaCode, salonCount: 0, distanceKm: null };
    cur.salonCount++;
    map.set(city, cur);
  }
  return ok({ items: [...map.values()].sort((a, b) => b.salonCount - a.salonCount || a.city.localeCompare(b.city)) });
});

on('GET', '/salons/suggest', (c) => {
  const text = unaccent(c.query.get('q') ?? '');
  const gender = c.query.get('gender');
  const list = published(c.w).filter((s) => matchGender(s, gender));
  const salons = list
    .filter((s) => unaccent(s.name).includes(text))
    .slice(0, 5)
    .map((s) => ({ id: s.id, slug: s.slug, name: s.name, city: s.city, zone: s.zone, wilayaCode: s.wilayaCode, logoUrl: s.logoUrl, coverUrl: s.coverUrl, ratingAvg: s.ratingAvg, ratingCount: s.ratingCount, categoryId: s.categoryIds[0] ?? null }));
  const svc = new Map<string, { salonCount: number; minPriceDa: number | null }>();
  for (const s of list)
    for (const x of s.services.filter((v) => v.isActive && unaccent(v.name).includes(text))) {
      const cur = svc.get(x.name) ?? { salonCount: 0, minPriceDa: null };
      cur.salonCount++;
      cur.minPriceDa = cur.minPriceDa == null ? x.priceDa : Math.min(cur.minPriceDa, x.priceDa);
      svc.set(x.name, cur);
    }
  const places = new Map<string, { city: string; parentCity: string | null; wilayaCode: number; salonCount: number }>();
  for (const s of list) {
    const city = s.zone ?? s.city;
    if (!unaccent(city).includes(text)) continue;
    const cur = places.get(city) ?? { city, parentCity: s.zone && s.zone !== s.city ? 'Alger' : null, wilayaCode: s.wilayaCode, salonCount: 0 };
    cur.salonCount++;
    places.set(city, cur);
  }
  return ok({ salons, services: [...svc.entries()].slice(0, 6).map(([name, v]) => ({ name, ...v })), places: [...places.values()].slice(0, 5) });
});

on('GET', '/salons', (c) => {
  const q = c.query;
  const gender = q.get('gender');
  const wilaya = q.get('wilaya');
  const city = q.get('city') ? unaccent(q.get('city')!) : null;
  const category = q.get('category');
  const text = q.get('q') ? unaccent(q.get('q')!) : '';
  const lat = q.get('lat') ? Number(q.get('lat')) : null;
  const lng = q.get('lng') ? Number(q.get('lng')) : null;
  const radius = q.get('radiusKm') ? Number(q.get('radiusKm')) : null;
  const sort = q.get('sort') ?? 'relevance';
  const availableToday = ['1', 'true'].includes(q.get('availableToday') ?? '');
  const ratingMin = q.get('ratingMin') ? Number(q.get('ratingMin')) : null;
  const limit = num(q.get('limit'), 20);
  const offset = num(q.get('offset'), 0);
  const today = toLocalDateKey(new Date(c.now));
  const origin = lat != null && lng != null ? { lat, lng } : undefined;
  let items = published(c.w)
    .filter((s) => matchGender(s, gender))
    .filter((s) => !wilaya || s.wilayaCode === Number(wilaya))
    .filter((s) => !city || unaccent(s.city) === city || unaccent(s.zone ?? '') === city)
    .filter((s) => !category || s.categoryIds.includes(category))
    .filter((s) => !text || unaccent(`${s.name} ${s.city} ${s.zone ?? ''}`).includes(text) || s.services.some((v) => v.isActive && unaccent(v.name).includes(text)))
    .filter((s) => ratingMin == null || (s.ratingCount > 0 && s.ratingAvg >= ratingMin))
    .map((s) => summary(c.w, s, origin, c.now))
    .filter((s) => radius == null || s.distanceKm == null || s.distanceKm <= radius)
    .filter((s) => !availableToday || s.nextAvailable?.date === today);
  const rank = (s: ReturnType<typeof summary>) => (s.nextSlots.length ? 0 : s.nextAvailable ? 1 : 2);
  items = items.sort((a, b) => {
    if (sort === 'rating') return b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount;
    if (sort === 'price_asc') return (a.minPriceDa ?? 1e9) - (b.minPriceDa ?? 1e9);
    if (sort === 'price_desc') return (b.minPriceDa ?? -1) - (a.minPriceDa ?? -1);
    return rank(a) - rank(b) || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || b.ratingAvg - a.ratingAvg;
  });
  const p = page(items, offset, limit);
  return ok({ ...p, total: items.length });
});

on('GET', '/salons/:slug', (c, p) => {
  const s = c.w.salons.find((x) => x.slug === p.slug);
  if (!s) throw notFound('Salon');
  if (!s.isPublished && c.user?.id !== s.ownerId) throw notFound('Salon');
  return ok(publicView(s));
});

on('GET', '/salons/:id/availability', (c, p) => {
  const s = salonById(c.w, p.id!);
  if (!s) throw notFound('Salon');
  if (!s.isPublished && c.user?.id !== s.ownerId) throw notFound('Salon');
  const ids = [...(c.query.get('serviceIds')?.split(',') ?? []), ...(c.query.get('serviceId') ? [c.query.get('serviceId')!] : [])].filter((v, i, a) => a.indexOf(v) === i);
  const services = ids.map((id) => s.services.find((x) => x.id === id && x.isActive)).filter((x): x is Service => !!x);
  if (services.length !== ids.length) throw bad('SERVICE_INACTIVE', "Ce service n'est plus proposé.");
  const duration = services.reduce((a, x) => a + x.durationMinutes, 0);
  const date = c.query.get('date')!;
  const staffId = c.query.get('staffId') ?? undefined;
  const slots = availableSlots(c.w, s, date, duration, { staffId, serviceIds: ids, enforceLeadTime: true, now: c.now });
  const nextAvailable = slots.length ? null : nextAvailability(c.w, s, duration, date, daysUntilMax(s), { staffId, serviceIds: ids, enforceLeadTime: true, now: c.now });
  return ok({ salonId: s.id, serviceId: ids[0]!, serviceIds: ids, date, slotIntervalMinutes: s.slotIntervalMinutes, durationMinutes: duration, slots, nextAvailable });
});

on('GET', '/salons/:id/reviews', (c, p) => {
  const limit = num(c.query.get('limit'), 20);
  const offset = num(c.query.get('offset'), 0);
  const sort = c.query.get('sort') ?? 'best';
  const rows = c.w.reviews
    .filter((r) => r.salonId === p.id)
    .sort((a, b) => (sort === 'best' ? b.rating - a.rating : 0) || b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, authorName: r.authorName }));
  return ok(page(rows, offset, limit));
});

// ---------------------------------------------------------------------------------------------
// Moi
// ---------------------------------------------------------------------------------------------
on('GET', '/me', (c) => {
  const u = requireUser(c);
  const s = c.w.salons.find((x) => x.ownerId === u.id);
  const { email: _e, ...profile } = u;
  return ok({ profile, salon: s ? { id: s.id, slug: s.slug, name: s.name, isPublished: s.isPublished } : null, standing: u.role === 'client' ? clientStanding(c.w, { id: u.id, phone: u.phone }, c.now) : null });
});
on('GET', '/me/booking-standing/:salonId', (c, p) => ok(standingMessage(c, p.salonId!)));
on('PATCH', '/me', (c) => {
  const u = requireUser(c);
  const b = c.body as Partial<DemoProfile>;
  if (b.phone && b.phone !== u.phone && u.phone && c.w.bookings.some((x) => x.clientId === u.id))
    throw conflict('PHONE_LOCKED', 'Votre numéro est lié à vos rendez-vous : écrivez à support@salondz.com pour le modifier.');
  for (const k of ["fullName", "phone", "gender", "locale", "avatarUrl", "market", "remindersEnabled", "notifyConfirmations"] as const) if (k in b) (u as unknown as Record<string, unknown>)[k] = b[k];
  saveWorld();
  const { email: _e, ...profile } = u;
  return ok(profile);
});
on('POST', '/me/role', (c) => {
  const u = requireUser(c);
  u.role = c.body.role as 'client' | 'pro';
  saveWorld();
  const { email: _e, ...profile } = u;
  return ok(profile);
});
on('POST', '/me/push-tokens', () => none());
on('DELETE', '/me/push-tokens/:token', () => none());
on('GET', '/me/notifications', (c) => {
  const u = requireUser(c);
  const limit = num(c.query.get('limit'), 30);
  const cursor = num(c.query.get('cursor'), 0);
  const mine = c.w.notifications.filter((n) => n.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return ok({ ...page(mine, cursor, limit), unreadCount: mine.filter((n) => !n.readAt).length });
});
on('POST', '/me/notifications/read', (c) => {
  const u = requireUser(c);
  const ids = c.body.ids as string[] | undefined;
  const now = new Date().toISOString();
  for (const n of c.w.notifications) if (n.userId === u.id && !n.readAt && (!ids?.length || ids.includes(n.id))) n.readAt = now;
  saveWorld();
  return none();
});
on('GET', '/me/stats', (c) => {
  const u = requireUser(c);
  return ok({
    bookings: c.w.bookings.filter((b) => b.clientId === u.id && b.status !== 'cancelled').length,
    favorites: c.w.favorites.filter((f) => f.userId === u.id).length,
    reviews: c.w.reviews.filter((r) => r.clientId === u.id).length,
  });
});
on('GET', '/me/favorites', (c) => {
  const u = requireUser(c);
  const items = c.w.favorites
    .filter((f) => f.userId === u.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((f) => salonById(c.w, f.salonId))
    .filter((s): s is SalonOwnerView => !!s && s.isPublished)
    .map((s) => summary(c.w, s, undefined, c.now));
  return ok({ items });
});
on('PUT', '/me/favorites/:salonId', (c, p) => {
  const u = requireUser(c);
  if (!c.w.favorites.some((f) => f.userId === u.id && f.salonId === p.salonId)) c.w.favorites.push({ userId: u.id, salonId: p.salonId!, createdAt: new Date().toISOString() });
  saveWorld();
  return none();
});
on('DELETE', '/me/favorites/:salonId', (c, p) => {
  const u = requireUser(c);
  c.w.favorites = c.w.favorites.filter((f) => !(f.userId === u.id && f.salonId === p.salonId));
  saveWorld();
  return none();
});
on('GET', '/me/export', (c) => {
  const u = requireUser(c);
  const { email, ...profile } = u;
  return ok({
    exportedAt: new Date().toISOString(),
    account: { id: u.id, email },
    profile,
    bookings: c.w.bookings.filter((b) => b.clientId === u.id || b.bookedBy === u.id),
    reviews: c.w.reviews.filter((r) => r.clientId === u.id),
    favorites: c.w.favorites.filter((f) => f.userId === u.id),
  });
});
on('DELETE', '/me', (c) => {
  const u = requireUser(c);
  if (c.w.salons.some((s) => s.ownerId === u.id)) throw conflict('HAS_SALON', 'Votre compte porte un salon : écrivez à support@salondz.com pour le fermer avant de supprimer le compte.');
  // Démonstration : le monde repart de zéro sur cet appareil.
  resetWorld();
  return none();
});
on('GET', '/me/slot-alerts', (c) => {
  const u = requireUser(c);
  const today = toLocalDateKey(new Date(c.now));
  const salonId = c.query.get('salonId');
  return ok({ items: c.w.slotAlerts.filter((a) => a.clientId === u.id && a.day >= today && (!salonId || a.salonId === salonId)).map(({ clientId: _c, ...a }) => a) });
});
on('POST', '/me/slot-alerts', (c) => {
  const u = requireUser(c);
  const today = toLocalDateKey(new Date(c.now));
  const open = c.w.slotAlerts.filter((a) => a.clientId === u.id && a.day >= today);
  if (open.length >= SLOT_ALERT_MAX_PER_CLIENT) throw conflict('TOO_MANY_ALERTS', `Vous avez déjà ${SLOT_ALERT_MAX_PER_CLIENT} alertes actives : retirez-en une avant d'en ajouter.`);
  const body = c.body as { salonId: string; day: string; serviceId?: string };
  c.w.slotAlerts = c.w.slotAlerts.filter((a) => !(a.clientId === u.id && a.salonId === body.salonId && a.day === body.day));
  const a = { id: uid(), clientId: u.id, salonId: body.salonId, serviceId: body.serviceId ?? null, day: body.day, createdAt: new Date().toISOString() };
  c.w.slotAlerts.push(a);
  saveWorld();
  const { clientId: _c, ...out } = a;
  return created(out);
});
on('DELETE', '/me/slot-alerts/:id', (c, p) => {
  const u = requireUser(c);
  c.w.slotAlerts = c.w.slotAlerts.filter((a) => !(a.id === p.id && a.clientId === u.id));
  saveWorld();
  return none();
});

// ---------------------------------------------------------------------------------------------
// Réservations (client)
// ---------------------------------------------------------------------------------------------
const mineBooking = (b: Booking, uid: string) => b.clientId === uid || b.bookedBy === uid;

on('POST', '/bookings', (c) => {
  const u = requireUser(c);
  const body = c.body as { salonId: string; serviceId?: string; serviceIds?: string[]; staffId?: string | null; startsAt: string; notes?: string; clientName?: string; clientPhone?: string; beneficiary?: { fullName: string; phone: string } };
  const s = salonById(c.w, body.salonId);
  if (!s) throw notFound('Salon');
  if (!s.isPublished) throw conflict('SALON_NOT_PUBLISHED', "Ce salon n'accepte pas encore de réservations.");
  const forOther = !!body.beneficiary && body.beneficiary.phone !== u.phone;
  const who = forOther ? { id: Object.values(c.w.profiles).find((p) => p.phone === body.beneficiary!.phone)?.id ?? null, phone: body.beneficiary!.phone } : { id: u.id, phone: u.phone };
  const clientName = forOther ? body.beneficiary!.fullName : (body.clientName ?? u.fullName);
  if (!clientName) throw bad('NAME_REQUIRED', 'Indiquez votre nom pour réserver.');
  const ids = body.serviceIds?.length ? body.serviceIds : [body.serviceId!];
  const services = ids.map((id) => s.services.find((x) => x.id === id && x.isActive)).filter((x): x is Service => !!x);
  if (services.length !== ids.length) throw bad('SERVICE_INACTIVE', "Ce service n'est plus proposé.");
  const standing = clientStanding(c.w, who, c.now);
  if (standing.suspendedUntil) {
    const why = standing.noShows >= NO_SHOW_ABUSE_MAX ? `${standing.noShows} absences signalées en ${NO_SHOW_ABUSE_WINDOW_DAYS} jours` : `${standing.cancellations} annulations en ${CANCEL_ABUSE_WINDOW_DAYS} jours`;
    throw conflict('BOOKING_SUSPENDED', `Réservation en ligne suspendue jusqu'au ${fmtWhen(standing.suspendedUntil)} (${why}).`);
  }
  if (c.w.blocked.some((x) => x.salonId === s.id && ((who.id && x.clientId === who.id) || (who.phone && x.phone === who.phone)))) throw conflict('CLIENT_BLOCKED', "Ce salon n'accepte pas vos réservations en ligne.");
  const nowI = new Date(c.now).toISOString();
  const upcoming = c.w.bookings.filter((b) => concerns(b, who) && (b.status === 'pending' || b.status === 'confirmed') && b.endsAt >= nowI);
  if (upcoming.length >= MAX_UPCOMING_BOOKINGS_PER_CLIENT) throw conflict('TOO_MANY_BOOKINGS', `Vous avez déjà ${MAX_UPCOMING_BOOKINGS_PER_CLIENT} rendez-vous à venir. Annulez-en un pour réserver.`);
  const duration = services.reduce((a, x) => a + x.durationMinutes, 0);
  const startMs = new Date(body.startsAt).getTime();
  if (startMs < c.now) throw conflict('IN_PAST', 'Cet horaire est passé.');
  if (startMs < c.now + s.bookingLeadTimeMinutes * 60_000) throw conflict('TOO_SOON', `Réservez au moins ${s.bookingLeadTimeMinutes} min à l'avance.`);
  if (startMs > c.now + s.bookingHorizonDays * 86_400_000) throw conflict('TOO_FAR', `Ce salon prend les réservations jusqu'à ${s.bookingHorizonDays} jours à l'avance.`);
  const endIso = new Date(startMs + duration * 60_000).toISOString();
  if (upcoming.some((b) => b.salonId === s.id && b.startsAt < endIso && b.endsAt > body.startsAt)) throw conflict('ALREADY_BOOKED', 'Vous avez déjà un rendez-vous dans ce salon à cet horaire.');
  const staff = pickStaffFor(c.w, s, body.startsAt, duration, body.staffId, ids, true, undefined, c.now);
  const first = services[0]!;
  const b = bookingRow(s, { ...first, name: services.map((x) => x.name).join(' + '), durationMinutes: duration, priceDa: services.reduce((a, x) => a + x.priceDa, 0) }, staff.id, new Date(startMs).toISOString(), s.autoConfirm ? 'confirmed' : 'pending', { id: who.id, name: clientName, phone: who.phone ?? body.clientPhone ?? null }, {
    source: 'online',
    notes: body.notes ?? null,
    bookedBy: forOther ? u.id : null,
    bookedByName: forOther ? u.fullName : null,
  });
  c.w.bookings.push(b);
  onBookingChange(c.w, null, b);
  saveWorld();
  return created(withSalon(c.w, b));
});

on('GET', '/me/bookings', (c) => {
  const u = requireUser(c);
  const scope = c.query.get('scope') ?? 'upcoming';
  const limit = num(c.query.get('limit'), 20);
  const cursor = num(c.query.get('cursor'), 0);
  const nowI = new Date(c.now).toISOString();
  let rows = c.w.bookings.filter((b) => mineBooking(b, u.id));
  if (scope === 'upcoming') rows = rows.filter((b) => b.endsAt >= nowI && (b.status === 'pending' || b.status === 'confirmed')).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  else if (scope === 'cancelled') rows = rows.filter((b) => b.status === 'cancelled').sort((a, b) => String(b.cancelledAt).localeCompare(String(a.cancelledAt)));
  else rows = rows.filter((b) => b.status !== 'cancelled' && (b.endsAt < nowI || b.status === 'completed' || b.status === 'no_show')).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return ok(page(rows.map((b) => withSalon(c.w, b)), cursor, limit));
});

on('GET', '/bookings/:id', (c, p) => {
  const u = requireUser(c);
  const b = c.w.bookings.find((x) => x.id === p.id && mineBooking(x, u.id));
  if (!b) throw notFound('Réservation');
  return ok(withSalon(c.w, b));
});

on('POST', '/bookings/:id/cancel', (c, p) => {
  const u = requireUser(c);
  const b = c.w.bookings.find((x) => x.id === p.id && mineBooking(x, u.id));
  if (!b) throw notFound('Réservation');
  if (b.status !== 'pending' && b.status !== 'confirmed') throw conflict('BOOKING_NOT_CANCELLABLE', 'Cette réservation ne peut plus être annulée.');
  const s = salonById(c.w, b.salonId)!;
  const minHours = s.cancelMinHours ?? CLIENT_CANCEL_MIN_HOURS;
  if ((new Date(b.startsAt).getTime() - c.now) / 3_600_000 < minHours) throw conflict('CANCEL_TOO_LATE', `Annulation en ligne impossible à moins de ${minHours} h. Contactez le salon.`);
  setStatus(c.w, b, { status: 'cancelled', cancelledAt: new Date(c.now).toISOString(), cancelledBy: 'client', cancellationReason: (c.body.reason as string | undefined) ?? null });
  return ok(withSalon(c.w, b));
});

on('POST', '/bookings/:id/reschedule', (c, p) => {
  const u = requireUser(c);
  const b = c.w.bookings.find((x) => x.id === p.id && mineBooking(x, u.id));
  if (!b) throw notFound('Réservation');
  const s = salonById(c.w, b.salonId)!;
  if (b.status !== 'pending' && b.status !== 'confirmed') throw conflict('BOOKING_NOT_CANCELLABLE', 'Cette réservation ne peut plus être déplacée.');
  if (!s.allowClientReschedule) throw conflict('RESCHEDULE_DISABLED', 'Ce salon ne permet pas le report en ligne. Contactez-le.');
  if (b.clientReschedules >= MAX_CLIENT_RESCHEDULES) throw conflict('RESCHEDULE_LIMIT', 'Ce rendez-vous a déjà été déplacé une fois. Contactez le salon.');
  if ((new Date(b.startsAt).getTime() - c.now) / 3_600_000 < s.cancelMinHours) throw conflict('CANCEL_TOO_LATE', `Report en ligne impossible à moins de ${s.cancelMinHours} h. Contactez le salon.`);
  const startsAt = new Date(c.body.startsAt as string).toISOString();
  const startMs = new Date(startsAt).getTime();
  if (startMs < c.now + s.bookingLeadTimeMinutes * 60_000) throw conflict('TOO_SOON', `Réservez au moins ${s.bookingLeadTimeMinutes} min à l'avance.`);
  if (startMs > c.now + s.bookingHorizonDays * 86_400_000) throw conflict('TOO_FAR', `Ce salon prend les réservations jusqu'à ${s.bookingHorizonDays} jours à l'avance.`);
  const staff = pickStaffFor(c.w, s, startsAt, b.durationMinutes, (c.body.staffId as string | null | undefined) ?? b.staffId, [b.serviceId], true, b.id, c.now);
  const before = { ...b };
  Object.assign(b, { startsAt, endsAt: new Date(startMs + b.durationMinutes * 60_000).toISOString(), staffId: staff.id, clientReschedules: b.clientReschedules + 1, updatedAt: new Date().toISOString() });
  onBookingChange(c.w, before, b);
  if (c.w.profiles[s.ownerId]) notify(c.w, s.ownerId, 'booking_rescheduled', 'Rendez-vous déplacé', `${b.clientName} · ${b.serviceName} · ${fmtWhen(b.startsAt)}`, b);
  saveWorld();
  return ok(withSalon(c.w, b));
});

on('POST', '/bookings/:id/review', (c, p) => {
  const u = requireUser(c);
  const b = c.w.bookings.find((x) => x.id === p.id);
  if (!b || b.clientId !== u.id) throw new HttpError(403, 'FORBIDDEN', 'Accès refusé.');
  if (b.status !== 'completed') throw conflict('BOOKING_NOT_COMPLETED', 'Vous pourrez laisser un avis après le rendez-vous.');
  if (c.w.reviews.some((r) => r.bookingId === b.id)) throw conflict('ALREADY_REVIEWED', 'Vous avez déjà noté ce rendez-vous.');
  const r = { id: uid(), salonId: b.salonId, bookingId: b.id, clientId: u.id, rating: c.body.rating as 1 | 2 | 3 | 4 | 5, comment: (c.body.comment as string | undefined) ?? null, createdAt: new Date().toISOString(), authorName: u.fullName ? `${u.fullName.split(' ')[0]} ${u.fullName.split(' ')[1]?.[0] ?? ''}`.trim() : 'Client' };
  c.w.reviews.push(r);
  refreshRating(c.w, b.salonId);
  saveWorld();
  const { authorName: _a, ...review } = r;
  return created(review);
});

// ---------------------------------------------------------------------------------------------
// Espace pro : salon
// ---------------------------------------------------------------------------------------------
on('GET', '/pro/salon', (c) => {
  const u = requireUser(c);
  return ok({ salon: c.w.salons.find((x) => x.ownerId === u.id) ?? null });
});
on('POST', '/pro/salon', (c) => {
  requireUser(c);
  throw conflict('SALON_EXISTS', 'Vous avez déjà un salon.');
});
on('PATCH', '/pro/salon', (c) => {
  const s = ownedSalon(c);
  const { categoryIds, ...rest } = c.body as Partial<SalonOwnerView> & { categoryIds?: string[] };
  if (rest.isPublished === true && !s.isPublished) {
    const problems: string[] = [];
    if (!s.services.some((x) => x.isActive)) problems.push('Ajoutez au moins un service.');
    if (!s.openingHours.some((h) => !h.isClosed)) problems.push("Définissez vos horaires d'ouverture.");
    if (!s.staff.some((x) => x.isActive)) problems.push('Ajoutez au moins un membre à votre équipe.');
    if (problems.length) throw bad('CANNOT_PUBLISH', 'Le salon ne peut pas encore être publié.', problems);
  }
  for (const [k, v] of Object.entries(rest)) if (v !== undefined && k !== 'slug' && k !== 'id' && k !== 'ownerId') (s as unknown as Record<string, unknown>)[k] = v;
  if (categoryIds) s.categoryIds = [...categoryIds].sort();
  return ok(touch(c.w, s));
});
on('PUT', '/pro/salon/photos', (c) => {
  const s = ownedSalon(c);
  const photos = (c.body.photos as { url: string }[]) ?? [];
  s.photos = photos.map((p, i) => ({ id: uid(), salonId: s.id, url: p.url, sortOrder: i, kind: 'cover' as const }));
  s.coverUrl = photos[0]?.url ?? null;
  return ok(touch(c.w, s));
});
on('PUT', '/pro/salon/works', (c) => {
  const s = ownedSalon(c);
  s.works = ((c.body.photos as { url: string }[]) ?? []).map((p, i) => ({ id: uid(), salonId: s.id, url: p.url, sortOrder: i, kind: 'work' as const }));
  return ok(touch(c.w, s));
});
on('PUT', '/pro/salon/hours', (c) => {
  const s = ownedSalon(c);
  const hours = c.body.hours as { dayOfWeek: number; opensAt: string; closesAt: string; isClosed?: boolean }[];
  s.openingHours = hours.map((h) => ({ id: uid(), salonId: s.id, dayOfWeek: h.dayOfWeek as 0, opensAt: h.opensAt, closesAt: h.closesAt, isClosed: !!h.isClosed })).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.opensAt.localeCompare(b.opensAt));
  const outsideBookings = outsideHours(c.w, s.id, hours.filter((h) => !h.isClosed).map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.opensAt, end: h.closesAt })), undefined, c.now);
  return ok({ ...touch(c.w, s), outsideBookings });
});
on('GET', '/pro/salon/slug-check', (c) => {
  const slug = unaccent(c.query.get('name') ?? '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return ok({ slug, available: !c.w.salons.some((s) => s.slug === slug) });
});
on('GET', '/pro/stats', (c) => ok(dashboardStats(c.w, ownedSalon(c).id, c.now)));
on('GET', '/pro/stats/range', (c) => ok(statsRange(c.w, ownedSalon(c).id, c.query.get('from')!, c.query.get('to')!)));

// ---------------------------------------------------------------------------------------------
// Espace pro : prestations
// ---------------------------------------------------------------------------------------------
const serviceBooked = (w: World, id: string) => w.bookings.some((b) => b.serviceId === id);
function removeOrArchive(w: World, s: SalonOwnerView, id: string): 'deleted' | 'archived' {
  const svc = s.services.find((x) => x.id === id)!;
  if (serviceBooked(w, id)) {
    Object.assign(svc, { isActive: false, groupName: null, categoryId: null });
    return 'archived';
  }
  s.services = s.services.filter((x) => x.id !== id);
  return 'deleted';
}
const currentGroup = (r: Service) => r.groupName?.trim() || (r.categoryId ? categoryLabel(r.categoryId) : null);

on('POST', '/pro/services/rename-category', (c) => {
  const s = ownedSalon(c);
  const { from, name } = c.body as { from: string; name: string };
  const targets = s.services.filter((r) => currentGroup(r) === from);
  if (!targets.length) throw notFound('Catégorie');
  for (const r of targets) r.groupName = r.categoryId && categoryLabel(r.categoryId) === name ? null : name;
  touch(c.w, s);
  return ok({ renamed: targets.length });
});
on('POST', '/pro/services/delete-category', (c) => {
  const s = ownedSalon(c);
  const { name, mode } = c.body as { name: string; mode: 'with-services' | 'keep-services' };
  const targets = s.services.filter((r) => r.isActive && currentGroup(r) === name);
  if (!targets.length) throw notFound('Catégorie');
  let deleted = 0;
  let archived = 0;
  for (const r of targets) {
    if (mode === 'keep-services') Object.assign(r, { groupName: null, categoryId: null });
    else if (removeOrArchive(c.w, s, r.id) === 'deleted') deleted++;
    else archived++;
  }
  syncCategories(s);
  touch(c.w, s);
  return ok({ deleted, archived, moved: mode === 'keep-services' ? targets.length : 0 });
});
on('POST', '/pro/services', (c) => {
  const s = ownedSalon(c);
  if (s.services.length >= MAX_SERVICES_PER_SALON) throw conflict('LIMIT_REACHED', `Un catalogue compte au plus ${MAX_SERVICES_PER_SALON} prestations.`);
  const b = c.body as Partial<Service>;
  const svc: Service = { id: uid(), salonId: s.id, name: b.name!, description: b.description ?? null, durationMinutes: b.durationMinutes!, priceDa: b.priceDa!, categoryId: b.categoryId ?? null, groupName: b.groupName ?? null, isActive: b.isActive ?? true, sortOrder: s.services.length, photos: [] };
  s.services.push(svc);
  syncCategories(s);
  touch(c.w, s);
  return created(svc);
});
on('PATCH', '/pro/services/:id', (c, p) => {
  const s = ownedSalon(c);
  const svc = s.services.find((x) => x.id === p.id);
  if (!svc) throw notFound('Service');
  for (const [k, v] of Object.entries(c.body)) if (v !== undefined && k in svc && k !== 'id' && k !== 'salonId') (svc as unknown as Record<string, unknown>)[k] = v;
  syncCategories(s);
  touch(c.w, s);
  return ok(svc);
});
on('DELETE', '/pro/services/:id', (c, p) => {
  const s = ownedSalon(c);
  if (!s.services.some((x) => x.id === p.id)) throw notFound('Service');
  const outcome = removeOrArchive(c.w, s, p.id!);
  syncCategories(s);
  touch(c.w, s);
  return ok({ deleted: outcome === 'deleted', deactivated: outcome === 'archived' });
});
on('PUT', '/pro/services/reorder', (c) => {
  const s = ownedSalon(c);
  (c.body.ids as string[]).forEach((id, i) => {
    const svc = s.services.find((x) => x.id === id);
    if (svc) svc.sortOrder = i;
  });
  s.services.sort((a, b) => a.sortOrder - b.sortOrder);
  touch(c.w, s);
  return none();
});
on('PUT', '/pro/services/:id/photos', (c, p) => {
  const s = ownedSalon(c);
  const svc = s.services.find((x) => x.id === p.id);
  if (!svc) throw notFound('Service');
  svc.photos = ((c.body.photos as { url: string }[]) ?? []).map((x, i) => ({ id: uid(), url: x.url, sortOrder: i }));
  touch(c.w, s);
  return none();
});

// ---------------------------------------------------------------------------------------------
// Espace pro : équipe
// ---------------------------------------------------------------------------------------------
on('POST', '/pro/staff', (c) => {
  const s = ownedSalon(c);
  if (s.staff.length >= MAX_STAFF_PER_SALON) throw conflict('LIMIT_REACHED', `Une équipe compte au plus ${MAX_STAFF_PER_SALON} membres.`);
  const b = c.body as Partial<Staff>;
  const all = (b.allServices ?? true) || !b.serviceIds?.length;
  const m: Staff = { id: uid(), salonId: s.id, userId: null, displayName: b.displayName!, phone: b.phone ?? null, avatarUrl: b.avatarUrl ?? null, isActive: true, sortOrder: s.staff.length, allServices: all, serviceIds: all ? [] : (b.serviceIds ?? []) };
  s.staff.push(m);
  touch(c.w, s);
  return created(m);
});
on('PATCH', '/pro/staff/:id', (c, p) => {
  const s = ownedSalon(c);
  const m = s.staff.find((x) => x.id === p.id);
  if (!m) throw notFound('Membre');
  const b = c.body as Partial<Staff>;
  if (b.isActive === false && !s.staff.some((x) => x.isActive && x.id !== m.id)) throw conflict('LAST_STAFF', 'Il faut au moins un membre actif.');
  for (const k of ['displayName', 'phone', 'avatarUrl', 'isActive', 'sortOrder'] as const) if (b[k] !== undefined) (m as unknown as Record<string, unknown>)[k] = b[k];
  if (b.allServices !== undefined || b.serviceIds !== undefined) {
    const all = (b.allServices ?? false) || !b.serviceIds?.length;
    m.allServices = all;
    m.serviceIds = all ? [] : (b.serviceIds ?? []).filter((id) => s.services.some((x) => x.id === id));
  }
  touch(c.w, s);
  return ok(m);
});
on('DELETE', '/pro/staff/:id', (c, p) => {
  const s = ownedSalon(c);
  const m = s.staff.find((x) => x.id === p.id);
  if (!m) throw notFound('Membre');
  if (!s.staff.some((x) => x.isActive && x.id !== m.id)) throw conflict('LAST_STAFF', 'Il faut au moins un membre actif.');
  if (c.w.bookings.some((b) => b.staffId === m.id)) {
    m.isActive = false;
    touch(c.w, s);
    return ok({ deleted: false, deactivated: true });
  }
  s.staff = s.staff.filter((x) => x.id !== m.id);
  touch(c.w, s);
  return ok({ deleted: true, deactivated: false });
});
on('GET', '/pro/staff/:id/hours', (c, p) => {
  ownedSalon(c);
  return ok(c.w.staffHours.filter((h) => h.staffId === p.id).sort((a, b) => a.dayOfWeek - b.dayOfWeek));
});
on('PUT', '/pro/staff/:id/hours', (c, p) => {
  const s = ownedSalon(c);
  if (!s.staff.some((x) => x.id === p.id)) throw notFound('Membre');
  const hours = (c.body.hours as { dayOfWeek: number; startsAt: string; endsAt: string }[]) ?? [];
  c.w.staffHours = [...c.w.staffHours.filter((h) => h.staffId !== p.id), ...hours.map((h): StaffHour => ({ id: uid(), staffId: p.id!, dayOfWeek: h.dayOfWeek as 0, startsAt: h.startsAt, endsAt: h.endsAt }))];
  const ranges = hours.length ? hours.map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.startsAt, end: h.endsAt })) : s.openingHours.filter((h) => !h.isClosed).map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.opensAt, end: h.closesAt }));
  saveWorld();
  return ok({ outsideBookings: outsideHours(c.w, s.id, ranges, p.id, c.now) });
});

// ---------------------------------------------------------------------------------------------
// Espace pro : clients
// ---------------------------------------------------------------------------------------------
on('GET', '/pro/clients', (c) => {
  const s = ownedSalon(c);
  const q = c.query.get('q') ? unaccent(c.query.get('q')!) : '';
  const limit = num(c.query.get('limit'), 30);
  const offset = num(c.query.get('cursor'), 0);
  const all = proClients(c.w, s.id, c.now);
  const items = all.filter((x) => !q || unaccent(x.name).includes(q) || (x.phone ?? '').includes(q.replace(/\s/g, '')));
  return ok({ ...page(items, offset, limit), total: items.length, blockedCount: all.filter((x) => x.blocked).length });
});
on('GET', '/pro/clients/:key', (c, p) => {
  const s = ownedSalon(c);
  const one = proClients(c.w, s.id, c.now).find((x) => x.clientKey === decodeURIComponent(p.key!));
  if (!one) throw notFound('Client');
  return ok(one);
});
on('GET', '/pro/clients/:key/history', (c, p) => {
  const s = ownedSalon(c);
  const key = decodeURIComponent(p.key!);
  const status = c.query.get('status');
  const limit = num(c.query.get('limit'), 50);
  const offset = num(c.query.get('cursor'), 0);
  const rows = c.w.bookings
    .filter((b) => b.salonId === s.id && clientKeyOf(b) === key && (!status || b.status === status))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .map((b) => ({ id: b.id, startsAt: b.startsAt, endsAt: b.endsAt, serviceName: b.serviceName, priceDa: b.priceDa, status: b.status, cancelledBy: b.cancelledBy, staffName: s.staff.find((x) => x.id === b.staffId)?.displayName ?? null }));
  return ok({ ...page(rows, offset, limit), total: rows.length });
});
on('PUT', '/pro/clients/:key/notes', (c, p) => {
  const s = ownedSalon(c);
  c.w.notes[`${s.id}:${decodeURIComponent(p.key!)}`] = c.body.notes as string;
  saveWorld();
  return none();
});
on('POST', '/pro/clients/block', (c) => {
  const s = ownedSalon(c);
  const { clientId, phone, reason } = c.body as { clientId?: string; phone?: string; reason?: string };
  if (clientId && clientId === c.user!.id) throw bad('SELF_BLOCK', 'Vous ne pouvez pas vous bloquer vous-même.');
  c.w.blocked = c.w.blocked.filter((x) => !(x.salonId === s.id && ((clientId && x.clientId === clientId) || (phone && x.phone === phone))));
  c.w.blocked.push({ id: uid(), salonId: s.id, clientId: clientId ?? null, phone: phone ?? null, reason: reason ?? null });
  saveWorld();
  return none();
});
on('POST', '/pro/clients/unblock', (c) => {
  const s = ownedSalon(c);
  const { clientId, phone } = c.body as { clientId?: string; phone?: string };
  c.w.blocked = c.w.blocked.filter((x) => !(x.salonId === s.id && ((clientId && x.clientId === clientId) || (phone && x.phone === phone))));
  saveWorld();
  return none();
});

// ---------------------------------------------------------------------------------------------
// Espace pro : fermetures
// ---------------------------------------------------------------------------------------------
on('GET', '/pro/blocks', (c) => {
  const s = ownedSalon(c);
  const from = c.query.get('from') ?? toLocalDateKey(new Date(c.now));
  const to = c.query.get('to') ?? addDaysToKey(from, 30);
  const fromI = localDateTimeToISO(from, '00:00');
  const toI = localDateTimeToISO(addDaysToKey(to, 1), '00:00');
  return ok({ items: c.w.blocks.filter((t) => t.salonId === s.id && t.startsAt < toI && t.endsAt > fromI).sort((a, b) => a.startsAt.localeCompare(b.startsAt)) });
});
on('POST', '/pro/blocks', (c) => {
  const s = ownedSalon(c);
  const b = c.body as { staffId?: string | null; startsAt: string; endsAt: string; reason?: string; cancelBookings?: boolean };
  if (b.staffId && !s.staff.some((x) => x.id === b.staffId)) throw notFound('Membre');
  const hits = c.w.bookings.filter((x) => x.salonId === s.id && (x.status === 'pending' || x.status === 'confirmed') && x.startsAt < b.endsAt && x.endsAt > b.startsAt && (!b.staffId || x.staffId === b.staffId)).sort((x, y) => x.startsAt.localeCompare(y.startsAt));
  if (hits.length && !b.cancelBookings)
    throw conflict('BLOCK_CONFLICT', `${hits.length} rendez-vous ${hits.length > 1 ? 'tombent' : 'tombe'} dans cette période.`, hits.map((x) => ({ id: x.id, clientName: x.clientName, serviceName: x.serviceName, startsAt: x.startsAt })));
  for (const x of hits) setStatus(c.w, x, { status: 'cancelled', cancelledAt: new Date(c.now).toISOString(), cancelledBy: 'salon', cancellationReason: b.reason?.trim() || 'Fermeture du salon' });
  const t: TimeBlock = { id: uid(), salonId: s.id, staffId: b.staffId ?? null, startsAt: new Date(b.startsAt).toISOString(), endsAt: new Date(b.endsAt).toISOString(), reason: b.reason ?? null };
  c.w.blocks.push(t);
  saveWorld();
  return created(t);
});
on('DELETE', '/pro/blocks/:id', (c, p) => {
  const s = ownedSalon(c);
  if (!c.w.blocks.some((t) => t.id === p.id && t.salonId === s.id)) throw notFound('Blocage');
  c.w.blocks = c.w.blocks.filter((t) => t.id !== p.id);
  saveWorld();
  return none();
});

// ---------------------------------------------------------------------------------------------
// Espace pro : réservations
// ---------------------------------------------------------------------------------------------
const TRANSITIONS: Record<string, string[]> = { pending: ['confirmed', 'cancelled'], confirmed: ['completed', 'no_show', 'cancelled'], completed: ['no_show'], cancelled: [], no_show: ['completed'] };
const proBooking = (c: Ctx, id: string) => {
  const s = ownedSalon(c);
  const b = c.w.bookings.find((x) => x.id === id && x.salonId === s.id);
  if (!b) throw notFound('Réservation');
  return { s, b };
};

on('GET', '/pro/bookings', (c) => {
  const s = ownedSalon(c);
  const from = c.query.get('from') ?? toLocalDateKey(new Date(c.now));
  const to = c.query.get('to') ?? addDaysToKey(from, 6);
  const status = c.query.get('status');
  const staffId = c.query.get('staffId');
  const limit = num(c.query.get('limit'), 100);
  const offset = num(c.query.get('cursor'), 0);
  const fromI = localDateTimeToISO(from, '00:00');
  const toI = localDateTimeToISO(addDaysToKey(to, 1), '00:00');
  const rows = c.w.bookings
    .filter((b) => b.salonId === s.id && b.startsAt >= fromI && b.startsAt < toI && (!status || b.status === status) && (!staffId || b.staffId === staffId))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((b) => withStaff(c.w, b));
  return ok(page(rows, offset, limit));
});
on('GET', '/pro/bookings/pending', (c) => {
  const s = ownedSalon(c);
  const nowI = new Date(c.now).toISOString();
  return ok({ items: c.w.bookings.filter((b) => b.salonId === s.id && b.status === 'pending' && b.startsAt >= nowI).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 100).map((b) => withStaff(c.w, b)), nextCursor: null });
});
on('POST', '/pro/bookings', (c) => {
  const s = ownedSalon(c);
  const body = c.body as { serviceId: string; staffId: string; startsAt: string; clientName: string; clientPhone?: string; notes?: string; source?: Booking['source'] };
  const svc = s.services.find((x) => x.id === body.serviceId);
  if (!svc) throw notFound('Service');
  const staff = pickStaffFor(c.w, s, body.startsAt, svc.durationMinutes, body.staffId, undefined, false, undefined, c.now);
  const b = bookingRow(s, svc, staff.id, new Date(body.startsAt).toISOString(), 'confirmed', { id: null, name: body.clientName, phone: body.clientPhone ?? null }, { source: body.source ?? 'walk_in', notes: body.notes ?? null });
  c.w.bookings.push(b);
  onBookingChange(c.w, null, b);
  saveWorld();
  return created(withStaff(c.w, b));
});
on('GET', '/pro/bookings/:id', (c, p) => ok(withStaff(c.w, proBooking(c, p.id!).b)));
on('POST', '/pro/bookings/:id/status', (c, p) => {
  const { b } = proBooking(c, p.id!);
  const status = c.body.status as Booking['status'];
  if (!TRANSITIONS[b.status]?.includes(status)) throw conflict('INVALID_TRANSITION', `Impossible de passer de "${b.status}" à "${status}".`);
  const startMs = new Date(b.startsAt).getTime();
  if (status === 'confirmed' && startMs < c.now) throw conflict('BOOKING_EXPIRED', "L'heure de cette demande est passée : elle ne peut plus être confirmée.");
  if (status === 'no_show' && startMs > c.now) throw conflict('NOT_STARTED', "Le rendez-vous n'a pas encore commencé.");
  setStatus(c.w, b, { status });
  return ok(withStaff(c.w, b));
});
on('POST', '/pro/bookings/:id/cancel', (c, p) => {
  const { b } = proBooking(c, p.id!);
  const body = c.body as { reason?: string; late?: boolean };
  if (!TRANSITIONS[b.status]?.includes('cancelled')) throw conflict('BOOKING_NOT_CANCELLABLE', 'Cette réservation ne peut plus être annulée.');
  if (body.late) {
    if (!isLate(b.startsAt, c.now)) throw conflict('NOT_LATE_YET', `Le retard toléré (${LATE_TOLERANCE_MINUTES} min) n'est pas encore dépassé.`);
  } else if (new Date(b.startsAt).getTime() < c.now) throw conflict('BOOKING_STARTED', 'Ce rendez-vous est passé : marquez-le « Terminé », « Client absent » ou annulez-le pour retard.');
  setStatus(c.w, b, { status: 'cancelled', cancelledAt: new Date(c.now).toISOString(), cancelledBy: 'salon', cancellationReason: body.reason ?? (body.late ? `Retard de plus de ${LATE_TOLERANCE_MINUTES} min` : null), cancellationKind: body.late ? 'late' : null });
  return ok(withStaff(c.w, b));
});
on('POST', '/pro/bookings/:id/reschedule', (c, p) => {
  const { s, b } = proBooking(c, p.id!);
  const startsAt = new Date(c.body.startsAt as string).toISOString();
  const wanted = (c.body.staffId as string | null | undefined) ?? b.staffId;
  if (wanted && !staffPick(s, wanted)) throw notFound('Membre');
  const staff = pickStaffFor(c.w, s, startsAt, b.durationMinutes, wanted, undefined, false, b.id, c.now);
  const before = { ...b };
  Object.assign(b, { startsAt, endsAt: new Date(new Date(startsAt).getTime() + b.durationMinutes * 60_000).toISOString(), staffId: staff.id, updatedAt: new Date().toISOString() });
  onBookingChange(c.w, before, b);
  saveWorld();
  return ok(withStaff(c.w, b));
});

// ---------------------------------------------------------------------------------------------
// Authentification : sans objet en démonstration
// ---------------------------------------------------------------------------------------------
on('POST', '/auth/:any', () => {
  throw bad('DEMO', 'Indisponible en démonstration.');
});

export function dispatch(c: Ctx): Result {
  advance(c.w, c.now);
  for (const r of routes) {
    if (r.m !== c.method) continue;
    const m = r.re.exec(c.path);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = m[i + 1]!));
    return r.h(c, params);
  }
  throw notFound('Ressource');
}

export { getWorld };
