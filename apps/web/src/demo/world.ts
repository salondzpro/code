/**
 * Le monde de démonstration, dans le navigateur : deux professionnels (hommes, femmes), deux clients,
 * quelques salons de décor pour la marketplace, et tout ce qui fait vivre l'application (rendez-vous,
 * avis, notifications, favoris, fermetures). Les entités sont stockées DIRECTEMENT dans les formes de
 * l'API (`@salondz/types`) : les gestionnaires de `handlers.ts` les renvoient telles quelles.
 *
 * Le monde est généré à la première ouverture, gardé dans localStorage, et ANIMÉ à chaque appel
 * (`advance`) : journées pleines d'hier à après-demain, absences, demandes à confirmer, annulations,
 * nouveautés « en direct », clôtures et rappels — le même comportement que le serveur, sans serveur.
 */
import {
  DEMO_ACCOUNTS,
  DEMO_SERVICES_MEN,
  DEMO_SERVICES_WOMEN,
  DEMO_VISUAL_KEYS,
  PENDING_REQUEST_TTL_HOURS,
  addDaysToKey,
  dayOfWeekFromKey,
  localDateTimeToISO,
  toLocalDateKey,
  type DemoAccount,
  type DemoAccountKey,
  type DemoService,
} from '@salondz/constants';
import type { Booking, Notification, OpeningHour, Profile, Review, SalonOwnerView, Service, Staff, StaffHour, TimeBlock } from '@salondz/types';
import { DEMO_USER_IDS } from './session';

export const demoImage = (key: string) => `/demo/${key}.webp`;

export interface DemoProfile extends Profile {
  email: string;
}
export interface DemoReview extends Review {
  authorName: string;
}
export interface BlockedClient {
  id: string;
  salonId: string;
  /** Identité bloquée (voir `clientKeyOf`) : permet de bloquer un client de passage sans compte ni numéro. */
  clientKey: string | null;
  clientId: string | null;
  phone: string | null;
  reason: string | null;
}
export interface SlotAlert {
  id: string;
  clientId: string;
  salonId: string;
  serviceId: string | null;
  day: string;
  createdAt: string;
}

export interface World {
  version: number;
  profiles: Record<string, DemoProfile>;
  salons: SalonOwnerView[];
  staffHours: StaffHour[];
  bookings: Booking[];
  reviews: DemoReview[];
  notifications: Notification[];
  favorites: { userId: string; salonId: string; createdAt: string }[];
  blocks: TimeBlock[];
  /** `${salonId}:${clientKey}` → notes privées du salon. */
  notes: Record<string, string>;
  blocked: BlockedClient[];
  slotAlerts: SlotAlert[];
  /** Dernière nouveauté « en direct » par salon. */
  lastEventAt: Record<string, string>;
}

