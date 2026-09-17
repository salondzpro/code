/**
 * Horaires modifiés et rendez-vous déjà pris.
 *
 * Quand un salon (ou un membre) réduit ses horaires, des rendez-vous à venir peuvent tomber hors des
 * nouvelles plages. Ils ne sont JAMAIS annulés d'office (un client a un engagement, le pro décide) :
 * on les liste pour que l'écran prévienne et renvoie vers l'agenda. Les créneaux proposés aux
 * clients, eux, suivent immédiatement les nouveaux horaires (fonctions SQL).
 */
import { db } from './supabase';
import { unwrap } from './errors';

export interface OutsideBooking {
  id: string;
  clientName: string;
  serviceName: string;
  startsAt: string;
}

/** Plage ouverte un jour donné (`HH:MM`, heure d'Alger), 0 = dimanche. */
export interface HourRange {
  dayOfWeek: number;
  start: string;
  end: string;
}

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Algiers',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function local(iso: string): { dow: number; hm: string } {
  const parts = fmt.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { dow: DOW[get('weekday')] ?? 0, hm: `${get('hour')}:${get('minute')}` };
}

/** `HH:MM:SS` ou `HH:MM` → `HH:MM`. */
export const toHM = (v: string) => v.slice(0, 5);

/**
 * Rendez-vous à venir (en attente ou confirmés) qui ne tiennent dans aucune des plages données pour
 * leur jour. Un rendez-vous qui finit exactement à la fermeture tient ; minuit en fin se lit 24:00.
 */
export async function bookingsOutsideHours(salonId: string, ranges: HourRange[], staffId?: string): Promise<OutsideBooking[]> {
  let q = db
    .from('bookings')
    .select('id, client_name, service_name, starts_at, ends_at')
    .eq('salon_id', salonId)
    .in('status', ['pending', 'confirmed'])
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(200);
  if (staffId) q = q.eq('staff_id', staffId);
  const rows = unwrap(await q) as { id: string; client_name: string; service_name: string; starts_at: string; ends_at: string }[];
  const fits = (b: (typeof rows)[number]) => {
    const s = local(b.starts_at);
    const e = local(b.ends_at);
    const endHM = e.dow !== s.dow || e.hm === '00:00' ? '24:00' : e.hm;
    return ranges.some((r) => r.dayOfWeek === s.dow && toHM(r.start) <= s.hm && endHM <= toHM(r.end));
  };
  return rows.filter((b) => !fits(b)).map((b) => ({ id: b.id, clientName: b.client_name, serviceName: b.service_name, startsAt: b.starts_at }));
}
