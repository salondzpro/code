/**
 * Calculs de la démonstration : disponibilités (port de `get_available_slots_for`), situation anti-abus
 * (port de `clientStanding`), statistiques (port de `pro_stats`), fiches client (port de
 * `salon_clients_page`), cartes de la marketplace. Tout est pur : le monde entre, une réponse sort.
 */
import {
  CANCEL_ABUSE_BLOCK_DAYS,
  CANCEL_ABUSE_MAX,
  CANCEL_ABUSE_WINDOW_DAYS,
  NO_SHOW_ABUSE_BLOCK_DAYS,
  NO_SHOW_ABUSE_MAX,
  NO_SHOW_ABUSE_WINDOW_DAYS,
  addDaysToKey,
  dayOfWeekFromKey,
  localDateTimeToISO,
  toLocalDateKey,
  weekKeys,
} from '@salondz/constants';
import type { AvailabilitySlot, Booking, ClientStanding, ProClient, ProDashboardStats, ProStatsRange, SalonOwnerView, SalonSummary } from '@salondz/types';
import type { World } from './world';

const DAY = 86_400_000;
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

export interface SlotOptions {
  staffId?: string | null;
  serviceIds?: string[];
  enforceLeadTime?: boolean;
  excludeBookingId?: string | null;
  now?: number;
}

/** Créneaux libres d'une journée pour une durée donnée : même règles que la base. */
export function availableSlots(w: World, salon: SalonOwnerView, dateKey: string, duration: number, opts: SlotOptions = {}): AvailabilitySlot[] {
  if (duration <= 0) return [];
  const now = opts.now ?? Date.now();
  const dow = dayOfWeekFromKey(dateKey);
  const dayStart = localDateTimeToISO(dateKey, '00:00');
  const dayEnd = localDateTimeToISO(addDaysToKey(dateKey, 1), '00:00');
  const step = salon.slotIntervalMinutes * 60_000;
  const buffer = (salon.bufferMinutes ?? 0) * 60_000;
  const minStart = opts.enforceLeadTime === false ? now - DAY : now + salon.bookingLeadTimeMinutes * 60_000;
  const opening = salon.openingHours.filter((h) => h.dayOfWeek === dow && !h.isClosed);
  if (!opening.length) return [];
  const staffSet = salon.staff.filter(
    (s) => s.isActive && (!opts.staffId || s.id === opts.staffId) && (!opts.serviceIds || s.allServices || opts.serviceIds.every((id) => s.serviceIds.includes(id))),
  );
  const busy = [
    ...w.bookings
      .filter((b) => b.salonId === salon.id && (b.status === 'pending' || b.status === 'confirmed') && b.id !== opts.excludeBookingId && b.startsAt < dayEnd && b.endsAt > dayStart)
      .map((b) => ({ staffId: b.staffId as string | null, from: new Date(b.startsAt).getTime() - buffer, to: new Date(b.endsAt).getTime() + buffer })),
    ...w.blocks
      .filter((t) => t.salonId === salon.id && t.startsAt < dayEnd && t.endsAt > dayStart)
      .map((t) => ({ staffId: t.staffId, from: new Date(t.startsAt).getTime(), to: new Date(t.endsAt).getTime() })),
  ];
  const grouped = new Map<string, string[]>();
  for (const st of staffSet) {
    const own = w.staffHours.filter((h) => h.staffId === st.id);
    const windows: [number, number][] = [];
    for (const oh of opening) {
      const o = [new Date(localDateTimeToISO(dateKey, oh.opensAt)).getTime(), new Date(localDateTimeToISO(dateKey, oh.closesAt)).getTime()] as const;
      if (!own.length) windows.push([o[0], o[1]]);
      else
        for (const sh of own.filter((h) => h.dayOfWeek === dow)) {
          const a = Math.max(o[0], new Date(localDateTimeToISO(dateKey, sh.startsAt)).getTime());
          const b = Math.min(o[1], new Date(localDateTimeToISO(dateKey, sh.endsAt)).getTime());
          if (a < b) windows.push([a, b]);
        }
    }
    for (const [from, to] of windows) {
      for (let s = from; s + duration * 60_000 <= to; s += step) {
        if (s < minStart) continue;
        const e = s + duration * 60_000;
        if (busy.some((x) => (x.staffId === null || x.staffId === st.id) && x.from < e && x.to > s)) continue;
        const key = new Date(s).toISOString();
        const list = grouped.get(key) ?? [];
        if (!list.includes(st.id)) list.push(st.id);
        grouped.set(key, list);
      }
    }
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([startsAt, staffIds]) => ({ startsAt, staffIds }));
}