const WORLD_VERSION = 5;
const STORAGE = 'salondz:demo:world';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export const plus = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
export const at = (dayOffset: number, hm: string, today = toLocalDateKey()) => localDateTimeToISO(addDaysToKey(today, dayOffset), hm);
export const dayKeyOf = (iso: string) => toLocalDateKey(new Date(iso));
export const hash = (s: string): number => {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** « 20/09 18:00 » — même forme que `fmt_booking_when` du déclencheur SQL. */
export function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hourCycle: 'h23', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

// ---------------------------------------------------------------------------------------------
// Spécifications des deux salons de démonstration (mêmes données que côté serveur)
// ---------------------------------------------------------------------------------------------
interface SalonSpec {
  id: string;
  owner: DemoAccountKey;
  slug: string;
  name: string;
  description: string;
  city: string;
  zone: string;
  address: string;
  lat: number;
  lng: number;
  gender: 'men' | 'women';
  categories: string[];
  services: readonly DemoService[];
  cover: string;
  logo: string;
  staff2: { name: string; avatar: string };
  hours: (readonly [string, string] | null)[];
  autoConfirm: boolean;
  cancelMinHours: number;
  showcase: string[];
}

export const SALON_SPECS: SalonSpec[] = [
  {
    id: '0d0e0000-0000-4000-8000-00000000a001',
    owner: 'hommes',
    slug: 'karim-barber-club',
    name: 'Karim Barber Club',
    description:
      'Barbier de quartier à Alger-Centre : coupes, dégradés, barbe au rasoir et serviette chaude, lissages. Deux fauteuils, sans attente grâce à la réservation en ligne. Paiement sur place.',
    city: 'Alger-Centre',
    zone: 'Alger-Centre',
    address: '12 rue Larbi Ben M’hidi',
    lat: 36.7745,
    lng: 3.059,
    gender: 'men',
    categories: ['coiffure', 'barbe', 'lissage', 'soins-peau'],
    services: DEMO_SERVICES_MEN,
    cover: DEMO_VISUAL_KEYS.coverMen,
    logo: DEMO_VISUAL_KEYS.logoMen,
    staff2: { name: 'Sofiane', avatar: DEMO_VISUAL_KEYS.staffMen2 },
    hours: [['09:00', '20:00'], ['09:00', '20:00'], ['09:00', '20:00'], ['09:00', '20:00'], ['09:00', '20:00'], ['14:00', '20:00'], ['09:00', '20:00']],
    autoConfirm: true,
    cancelMinHours: 2,
    showcase: ['h-coupe-barbe', 'h-lissage-keratine', 'h-barbe', 'h-coupe-mariage'],
  },
  {
    id: '0d0e0000-0000-4000-8000-00000000a002',
    owner: 'femmes',
    slug: 'yasmine-beauty-studio',
    name: 'Yasmine Beauty Studio',
    description:
      'Institut à Hydra, sur rendez-vous uniquement : coiffure et lissages, onglerie, extensions de cils, sourcils et soins du visage. Produits sans ammoniaque, espace réservé aux femmes.',
    city: 'Hydra',
    zone: 'Hydra',
    address: '8 rue Ahmed Kara',
    lat: 36.746,
    lng: 3.03,
    gender: 'women',
    categories: ['coiffure-lissage', 'ongles', 'cils', 'sourcils', 'soins'],
    services: DEMO_SERVICES_WOMEN,
    cover: DEMO_VISUAL_KEYS.coverWomen,
    logo: DEMO_VISUAL_KEYS.logoWomen,
    staff2: { name: 'Lina', avatar: DEMO_VISUAL_KEYS.staffWomen2 },
    hours: [['09:00', '18:00'], ['09:00', '18:00'], ['09:00', '18:00'], ['09:00', '18:00'], ['09:00', '18:00'], null, ['09:00', '18:00']],
    autoConfirm: false,
    cancelMinHours: 24,
    showcase: ['f-pose-gel', 'f-extension-cils', 'f-balayage', 'f-chignon-mariee'],
  },
];

const AVATARS: Record<DemoAccountKey, string> = {
  hommes: DEMO_VISUAL_KEYS.avatarHommes,
  femmes: DEMO_VISUAL_KEYS.avatarFemmes,
  clienthomme: DEMO_VISUAL_KEYS.avatarClientHomme,
  clientfemme: DEMO_VISUAL_KEYS.avatarClientFemme,
};

/** Salons de décor : la marketplace n'est pas vide (aucun compte derrière, réservables quand même). */
interface DecorSpec {
  slug: string;
  name: string;
  city: string;
  zone: string;
  gender: 'men' | 'women';
  lat: number;
  lng: number;
  rating: [number, number];
  cover: string;
  categories: string[];
  services: { name: string; minutes: number; priceDa: number; categoryId: string; key?: string }[];
  autoConfirm?: boolean;
}
const DECOR: DecorSpec[] = [
  { slug: 'le-fauteuil-bab-el-oued', name: 'Le Fauteuil', city: 'Bab El Oued', zone: 'Bab El Oued', gender: 'men', lat: 36.79, lng: 3.05, rating: [4.7, 38], cover: 'h-coupe', categories: ['coiffure', 'barbe'], services: [{ name: 'Coupe homme', minutes: 15, priceDa: 400, categoryId: 'coiffure', key: 'h-coupe' }, { name: 'Coupe + barbe', minutes: 25, priceDa: 700, categoryId: 'coiffure', key: 'h-coupe-barbe' }, { name: 'Barbe', minutes: 10, priceDa: 250, categoryId: 'barbe', key: 'h-barbe' }, { name: 'Coupe enfant', minutes: 15, priceDa: 300, categoryId: 'coiffure', key: 'h-coupe' }] },
  { slug: 'dz-barber-kouba', name: 'DZ Barber Kouba', city: 'Kouba', zone: 'Kouba', gender: 'men', lat: 36.72, lng: 3.08, rating: [4.4, 21], cover: 'h-barbe', categories: ['coiffure', 'barbe', 'lissage'], services: [{ name: 'Dégradé', minutes: 20, priceDa: 500, categoryId: 'coiffure', key: 'h-coupe' }, { name: 'Rasage traditionnel', minutes: 15, priceDa: 300, categoryId: 'barbe', key: 'h-barbe' }, { name: 'Lissage kératine', minutes: 60, priceDa: 4500, categoryId: 'lissage', key: 'h-lissage-keratine' }] },
  { slug: 'gentlemen-hydra', name: 'Gentlemen Hydra', city: 'Hydra', zone: 'Hydra', gender: 'men', lat: 36.748, lng: 3.035, rating: [4.9, 64], cover: 'h-coupe-mariage', categories: ['coiffure', 'barbe', 'soins-peau'], services: [{ name: 'Coupe signature', minutes: 30, priceDa: 1200, categoryId: 'coiffure', key: 'h-coupe' }, { name: 'Barbe + serviette chaude', minutes: 20, priceDa: 600, categoryId: 'barbe', key: 'h-barbe' }, { name: 'Nettoyage de peau', minutes: 30, priceDa: 1800, categoryId: 'soins-peau', key: 'h-nettoyage-peau' }], autoConfirm: false },
  { slug: 'salon-amira-bir-mourad-rais', name: 'Salon Amira', city: 'Bir Mourad Raïs', zone: 'Bir Mourad Raïs', gender: 'women', lat: 36.74, lng: 3.05, rating: [4.6, 47], cover: 'f-brushing', categories: ['coiffure-lissage', 'ongles'], services: [{ name: 'Brushing', minutes: 30, priceDa: 700, categoryId: 'coiffure-lissage', key: 'f-brushing' }, { name: 'Coupe femme', minutes: 30, priceDa: 1000, categoryId: 'coiffure-lissage', key: 'f-coupe' }, { name: 'Pose gel', minutes: 60, priceDa: 2200, categoryId: 'ongles', key: 'f-pose-gel' }, { name: 'Coloration', minutes: 60, priceDa: 3000, categoryId: 'coiffure-lissage', key: 'f-coloration' }] },
  { slug: 'nails-and-lashes-cheraga', name: 'Nails & Lashes', city: 'Chéraga', zone: 'Chéraga', gender: 'women', lat: 36.767, lng: 2.958, rating: [4.8, 112], cover: 'f-extension-cils', categories: ['ongles', 'cils', 'sourcils'], services: [{ name: 'Extension de cils', minutes: 90, priceDa: 4000, categoryId: 'cils', key: 'f-extension-cils' }, { name: 'Vernis semi-permanent', minutes: 40, priceDa: 1300, categoryId: 'ongles', key: 'f-semi-permanent' }, { name: 'Restructuration des sourcils', minutes: 20, priceDa: 500, categoryId: 'sourcils', key: 'f-sourcils' }, { name: 'Nail art', minutes: 30, priceDa: 900, categoryId: 'ongles', key: 'f-nail-art' }] },
  { slug: 'institut-lotus-el-biar', name: 'Institut Lotus', city: 'El Biar', zone: 'El Biar', gender: 'women', lat: 36.767, lng: 3.03, rating: [4.3, 19], cover: 'f-nettoyage-peau', categories: ['soins', 'coiffure-lissage'], services: [{ name: 'Nettoyage de peau', minutes: 45, priceDa: 1800, categoryId: 'soins', key: 'f-nettoyage-peau' }, { name: 'Soin hydratant', minutes: 30, priceDa: 1500, categoryId: 'soins', key: 'f-soin-hydratant' }, { name: 'Lissage brésilien', minutes: 120, priceDa: 7000, categoryId: 'coiffure-lissage', key: 'f-lissage-bresilien' }], autoConfirm: false },
];

const POOL_MEN: [string, string | null][] = [
  ['Mohamed R.', '+213550100110'], ['Sid Ali', null], ['Rayan B.', '+213550100111'], ['Walid', null], ['Anis K.', '+213550100112'], ['Hamza', null],
  ['Bilal M.', '+213550100113'], ['Yanis', null], ['Riad T.', '+213550100114'], ['Nassim', null], ['Amine D.', '+213550100115'], ['Islam', null],
];
const POOL_WOMEN: [string, string | null][] = [
  ['Nadia B.', '+213550100120'], ['Sarah M.', null], ['Meriem', '+213550100121'], ['Rania K.', null], ['Houda', '+213550100122'], ['Imène', null],
  ['Lydia', '+213550100123'], ['Feriel B.', null], ['Kenza', '+213550100124'], ['Asma T.', null], ['Sonia', '+213550100125'], ['Manel', null],
];
const DAY_TARGET: Record<number, number> = { [-1]: 4, 0: 4, 1: 3, 2: 3 };
/** Une nouveauté « en direct » au plus toutes les 20 minutes : la démonstration bouge sous les yeux. */
const LIVE_EVENT_MINUTES = 20;
const PURGE_AFTER_DAYS = 45;

// ---------------------------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------------------------
const nowIso = () => new Date().toISOString();

function profileFor(acct: DemoAccount, createdAt: string): DemoProfile {
  return {
    id: DEMO_USER_IDS[acct.key],
    email: acct.email,
    role: acct.role,
    fullName: acct.fullName,
    phone: acct.phone,
    avatarUrl: demoImage(AVATARS[acct.key]),
    gender: acct.gender,
    locale: 'fr',
    market: acct.market,
    remindersEnabled: true,
    notifyConfirmations: true,
    createdAt,
  };
}

function hoursFor(salonId: string, hours: SalonSpec['hours']): OpeningHour[] {
  return hours.map((h, d) => ({ id: uid(), salonId, dayOfWeek: d as OpeningHour['dayOfWeek'], opensAt: h ? h[0] : '09:00', closesAt: h ? h[1] : '18:00', isClosed: !h }));
}

function baseSalon(id: string, ownerId: string, s: { slug: string; name: string; description: string | null; city: string; zone: string; address: string | null; lat: number; lng: number; gender: 'men' | 'women'; categories: string[]; coverUrl: string | null; logoUrl: string | null; autoConfirm: boolean; cancelMinHours: number; phone: string | null; rating: [number, number] }, createdAt: string): Omit<SalonOwnerView, 'photos' | 'works' | 'services' | 'staff' | 'openingHours'> {
  return {
    id,
    ownerId,
    slug: s.slug,
    name: s.name,
    description: s.description,
    phone: s.phone,
    wilayaCode: 16,
    city: s.city,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    coverUrl: s.coverUrl,
    logoUrl: s.logoUrl,
    zone: s.zone,
    genderTarget: s.gender,
    isPublished: true,
    slotIntervalMinutes: 15,
    bookingLeadTimeMinutes: 30,
    bookingHorizonDays: 30,
    autoConfirm: s.autoConfirm,
    cancelMinHours: s.cancelMinHours,
    bufferMinutes: 0,
    homeService: false,
    allowClientReschedule: true,
    depositRequired: false,
    ratingAvg: s.rating[0],
    ratingCount: s.rating[1],
    categoryIds: [...s.categories].sort(),
    createdAt,
    updatedAt: createdAt,
  };
}

function buildDemoSalon(spec: SalonSpec, createdAt: string): SalonOwnerView {
  const ownerId = DEMO_USER_IDS[spec.owner];
  const owner = DEMO_ACCOUNTS.find((a) => a.key === spec.owner)!;
  const services: Service[] = spec.services.map((s, i) => ({
    id: uid(),
    salonId: spec.id,
    name: s.name,
    description: s.description ?? null,
    durationMinutes: s.minutes,
    priceDa: s.priceDa,
    categoryId: s.categoryId,
    groupName: null,
    isActive: true,
    sortOrder: i,
    photos: [{ id: uid(), url: demoImage(s.key), sortOrder: 0 }],
  }));
  const staff: Staff[] = [
    { id: uid(), salonId: spec.id, userId: ownerId, displayName: owner.fullName.split(' ')[0]!, phone: owner.phone, avatarUrl: demoImage(AVATARS[spec.owner]), isActive: true, sortOrder: 0, allServices: true, serviceIds: [] },
    { id: uid(), salonId: spec.id, userId: null, displayName: spec.staff2.name, phone: null, avatarUrl: demoImage(spec.staff2.avatar), isActive: true, sortOrder: 1, allServices: true, serviceIds: [] },
  ];
  return {
    ...baseSalon(spec.id, ownerId, { ...spec, coverUrl: demoImage(spec.cover), logoUrl: demoImage(spec.logo), phone: owner.phone, rating: [0, 0] }, createdAt),
    photos: [
      { id: uid(), salonId: spec.id, url: demoImage(spec.cover), sortOrder: 0, kind: 'cover' },
      ...spec.showcase.slice(0, 2).map((k, i) => ({ id: uid(), salonId: spec.id, url: demoImage(k), sortOrder: i + 1, kind: 'cover' as const })),
    ],
    works: spec.showcase.map((k, i) => ({ id: uid(), salonId: spec.id, url: demoImage(k), sortOrder: i, kind: 'work' as const })),
    services,
    staff,
    openingHours: hoursFor(spec.id, spec.hours),
  };
}

function buildDecorSalon(d: DecorSpec, createdAt: string): SalonOwnerView {
  const id = uid();
  const ownerId = uid();
  const services: Service[] = d.services.map((s, i) => ({
    id: uid(),
    salonId: id,
    name: s.name,
    description: null,
    durationMinutes: s.minutes,
    priceDa: s.priceDa,
    categoryId: s.categoryId,
    groupName: null,
    isActive: true,
    sortOrder: i,
    photos: s.key ? [{ id: uid(), url: demoImage(s.key), sortOrder: 0 }] : [],
  }));
  const hours: SalonSpec['hours'] = d.gender === 'men'
    ? [['09:00', '19:00'], ['09:00', '19:00'], ['09:00', '19:00'], ['09:00', '19:00'], ['09:00', '19:00'], ['14:00', '19:00'], ['09:00', '19:00']]
    : [['09:00', '18:00'], ['09:00', '18:00'], ['09:00', '18:00'], ['09:00', '18:00'], ['09:00', '18:00'], null, ['09:00', '18:00']];
  return {
    ...baseSalon(id, ownerId, { ...d, description: null, address: null, coverUrl: demoImage(d.cover), logoUrl: null, autoConfirm: d.autoConfirm ?? true, cancelMinHours: 2, phone: null }, createdAt),
    photos: [{ id: uid(), salonId: id, url: demoImage(d.cover), sortOrder: 0, kind: 'cover' }],
    works: [],
    services,
    staff: [{ id: uid(), salonId: id, userId: null, displayName: d.name.split(' ')[0]!, phone: null, avatarUrl: null, isActive: true, sortOrder: 0, allServices: true, serviceIds: [] }],
    openingHours: hoursFor(id, hours),
  };
}

export function bookingRow(
  salon: SalonOwnerView,
  svc: Service,
  staffId: string,
  startsAt: string,
  status: Booking['status'],
  client: { id: string | null; name: string; phone: string | null },
  extra: Partial<Booking> = {},
): Booking {
  const createdAt = extra.createdAt ?? nowIso();
  return {
    id: uid(),
    salonId: salon.id,
    clientId: client.id,
    staffId,
    serviceId: svc.id,
    serviceName: svc.name,
    durationMinutes: svc.durationMinutes,
    priceDa: svc.priceDa,
    startsAt,
    endsAt: plus(startsAt, svc.durationMinutes),
    status,
    source: 'walk_in',
    clientName: client.name,
    clientPhone: client.phone,
    notes: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    cancellationKind: null,
    clientReschedules: 0,
    bookedBy: null,
    bookedByName: null,
    createdAt,
    updatedAt: createdAt,
    ...extra,
  };
}

/** Historique d'un client de démonstration dans « son » salon : terminés (avec avis), un annulé, favori, note. */
function seedClientHistory(w: World, acct: DemoAccount, salon: SalonOwnerView) {
  const userId = DEMO_USER_IDS[acct.key];
  const men = acct.key === 'clienthomme';
  const svc = (name: string) => salon.services.find((s) => s.name === name) ?? salon.services[0]!;
  const staff = salon.staff[0]!.id;
  const staff2 = (salon.staff[1] ?? salon.staff[0])!.id;
  const client = { id: userId, name: acct.fullName, phone: acct.phone };
  const past: [number, string, string, string][] = men
    ? [[-52, '18:00', 'Coupe + barbe', staff], [-24, '17:30', 'Coupe + barbe + shampoing', staff], [-6, '18:30', 'Coupe + barbe', staff2]]
    : [[-40, '10:00', 'Coupe femme', staff], [-19, '14:00', 'Pose gel', staff2], [-5, '11:00', 'Brushing', staff]];
  const done: Booking[] = past.map(([d, hm, name, st]) => bookingRow(salon, svc(name), st, at(d, hm), 'completed', client, { source: 'online', createdAt: at(d - 2, '20:15') }));
  w.bookings.push(...done);
  w.bookings.push(
    bookingRow(salon, svc(men ? 'Coupe seule' : 'Manucure classique'), staff, at(-33, men ? '12:00' : '15:00'), 'cancelled', client, {
      source: 'online',
      cancelledAt: at(-34, '09:10'),
      cancelledBy: 'client',
      cancellationReason: 'Empêchement',
      createdAt: at(-36, '21:00'),
    }),
  );
  const comments = men
    ? ['Toujours propre et rapide, Karim connaît ma coupe par cœur.', 'Barbe impeccable, serviette chaude au top. Je recommande.']
    : ['Pose gel très soignée, Lina prend son temps. Tenue parfaite trois semaines.', 'Brushing rapide et brillant, salon calme et propre.'];
  const toReview = done.slice(-2);
  toReview.forEach((b, i) => {
    w.reviews.push({ id: uid(), salonId: salon.id, bookingId: b.id, clientId: userId, rating: i === toReview.length - 1 ? 5 : 4, comment: comments[i]!, createdAt: plus(b.startsAt, 26 * 60), authorName: firstNameOnly(acct.fullName) });
  });
  w.favorites.push({ userId, salonId: salon.id, createdAt: at(-52, '20:00') });
  const last = done.at(-1)!;
  w.notifications.push({
    id: uid(),
    userId,
    type: 'booking_completed',
    title: 'Merci pour votre visite',
    body: `Donnez votre avis sur ${salon.name}`,
    data: { bookingId: last.id, salonId: salon.id, status: 'completed' },
    bookingId: last.id,
    createdAt: plus(last.startsAt, 4 * 60),
    readAt: plus(last.startsAt, 26 * 60),
  });
  w.notes[`${salon.id}:${userId}`] = men ? 'Dégradé bas, barbe courte. Préfère Karim, vient le jeudi soir.' : 'Cheveux fins : brushing doux. Allergique au gel avec HEMA.';
  refreshRating(w, salon.id);
}

/** Avis de décor pour les salons de la marketplace (noms fictifs, aucun compte). */
function seedDecorReviews(w: World, salon: SalonOwnerView, gender: 'men' | 'women') {
  const pool = gender === 'men' ? POOL_MEN : POOL_WOMEN;
  const texts = gender === 'men'
    ? ['Rapide et propre.', 'Bon dégradé, je reviendrai.', 'Un peu d’attente mais très bon travail.', 'Le meilleur du quartier.']
    : ['Accueil chaleureux, résultat parfait.', 'Très douce, produits de qualité.', 'Salon propre, je recommande.', 'Un peu cher mais impeccable.'];
  const n = Math.min(4, Math.max(2, Math.round(salon.ratingCount / 12)));
  for (let i = 0; i < n; i++) {
    const seed = hash(`${salon.slug}:review:${i}`);
    const svc = salon.services[seed % salon.services.length]!;
    const start = at(-(5 + (seed % 40)), '15:00');
    const b = bookingRow(salon, svc, salon.staff[0]!.id, start, 'completed', { id: null, name: pool[seed % pool.length]![0], phone: null }, { source: 'online', createdAt: plus(start, -3 * 24 * 60) });
    w.bookings.push(b);
    w.reviews.push({ id: uid(), salonId: salon.id, bookingId: b.id, clientId: uid(), rating: (4 + (seed % 2)) as 4 | 5, comment: texts[i % texts.length]!, createdAt: plus(start, 20 * 60), authorName: pool[seed % pool.length]![0] });
  }
}

export function refreshRating(w: World, salonId: string) {
  const s = w.salons.find((x) => x.id === salonId);
  if (!s) return;
  const rs = w.reviews.filter((r) => r.salonId === salonId);
  // Les salons de décor gardent leur note « historique » (leurs avis affichés ne sont qu'un extrait).
  const decor = !SALON_SPECS.some((x) => x.id === salonId);
  if (decor) return;
  s.ratingCount = rs.length;
  s.ratingAvg = rs.length ? Math.round((rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 100) / 100 : 0;
}

export function firstNameOnly(name: string | null | undefined): string {
  if (!name) return 'Client';
  const [first, ...rest] = name.trim().split(/\s+/);
  const initial = rest[0]?.[0];
  return initial ? `${first} ${initial}.` : (first ?? 'Client');
}

export function buildWorld(): World {
  const createdAt = at(-90, '10:00');
  const w: World = {
    version: WORLD_VERSION,
    profiles: {},
    salons: [],
    staffHours: [],
    bookings: [],
    reviews: [],
    notifications: [],
    favorites: [],
    blocks: [],
    notes: {},
    blocked: [],
    slotAlerts: [],
    lastEventAt: {},
  };
  for (const acct of DEMO_ACCOUNTS) w.profiles[DEMO_USER_IDS[acct.key]] = profileFor(acct, createdAt);
  for (const spec of SALON_SPECS) w.salons.push(buildDemoSalon(spec, createdAt));
  for (const d of DECOR) {
    const s = buildDecorSalon(d, createdAt);
    w.salons.push(s);
    seedDecorReviews(w, s, d.gender);
  }
  const men = w.salons.find((s) => s.slug === 'karim-barber-club')!;
  const women = w.salons.find((s) => s.slug === 'yasmine-beauty-studio')!;
  seedClientHistory(w, DEMO_ACCOUNTS.find((a) => a.key === 'clienthomme')!, men);
  seedClientHistory(w, DEMO_ACCOUNTS.find((a) => a.key === 'clientfemme')!, women);
  advance(w, Date.now());
  return w;
}

// ---------------------------------------------------------------------------------------------
// Persistance
// ---------------------------------------------------------------------------------------------
let cache: World | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function getWorld(): World {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as World;
      if (parsed.version === WORLD_VERSION) {
        cache = parsed;
        return cache;
      }
    }
  } catch {
    /* monde illisible : on repart */
  }
  cache = buildWorld();
  saveWorld();
  return cache;
}

