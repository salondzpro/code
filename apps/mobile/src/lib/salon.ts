/** Aides partagées des écrans client : statut d'ouverture, itinéraire, calendrier, dates courtes. */
import { Linking, Share } from 'react-native';
import { DAY_LABELS_FR } from '@salondz/constants';
import type { BookingWithSalon, SalonPublic } from '@salondz/types';
import { env } from './env';

/** « Ouvert · ferme à 19:00 » / « Fermé · ouvre demain 09:00 ». */
export function openingStatus(s: Pick<SalonPublic, 'openingHours'>): { open: boolean; label: string } {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Algiers' }));
  const dow = local.getDay();
  const hm = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;
  const today = s.openingHours.filter((h) => h.dayOfWeek === dow && !h.isClosed);
  const current = today.find((h) => h.opensAt <= hm && hm < h.closesAt);
  if (current) return { open: true, label: `Ouvert · ferme à ${current.closesAt}` };
  const later = today.find((h) => h.opensAt > hm);
  if (later) return { open: false, label: `Fermé · ouvre à ${later.opensAt}` };
  for (let i = 1; i <= 7; i++) {
    const d = (dow + i) % 7;
    const h = s.openingHours.find((x) => x.dayOfWeek === d && !x.isClosed);
    if (h) return { open: false, label: `Fermé · ouvre ${i === 1 ? 'demain' : DAY_LABELS_FR[d as 0].toLowerCase()} ${h.opensAt}` };
  }
  return { open: false, label: 'Fermé' };
}

export function directionsUrl(b: BookingWithSalon): string {
  const q = [b.salon.name, b.salon.address, b.salon.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function googleCalendarUrl(b: BookingWithSalon): string {
  const title = `${b.serviceName} · ${b.salon.name}`;
  const location = [b.salon.address, b.salon.city].filter(Boolean).join(', ');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${icsDate(b.startsAt)}/${icsDate(b.endsAt)}&location=${encodeURIComponent(location)}&details=${encodeURIComponent('Réservé via Salon DZ')}`;
}

/** « 2 août » sans le jour de semaine. */
export function dayMonth(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

export const capitalize = (s: string) => s.replace(/^\p{L}/u, (c) => c.toUpperCase());

export const publicUrl = (slug: string) => `${env.webUrl.replace(/\/$/, '')}/s/${slug}`;
export const publicHost = () => env.webUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

export const open = (url: string) => Linking.openURL(url).catch(() => undefined);
export const shareUrl = (title: string, url: string) => Share.share({ title, message: url }).catch(() => undefined);