/** Première journée avec des créneaux après `after` (dans l'horizon), avec ses premières heures. */
export function nextAvailability(w: World, salon: SalonOwnerView, duration: number, after: string, days: number, opts: SlotOptions = {}, limit = 3): { date: string; slots: string[] } | null {
  for (let i = 1; i <= days; i++) {
    const key = addDaysToKey(after, i);
    const slots = availableSlots(w, salon, key, duration, opts);
    if (slots.length) return { date: key, slots: slots.slice(0, limit).map((s) => hm(s.startsAt)) };
  }
  return null;
}

export const hm = (iso: string) => new Intl.DateTimeFormat('fr-FR', { hourCycle: 'h23', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers' }).format(new Date(iso));

/** Un client est concerné par un rendez-vous s'il en est le compte OU le numéro. */
export const concerns = (b: Booking, ref: { id?: string | null; phone?: string | null }) => (!!ref.id && b.clientId === ref.id) || (!!ref.phone && b.clientPhone === ref.phone);

export function clientStanding(w: World, ref: { id?: string | null; phone?: string | null }, now = Date.now()): ClientStanding {
  if (!ref.id && !ref.phone) return { cancellations: 0, noShows: 0, suspendedUntil: null };
  const cancels = w.bookings
    .filter((b) => concerns(b, ref) && b.status === 'cancelled' && b.cancelledBy === 'client' && b.cancelledAt && new Date(b.cancelledAt).getTime() >= now - CANCEL_ABUSE_WINDOW_DAYS * DAY)
    .sort((a, b) => String(b.cancelledAt).localeCompare(String(a.cancelledAt)));
  const noShows = w.bookings
    .filter((b) => concerns(b, ref) && (b.status === 'no_show' || (b.status === 'cancelled' && b.cancellationKind === 'late')) && new Date(b.startsAt).getTime() >= now - NO_SHOW_ABUSE_WINDOW_DAYS * DAY)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  let until: number | null = null;
  if (cancels.length > CANCEL_ABUSE_MAX && cancels[0]) until = Math.max(until ?? 0, new Date(cancels[0].cancelledAt!).getTime() + CANCEL_ABUSE_BLOCK_DAYS * DAY);
  if (noShows.length >= NO_SHOW_ABUSE_MAX && noShows[0]) until = Math.max(until ?? 0, new Date(noShows[0].startsAt).getTime() + NO_SHOW_ABUSE_BLOCK_DAYS * DAY);
  return { cancellations: cancels.length, noShows: noShows.length, suspendedUntil: until && until > now ? new Date(until).toISOString() : null };
}

export function statsRange(w: World, salonId: string, from: string, to: string): ProStatsRange {
  const rows = w.bookings.filter((b) => b.salonId === salonId && (b.status === 'pending' || b.status === 'confirmed' || b.status === 'completed'));
  const inRange = rows.filter((b) => {
    const d = toLocalDateKey(new Date(b.startsAt));
    return d >= from && d <= to;
  });
  const paid = (b: Booking) => b.status === 'confirmed' || b.status === 'completed';
  const byDay: ProStatsRange['byDay'] = [];
  for (let key = from; key <= to; key = addDaysToKey(key, 1)) {
    const day = inRange.filter((b) => toLocalDateKey(new Date(b.startsAt)) === key);
    byDay.push({ date: key, revenueDa: day.filter(paid).reduce((a, b) => a + b.priceDa, 0), bookings: day.length });
    if (byDay.length > 62) break;
  }
  const svc = new Map<string, { bookings: number; revenueDa: number }>();
  for (const b of inRange.filter(paid)) {
    const cur = svc.get(b.serviceName) ?? { bookings: 0, revenueDa: 0 };
    cur.bookings++;
    cur.revenueDa += b.priceDa;
    svc.set(b.serviceName, cur);
  }
  return {
    from,
    to,
    revenueDa: inRange.filter(paid).reduce((a, b) => a + b.priceDa, 0),
    bookings: inRange.length,
    pending: inRange.filter((b) => b.status === 'pending').length,
    collectedDa: inRange.filter((b) => b.status === 'completed').reduce((a, b) => a + b.priceDa, 0),
    remainingDa: inRange.filter((b) => b.status === 'confirmed').reduce((a, b) => a + b.priceDa, 0),
    remainingCount: inRange.filter((b) => b.status === 'confirmed').length,
    byDay,
    byService: [...svc.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenueDa - a.revenueDa).slice(0, 8),
  };
}

export function dashboardStats(w: World, salonId: string, now = Date.now()): ProDashboardStats {
  const today = toLocalDateKey(new Date(now));
  const [weekStart] = weekKeys(today);
  const monthStart = today.slice(0, 8) + '01';
  const nextMonth = Number(today.slice(5, 7)) === 12 ? `${Number(today.slice(0, 4)) + 1}-01-01` : `${today.slice(0, 5)}${String(Number(today.slice(5, 7)) + 1).padStart(2, '0')}-01`;
  const monthEnd = addDaysToKey(nextMonth, -1);
  const rows = w.bookings.filter((b) => b.salonId === salonId);
  const dayKey = (b: Booking) => toLocalDateKey(new Date(b.startsAt));
  const week = rows.filter((b) => (b.status === 'confirmed' || b.status === 'completed') && dayKey(b) >= weekStart! && dayKey(b) < addDaysToKey(weekStart!, 7));
  const t = statsRange(w, salonId, today, today);
  const m = statsRange(w, salonId, monthStart, monthEnd);
  return {
    todayCount: rows.filter((b) => ['pending', 'confirmed', 'completed'].includes(b.status) && dayKey(b) === today).length,
    pendingCount: rows.filter((b) => b.status === 'pending' && new Date(b.startsAt).getTime() >= now).length,
    weekCount: week.length,
    weekRevenueDa: week.reduce((a, b) => a + b.priceDa, 0),
    todayRevenueDa: t.revenueDa,
    monthCount: m.bookings,
    monthRevenueDa: m.revenueDa,
  };
}

/**
 * Identité d'un client chez un salon — port de la fonction SQL `client_key` (migration 0042). Le
 * NUMÉRO fait foi : il traverse le passage d'un client reçu de passage à un client qui se crée un
 * compte, donc une seule fiche au lieu de deux. Le compte ne sert qu'à lire le numéro À JOUR (un
 * numéro changé regroupe l'historique au lieu de le couper), puis de repli, puis le nom.
 */
export const clientKeyOf = (w: World, b: Booking): string =>
  (b.clientId ? (w.profiles[b.clientId]?.phone ?? null) : null) ??
  b.clientPhone ??
  b.clientId ??
  b.clientName.trim().toLowerCase();

export function proClients(w: World, salonId: string, now = Date.now()): ProClient[] {
  const rows = w.bookings.filter((b) => b.salonId === salonId);
  const groups = new Map<string, Booking[]>();
  for (const b of rows) {
    const k = clientKeyOf(w, b);
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const nowI = new Date(now).toISOString();
  const out: ProClient[] = [];
  for (const [key, list] of groups) {
    const byCreated = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const clientId = list.find((b) => b.clientId)?.clientId ?? null;
    // Numéro affiché : celui du compte s'il existe (il est à jour), sinon le dernier saisi.
    const phone =
      (clientId ? (w.profiles[clientId]?.phone ?? null) : null) ??
      byCreated.find((b) => b.clientPhone)?.clientPhone ??
      null;
    const past = list.filter((b) => b.startsAt <= nowI && b.status !== 'cancelled').map((b) => b.startsAt).sort();
    const next = list.filter((b) => b.startsAt > nowI && (b.status === 'pending' || b.status === 'confirmed')).map((b) => b.startsAt).sort();
    const lastBooking = [...list].sort((a, b) => Number(b.startsAt <= nowI) - Number(a.startsAt <= nowI) || b.startsAt.localeCompare(a.startsAt))[0];
    const block = w.blocked.find((x) => x.salonId === salonId && (x.clientKey === key || (clientId && x.clientId === clientId) || (phone && x.phone === phone)));
    out.push({
      clientKey: key,
      clientId,
      name: byCreated[0]!.clientName,
      phone,
      bookingsCount: list.filter((b) => b.status !== 'cancelled').length,
      completedCount: list.filter((b) => b.status === 'completed').length,
      cancelledCount: list.filter((b) => b.status === 'cancelled' && !b.cancellationKind).length,
      noShowCount: list.filter((b) => b.status === 'no_show' || (b.status === 'cancelled' && b.cancellationKind === 'late')).length,
      spentDa: list.filter((b) => b.status === 'completed').reduce((a, b) => a + b.priceDa, 0),
      lastAt: past.at(-1) ?? null,
      nextAt: next[0] ?? null,
      lastBookingId: lastBooking?.id ?? null,
      blocked: !!block,
      blockedReason: block?.reason ?? null,
      email: clientId ? (w.profiles[clientId]?.email ?? null) : null,
      notes: w.notes[`${salonId}:${key}`] ?? null,
    });
  }
  return out.sort((a, b) => String(b.nextAt ?? b.lastAt ?? '').localeCompare(String(a.nextAt ?? a.lastAt ?? '')) || a.name.localeCompare(b.name));
}

export function isOpenNow(salon: SalonOwnerView, now = Date.now()): boolean {
  const today = toLocalDateKey(new Date(now));
  const dow = dayOfWeekFromKey(today);
  const nowHM = hm(new Date(now).toISOString());
  return salon.openingHours.some((h) => h.dayOfWeek === dow && !h.isClosed && h.opensAt <= nowHM && nowHM < h.closesAt);
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

/** Carte marketplace d'un salon, avec les prochains créneaux réellement libres (matin / après-midi). */
export function summary(w: World, salon: SalonOwnerView, origin?: { lat: number; lng: number }, now = Date.now()): SalonSummary {
  const today = toLocalDateKey(new Date(now));
  const active = salon.services.filter((s) => s.isActive);
  const duration = active.length ? Math.min(...active.map((s) => s.durationMinutes)) : 30;
  let nextAvailable: SalonSummary['nextAvailable'] = null;
  for (let i = 0; i < 7; i++) {
    const key = addDaysToKey(today, i);
    const slots = availableSlots(w, salon, key, duration, { now }).map((s) => hm(s.startsAt));
    if (slots.length) {
      nextAvailable = { date: key, slots: slots.slice(0, 5), morning: slots.filter((s) => s < '12:00').slice(0, 3), afternoon: slots.filter((s) => s >= '12:00').slice(0, 3) };
      break;
    }
  }
  return {
    id: salon.id,
    slug: salon.slug,
    name: salon.name,
    city: salon.city,
    wilayaCode: salon.wilayaCode,
    coverUrl: salon.coverUrl,
    genderTarget: salon.genderTarget,
    ratingAvg: salon.ratingAvg,
    ratingCount: salon.ratingCount,
    categoryIds: salon.categoryIds,
    minPriceDa: active.length ? Math.min(...active.map((s) => s.priceDa)) : null,
    distanceKm: origin && salon.lat != null && salon.lng != null ? Math.round(distanceKm(origin.lat, origin.lng, salon.lat, salon.lng) * 10) / 10 : null,
    zone: salon.zone,
    logoUrl: salon.logoUrl,
    topServices: active.slice(0, 3).map((s) => ({ name: s.name, priceDa: s.priceDa })),
    nextSlots: nextAvailable && nextAvailable.date === today ? nextAvailable.slots : [],
    photoUrls: salon.photos.length ? salon.photos.slice(0, 5).map((p) => p.url) : salon.coverUrl ? [salon.coverUrl] : [],
    nextAvailable,
    isOpenNow: isOpenNow(salon, now),
    lat: salon.lat,
    lng: salon.lng,
  };
}

export const unaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function daysUntilMax(salon: SalonOwnerView): number {
  return Math.min(salon.bookingHorizonDays ?? 30, 60);
}