export function saveWorld(): void {
  if (!cache) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(cache));
    } catch {
      /* quota : la démonstration continue en mémoire */
    }
  }, 150);
}

export function resetWorld(): void {
  cache = null;
  try {
    localStorage.removeItem(STORAGE);
  } catch {
    /* rien */
  }
}

// ---------------------------------------------------------------------------------------------
// Déclencheur des notifications (port de `bookings_notify`)
// ---------------------------------------------------------------------------------------------
export function notify(w: World, userId: string, type: Notification['type'], title: string, body: string, b: Booking, extra: Partial<Notification> = {}) {
  w.notifications.push({
    id: uid(),
    userId,
    type,
    title,
    body,
    data: { bookingId: b.id, salonId: b.salonId, status: b.status },
    bookingId: b.id,
    readAt: null,
    createdAt: nowIso(),
    ...extra,
  });
}

/** À appeler après chaque insertion (`before = null`) ou changement de statut / d'horaire d'un rendez-vous. */
export function onBookingChange(w: World, before: Booking | null, b: Booking) {
  const salon = w.salons.find((s) => s.id === b.salonId);
  if (!salon) return;
  const owner = salon.ownerId;
  const when = fmtWhen(b.startsAt);
  const ownerIsDemo = !!w.profiles[owner];
  if (!before) {
    if (b.source === 'online') {
      if (ownerIsDemo) notify(w, owner, 'booking_created', 'Nouvelle réservation', `${b.clientName} · ${b.serviceName} · ${when}`, b);
      if (b.clientId && w.profiles[b.clientId])
        notify(w, b.clientId, b.status === 'confirmed' ? 'booking_confirmed' : 'booking_created', b.status === 'confirmed' ? 'Réservation confirmée' : 'Demande envoyée', `${salon.name} · ${b.serviceName} · ${when}`, b);
    }
    return;
  }
  if (b.status !== before.status) {
    const toClient = (type: Notification['type'], title: string, body: string) => {
      if (b.clientId && w.profiles[b.clientId]) notify(w, b.clientId, type, title, body, b);
    };
    const toOwner = (type: Notification['type'], title: string, body: string) => {
      if (ownerIsDemo) notify(w, owner, type, title, body, b);
    };
    if (b.status === 'confirmed') toClient('booking_confirmed', 'Réservation confirmée', `${salon.name} · ${b.serviceName} · ${when}`);
    else if (b.status === 'cancelled') {
      if (b.cancelledBy === 'client') toOwner('booking_cancelled', 'Réservation annulée', `${b.clientName} a annulé · ${b.serviceName} · ${when}`);
      else if (b.cancelledBy === 'system') {
        toClient('booking_cancelled', 'Demande expirée', `${salon.name} n'a pas confirmé à temps · ${b.serviceName} · ${when}`);
        toOwner('booking_cancelled', 'Demande expirée', `${b.clientName} · ${b.serviceName} · ${when} — demande non confirmée à temps`);
      } else toClient('booking_cancelled', 'Réservation annulée', `${salon.name} a annulé · ${b.serviceName} · ${when}${b.cancellationReason ? ` — ${b.cancellationReason}` : ''}`);
    } else if (b.status === 'no_show') toClient('booking_no_show', 'Absence signalée', `${salon.name} a signalé une absence · ${b.serviceName} · ${when}`);
    else if (b.status === 'completed') toClient('booking_completed', 'Merci pour votre visite', `Donnez votre avis sur ${salon.name}`);
  } else if (b.startsAt !== before.startsAt && (b.status === 'pending' || b.status === 'confirmed')) {
    if (b.clientId && w.profiles[b.clientId]) notify(w, b.clientId, 'booking_rescheduled', 'Réservation déplacée', `${salon.name} · ${b.serviceName} · ${when}`, b);
  }
}

// ---------------------------------------------------------------------------------------------
// Animation (port de l'animateur serveur + du cron)
// ---------------------------------------------------------------------------------------------
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const toHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function openRange(salon: SalonOwnerView, dateKey: string): [string, string] | null {
  const dow = dayOfWeekFromKey(dateKey);
  const rows = salon.openingHours.filter((h) => h.dayOfWeek === dow && !h.isClosed);
  if (!rows.length) return null;
  return [rows.map((h) => h.opensAt).sort()[0]!, rows.map((h) => h.closesAt).sort().at(-1)!];
}

/** Un début de créneau libre pour ce membre ce jour-là, dans les horaires, sans chevauchement (visuel : terminés inclus). */
export function freeSlot(w: World, salon: SalonOwnerView, dateKey: string, staffId: string, minutes: number, seed: number, extra: Booking[] = []): string | null {
  const range = openRange(salon, dateKey);
  if (!range) return null;
  const candidates: string[] = [];
  for (let m = toMin(range[0]); m + minutes <= toMin(range[1]); m += 30) candidates.push(toHM(m));
  if (!candidates.length) return null;
  const dayStart = localDateTimeToISO(dateKey, '00:00');
  const dayEnd = localDateTimeToISO(addDaysToKey(dateKey, 1), '00:00');
  const taken = [...w.bookings, ...extra].filter((b) => b.salonId === salon.id && b.staffId === staffId && b.status !== 'cancelled' && b.status !== 'no_show' && b.startsAt < dayEnd && b.endsAt > dayStart);
  const first = seed % candidates.length;
  for (let i = 0; i < candidates.length; i++) {
    const start = localDateTimeToISO(dateKey, candidates[(first + i) % candidates.length]!);
    const end = plus(start, minutes);
    if (!taken.some((b) => b.startsAt < end && b.endsAt > start)) return start;
  }
  return null;
}

function animateSalon(w: World, salon: SalonOwnerView, now: number): number {
  const spec = SALON_SPECS.find((s) => s.id === salon.id);
  if (!spec || !salon.staff.length || !salon.services.length) return 0;
  const today = toLocalDateKey(new Date(now));
  const nowI = new Date(now).toISOString();
  const pool = spec.gender === 'men' ? POOL_MEN : POOL_WOMEN;
  const hourSeed = hash(`${salon.id}:${Math.floor(now / 3_600_000)}`);
  const active = salon.staff.filter((s) => s.isActive);
  const services = salon.services.filter((s) => s.isActive);
  const pick = (seed: number) => ({ staff: active[seed % active.length]!, svc: services[(seed >>> 3) % services.length]!, who: pool[(seed >>> 9) % pool.length]! });
  const mine = (b: Booking) => b.salonId === salon.id;
  let changes = 0;
  let events = 0;
  const lastEvent = w.lastEventAt[salon.id] ? new Date(w.lastEventAt[salon.id]!).getTime() : 0;
  const wantsEvent = now - lastEvent > LIVE_EVENT_MINUTES * 60_000;

  // 1) Hier → après-demain : journées pleines.
  for (const off of [-1, 0, 1, 2]) {
    const key = addDaysToKey(today, off);
    if (!openRange(salon, key)) continue;
    const dayStart = localDateTimeToISO(key, '00:00');
    const dayEnd = localDateTimeToISO(addDaysToKey(key, 1), '00:00');
    const dayRows = w.bookings.filter((b) => mine(b) && b.startsAt >= dayStart && b.startsAt < dayEnd);
    const count = dayRows.filter((b) => b.status !== 'cancelled').length;
    for (let i = count; i < (DAY_TARGET[off] ?? 0); i++) {
      const seed = hash(`${salon.id}:${key}:${i}`);
      const { staff, svc, who } = pick(seed);
      const start = freeSlot(w, salon, key, staff.id, svc.durationMinutes, seed >>> 6);
      if (!start) break;
      const status = new Date(plus(start, svc.durationMinutes)).getTime() < now - 3 * 3_600_000 ? 'completed' : 'confirmed';
      w.bookings.push(bookingRow(salon, svc, staff.id, start, status, { id: null, name: who[0], phone: who[1] }, { source: seed % 3 === 0 ? 'phone' : 'walk_in', createdAt: plus(start, -(60 + (seed % 5) * 24 * 60)) }));
      changes++;
    }
    if (off === -1 && !dayRows.some((b) => b.status === 'no_show')) {
      const done = dayRows.find((b) => b.status === 'completed' && !b.clientId);
      if (done) {
        done.status = 'no_show';
        changes++;
      }
    }
  }

  // 2) Une demande à confirmer.
  if (!w.bookings.some((b) => mine(b) && b.status === 'pending' && b.startsAt > nowI)) {
    const key = addDaysToKey(today, 1 + (hourSeed % 2));
    const seed = hash(`${salon.id}:pending:${key}`);
    const { staff, svc, who } = pick(seed);
    const start = freeSlot(w, salon, key, staff.id, svc.durationMinutes, seed >>> 6);
    if (start) {
      const b = bookingRow(salon, svc, staff.id, start, 'pending', { id: null, name: who[0], phone: who[1] }, { source: 'online', createdAt: nowI });
      w.bookings.push(b);
      onBookingChange(w, null, b);
      changes++;
      events++;
    }
  }

  // 3) Une annulation récente.
  const recentCancel = w.bookings.some((b) => mine(b) && b.status === 'cancelled' && b.cancelledAt && new Date(b.cancelledAt).getTime() > now - 2 * 86_400_000);
  if (!recentCancel && events === 0) {
    const victim = w.bookings.find((b) => mine(b) && b.status === 'confirmed' && !b.clientId && b.startsAt > new Date(now + 2 * 3_600_000).toISOString() && b.startsAt < at(3, '00:00', today));
    if (victim) {
      const before = { ...victim };
      victim.status = 'cancelled';
      victim.cancelledAt = nowI;
      victim.cancelledBy = 'client';
      victim.cancellationReason = 'Empêchement';
      victim.updatedAt = nowI;
      onBookingChange(w, before, victim);
      changes++;
      events++;
    }
  }

  // 4) Nouveauté en direct : une réservation en ligne qui arrive.
  if (wantsEvent && events === 0) {
    const key = addDaysToKey(today, 1 + (hourSeed % 3));
    const seed = hash(`${salon.id}:live:${key}:${hourSeed}`);
    const { staff, svc, who } = pick(seed);
    const start = freeSlot(w, salon, key, staff.id, svc.durationMinutes, seed >>> 6);
    if (start) {
      const b = bookingRow(salon, svc, staff.id, start, salon.autoConfirm ? 'confirmed' : 'pending', { id: null, name: who[0], phone: who[1] }, { source: 'online', createdAt: nowI });
      w.bookings.push(b);
      onBookingChange(w, null, b);
      changes++;
      events++;
    }
  }
  if (events) w.lastEventAt[salon.id] = nowI;

  // 5) Purge.
  const limit = new Date(now - PURGE_AFTER_DAYS * 86_400_000).toISOString();
  const before = w.bookings.length;
  w.bookings = w.bookings.filter((b) => !(mine(b) && !b.clientId && b.startsAt < limit && !w.reviews.some((r) => r.bookingId === b.id)));
  changes += before - w.bookings.length;
  return changes;
}

/** Un client de démonstration garde deux rendez-vous confirmés à venir et une demande en attente. */
function topUpClient(w: World, salon: SalonOwnerView, acct: DemoAccount, now: number): number {
  const userId = DEMO_USER_IDS[acct.key];
  const today = toLocalDateKey(new Date(now));
  const nowI = new Date(now).toISOString();
  const mine = w.bookings.filter((b) => b.clientId === userId && b.salonId === salon.id && (b.status === 'pending' || b.status === 'confirmed') && b.startsAt > nowI);
  const busy = new Set(mine.map((b) => dayKeyOf(b.startsAt)));
  const men = acct.key === 'clienthomme';
  const favourites = men ? ['Coupe + barbe', 'Coupe seule', 'Barbe', 'Coupe + barbe + shampoing'] : ['Brushing', 'Pose gel', 'Manucure classique', 'Vernis semi-permanent', 'Nettoyage de peau'];
  const active = salon.staff.filter((s) => s.isActive);
  const services = salon.services.filter((s) => s.isActive);
  const svcFor = (seed: number) => services.find((s) => s.name === favourites[seed % favourites.length]) ?? services[0]!;
  let changes = 0;
  const place = (status: 'confirmed' | 'pending', fromDay: number, seedKey: string) => {
    for (let off = fromDay; off < fromDay + 10; off++) {
      const key = addDaysToKey(today, off);
      if (busy.has(key) || !openRange(salon, key)) continue;
      const seed = hash(`${salon.id}:${userId}:${seedKey}:${key}`);
      const staff = active[seed % active.length]!;
      const svc = svcFor(seed >>> 4);
      const start = freeSlot(w, salon, key, staff.id, svc.durationMinutes, seed >>> 6);
      if (!start) continue;
      // Réservé « il y a un à trois jours » : le journal ne montre pas trois demandes datées de l'instant.
      // (une demande en attente reste récente : le cron local l'expirerait sinon à 24 h).
      const createdAt = status === 'pending' ? plus(nowI, -60) : plus(nowI, -((seed % 3) + 1) * 24 * 60 - (seed % 300));
      const b = bookingRow(salon, svc, staff.id, start, status, { id: userId, name: acct.fullName, phone: acct.phone }, { source: 'online', createdAt });
      w.bookings.push(b);
      onBookingChange(w, null, b);
      for (const n of w.notifications) if (n.bookingId === b.id) Object.assign(n, { createdAt, readAt: createdAt });
      busy.add(key);
      changes++;
      return;
    }
  };
  const confirmed = mine.filter((b) => b.status === 'confirmed').length;
  for (let i = confirmed; i < 2; i++) place('confirmed', 3 + i * 4, `confirmed:${i}`);
  if (!mine.some((b) => b.status === 'pending')) place('pending', 1, 'pending');
  // La demande en attente du client de démonstration ne périme pas tant que le pro ne répond pas.
  for (const b of mine) if (b.status === 'pending' && new Date(b.createdAt).getTime() < now - 20 * 3_600_000) b.createdAt = new Date(now - 3_600_000).toISOString();
  return changes;
}

/** Ce que fait le cron : clôtures, expirations, rappels (la veille et 2 h avant), purge des notifications. */
function cronLike(w: World, now: number): number {
  let changes = 0;
  const nowI = new Date(now).toISOString();
  for (const b of w.bookings) {
    if (b.status === 'confirmed' && new Date(b.endsAt).getTime() < now - 3 * 3_600_000) {
      const before = { ...b };
      b.status = 'completed';
      b.updatedAt = nowI;
      onBookingChange(w, before, b);
      changes++;
    } else if (b.status === 'pending' && (b.startsAt < nowI || new Date(b.createdAt).getTime() < now - PENDING_REQUEST_TTL_HOURS * 3_600_000)) {
      const before = { ...b };
      b.status = 'cancelled';
      b.cancelledAt = nowI;
      b.cancelledBy = 'system';
      b.updatedAt = nowI;
      onBookingChange(w, before, b);
      changes++;
    }
  }
  // Rappels : la veille (23–25 h avant) et 2 h avant (30 min – 2 h 15), pour les clients de démonstration.
  const reminded = (key: string) => w.notifications.some((n) => n.type === 'booking_reminder' && (n.data as { reminder?: string }).reminder === key);
  for (const b of w.bookings) {
    if (b.status !== 'confirmed' || !b.clientId || !w.profiles[b.clientId]?.remindersEnabled) continue;
    const salon = w.salons.find((s) => s.id === b.salonId);
    const startMs = new Date(b.startsAt).getTime();
    const dayKey = `${b.id}:j-1`;
    const twoKey = `${b.id}:2h`;
    if (startMs > now + 23 * 3_600_000 && startMs < now + 25 * 3_600_000 && !reminded(dayKey)) {
      notify(w, b.clientId, 'booking_reminder', 'Rappel : rendez-vous demain', `${salon?.name ?? 'Votre salon'} · ${b.serviceName} · ${fmtWhen(b.startsAt)}`, b, { data: { bookingId: b.id, salonId: b.salonId, status: b.status, reminder: dayKey } });
      changes++;
    }
    if (startMs > now + 30 * 60_000 && startMs < now + 135 * 60_000 && !reminded(twoKey)) {
      notify(w, b.clientId, 'booking_reminder', 'Rappel : rendez-vous dans 2 h', `${salon?.name ?? 'Votre salon'} · ${b.serviceName} · ${fmtWhen(b.startsAt)}`, b, { data: { bookingId: b.id, salonId: b.salonId, status: b.status, reminder: twoKey } });
      changes++;
    }
  }
  const beforeN = w.notifications.length;
  w.notifications = w.notifications.filter((n) => !(n.readAt && new Date(n.readAt).getTime() < now - 7 * 86_400_000) && new Date(n.createdAt).getTime() > now - 30 * 86_400_000);
  changes += beforeN - w.notifications.length;
  return changes;
}

let lastAdvance = 0;

/** Fait avancer le monde jusqu'à `now`. Renvoie le nombre de changements (0 = rien à rafraîchir). */
export function advance(w: World, now = Date.now(), force = false): number {
  if (!force && now - lastAdvance < 5_000) return 0;
  lastAdvance = now;
  let changes = cronLike(w, now);
  for (const spec of SALON_SPECS) {
    const salon = w.salons.find((s) => s.id === spec.id);
    if (!salon) continue;
    changes += animateSalon(w, salon, now);
    const clientKey: DemoAccountKey = spec.owner === 'hommes' ? 'clienthomme' : 'clientfemme';
    changes += topUpClient(w, salon, DEMO_ACCOUNTS.find((a) => a.key === clientKey)!, now);
  }
  if (changes) saveWorld();
  return changes;
}
