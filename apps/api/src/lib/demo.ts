/**
 * Monde de démonstration : deux professionnels (hommes, femmes) et deux clients (homme, femme), avec
 * salons publiés, catalogues complets, un visuel par prestation, équipe, horaires, historique de
 * rendez-vous, avis et notifications. Construit à la première connexion d'un compte de démonstration
 * (`POST /v1/auth/dev-login`), idempotent : un salon existant n'est pas recréé, un client qui a déjà
 * des rendez-vous n'en reçoit pas d'autres. Best-effort : une erreur ici n'empêche jamais la connexion.
 *
 * Les visuels sont des fichiers `demo/<clé>.webp` des buckets `salons` et `avatars`, générés et
 * déposés par `pnpm demo:visuals` (scripts/demo-visuals.mjs). Les comptes et le catalogue viennent de
 * `@salondz/constants` (demo.ts).
 */
import type { FastifyBaseLogger } from 'fastify';
import {
  DEMO_ACCOUNTS,
  DEMO_SERVICES_MEN,
  DEMO_SERVICES_WOMEN,
  DEMO_VISUAL_KEYS,
  addDaysToKey,
  localDateTimeToISO,
  toLocalDateKey,
  type DemoAccount,
  type DemoAccountKey,
  type DemoService,
} from '@salondz/constants';
import { config } from '../config';
import { db } from './supabase';

export const demoImage = (key: string) => `${config.SUPABASE_URL}/storage/v1/object/public/salons/demo/${key}.webp`;
export const demoAvatar = (key: string) => `${config.SUPABASE_URL}/storage/v1/object/public/avatars/demo/${key}.webp`;

interface SalonSpec {
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
  /** Second membre de l'équipe (le propriétaire est créé par le déclencheur `salons_after_insert`). */
  staff2: { name: string; avatar: string };
  /** Horaires : `null` = fermé ce jour-là (0 = dimanche). */
  hours: (readonly [string, string] | null)[];
  autoConfirm: boolean;
  cancelMinHours: number;
  /** Prestations « phares » pour les couvertures et les réalisations (clés du catalogue). */
  showcase: string[];
}

const SALONS: SalonSpec[] = [
  {
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
    // Samedi → jeudi 9h–20h, vendredi après-midi seulement.
    hours: [['09:00', '20:00'], ['09:00', '20:00'], ['09:00', '20:00'], ['09:00', '20:00'], ['09:00', '20:00'], ['14:00', '20:00'], ['09:00', '20:00']],
    autoConfirm: true,
    cancelMinHours: 2,
    showcase: ['h-coupe-barbe', 'h-lissage-keratine', 'h-barbe', 'h-coupe-mariage'],
  },
  {
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
    // Samedi → jeudi 9h–18h, fermé le vendredi.
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

interface BuiltSalon {
  id: string;
  spec: SalonSpec;
  staff: { id: string; name: string }[];
  services: { id: string; key: string; name: string; minutes: number; priceDa: number }[];
}

/** Compte auth + profil d'un compte de démonstration (créé au besoin). Renvoie l'identifiant utilisateur. */
export async function ensureDemoUser(acct: DemoAccount): Promise<string> {
  const found = await db.rpc('auth_user_by_email', { p_email: acct.email });
  if (found.error) throw found.error;
  let id = (found.data as { id: string }[] | null)?.[0]?.id;
  if (!id) {
    // Le numéro passe par les métadonnées (le déclencheur `handle_new_user` le pose sur le profil) : la
    // connexion par téléphone est désactivée sur le projet et GoTrue refuse un `phone` direct.
    const created = await db.auth.admin.createUser({
      email: acct.email,
      email_confirm: true,
      user_metadata: { role: acct.role, full_name: acct.fullName, phone: acct.phone },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error('createUser');
    id = created.data.user.id;
  }
  // Profil toujours réaligné : un compte de démonstration reste ce qu'il est, quoi qu'en ait fait une démo.
  const upd = await db
    .from('profiles')
    .update({ role: acct.role, full_name: acct.fullName, phone: acct.phone, gender: acct.gender, market: acct.market, avatar_url: demoAvatar(AVATARS[acct.key]) })
    .eq('id', id);
  if (upd.error) throw upd.error;
  return id;
}

async function loadSalon(ownerId: string, spec: SalonSpec): Promise<BuiltSalon | null> {
  const s = await db.from('salons').select('id').eq('owner_id', ownerId).maybeSingle();
  if (s.error) throw s.error;
  if (!s.data) return null;
  const [staff, services] = await Promise.all([
    db.from('staff').select('id, display_name').eq('salon_id', s.data.id).eq('is_active', true).order('sort_order'),
    db.from('services').select('id, name, duration_minutes, price_da').eq('salon_id', s.data.id).eq('is_active', true).order('sort_order'),
  ]);
  if (staff.error) throw staff.error;
  if (services.error) throw services.error;
  const byName = new Map(spec.services.map((x) => [x.name, x.key]));
  return {
    id: s.data.id as string,
    spec,
    staff: (staff.data ?? []).map((x) => ({ id: x.id as string, name: x.display_name as string })),
    services: (services.data ?? []).map((x) => ({ id: x.id as string, key: byName.get(x.name as string) ?? '', name: x.name as string, minutes: x.duration_minutes as number, priceDa: x.price_da as number })),
  };
}

async function ensureSalon(log: FastifyBaseLogger, ownerId: string, spec: SalonSpec): Promise<BuiltSalon> {
  const existing = await loadSalon(ownerId, spec);
  if (existing) return existing;

  const created = await db
    .from('salons')
    .insert({
      owner_id: ownerId,
      slug: spec.slug,
      name: spec.name,
      description: spec.description,
      phone: DEMO_ACCOUNTS.find((a) => a.key === spec.owner)!.phone,
      wilaya_code: 16,
      city: spec.city,
      zone: spec.zone,
      address: spec.address,
      lat: spec.lat,
      lng: spec.lng,
      gender_target: spec.gender,
      is_published: true,
      auto_confirm: spec.autoConfirm,
      cancel_min_hours: spec.cancelMinHours,
      booking_horizon_days: 30,
      booking_lead_time_minutes: 30,
      slot_interval_minutes: 15,
      cover_url: demoImage(spec.cover),
      logo_url: demoImage(spec.logo),
    })
    .select('id')
    .single();
  if (created.error || !created.data) throw created.error ?? new Error('salon insert');
  const salonId = created.data.id as string;

  const services = await db
    .from('services')
    .insert(
      spec.services.map((s, i) => ({
        salon_id: salonId,
        name: s.name,
        description: s.description ?? null,
        duration_minutes: s.minutes,
        price_da: s.priceDa,
        category_id: s.categoryId,
        is_active: true,
        sort_order: i,
      })),
    )
    .select('id, name');
  if (services.error) throw services.error;
  const byName = new Map(spec.services.map((x) => [x.name, x]));
  const built = (services.data ?? []).map((row) => {
    const s = byName.get(row.name as string)!;
    return { id: row.id as string, key: s.key, name: s.name, minutes: s.minutes, priceDa: s.priceDa };
  });

  // Propriétaire = premier membre (déclencheur) ; on lui donne sa photo et un second membre à l'équipe.
  const owner = await db.from('staff').select('id, display_name').eq('salon_id', salonId).order('sort_order').limit(1).maybeSingle();
  if (owner.error) throw owner.error;
  const ownerAcct = DEMO_ACCOUNTS.find((a) => a.key === spec.owner)!;
  if (owner.data) await db.from('staff').update({ avatar_url: demoAvatar(AVATARS[spec.owner]), display_name: ownerAcct.fullName.split(' ')[0]! }).eq('id', owner.data.id);
  const second = await db
    .from('staff')
    .insert({ salon_id: salonId, display_name: spec.staff2.name, avatar_url: demoAvatar(spec.staff2.avatar), sort_order: 1, all_services: true })
    .select('id, display_name')
    .single();
  if (second.error) throw second.error;

  const results = await Promise.all([
    db.from('salon_categories').insert(spec.categories.map((c) => ({ salon_id: salonId, category_id: c }))),
    db.from('opening_hours').insert(
      spec.hours.map((h, d) => ({ salon_id: salonId, day_of_week: d, opens_at: h ? h[0] : '09:00', closes_at: h ? h[1] : '18:00', is_closed: !h })),
    ),
    db.from('service_photos').insert(built.map((s) => ({ service_id: s.id, url: demoImage(s.key), sort_order: 0 }))),
    db.from('salon_photos').insert([
      { salon_id: salonId, url: demoImage(spec.cover), sort_order: 0, kind: 'cover' },
      ...spec.showcase.slice(0, 2).map((k, i) => ({ salon_id: salonId, url: demoImage(k), sort_order: i + 1, kind: 'cover' })),
      ...spec.showcase.map((k, i) => ({ salon_id: salonId, url: demoImage(k), sort_order: i, kind: 'work' })),
    ]),
  ]);
  for (const r of results) if (r.error) log.warn({ err: r.error }, 'demo salon content');

  const staff = [
    ...(owner.data ? [{ id: owner.data.id as string, name: ownerAcct.fullName.split(' ')[0]! }] : []),
    { id: second.data.id as string, name: spec.staff2.name },
  ];
  log.info({ salonId, slug: spec.slug }, 'salon de démonstration créé');
  return { id: salonId, spec, staff, services: built };
}

const at = (dayOffset: number, hm: string) => localDateTimeToISO(addDaysToKey(toLocalDateKey(), dayOffset), hm);
const plus = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

function bookingRow(
  salon: BuiltSalon,
  svc: BuiltSalon['services'][number],
  staffId: string,
  startsAt: string,
  status: 'confirmed' | 'completed' | 'cancelled' | 'no_show',
  client: { id: string | null; name: string; phone: string | null },
  extra: Record<string, unknown> = {},
) {
  return {
    salon_id: salon.id,
    client_id: client.id,
    staff_id: staffId,
    service_id: svc.id,
    service_name: svc.name,
    duration_minutes: svc.minutes,
    price_da: svc.priceDa,
    starts_at: startsAt,
    ends_at: plus(startsAt, svc.minutes),
    status,
    client_name: client.name,
    client_phone: client.phone,
    ...extra,
  };
}

/* -------------------------------------------------------------------------------------------
 * Animation : les salons de démonstration VIVENT. À chaque tick du cron (et à chaque connexion de
 * démonstration) on complète ce qui manque : des rendez-vous d'hier, d'aujourd'hui, de demain et
 * d'après-demain (clients de passage fictifs), une absence signalée hier, une demande à confirmer,
 * une annulation récente, une nouveauté « en direct » (nouvelle réservation ou annulation) au plus
 * toutes les LIVE_EVENT_MINUTES, et pour chaque client de démonstration deux rendez-vous à venir plus
 * une demande en attente. Tout passe par les déclencheurs habituels : les notifications (et les push)
 * sont celles de l'application, pas des fausses.
 * ------------------------------------------------------------------------------------------- */
const POOL_MEN: [string, string | null][] = [
  ['Mohamed R.', '+213550100110'], ['Sid Ali', null], ['Rayan B.', '+213550100111'], ['Walid', null], ['Anis K.', '+213550100112'], ['Hamza', null],
  ['Bilal M.', '+213550100113'], ['Yanis', null], ['Riad T.', '+213550100114'], ['Nassim', null], ['Amine D.', '+213550100115'], ['Islam', null],
];
const POOL_WOMEN: [string, string | null][] = [
  ['Nadia B.', '+213550100120'], ['Sarah M.', null], ['Meriem', '+213550100121'], ['Rania K.', null], ['Houda', '+213550100122'], ['Imène', null],
  ['Lydia', '+213550100123'], ['Feriel B.', null], ['Kenza', '+213550100124'], ['Asma T.', null], ['Sonia', '+213550100125'], ['Manel', null],
];
/** Rendez-vous voulus chaque jour : hier, aujourd'hui, demain, après-demain. */
const DAY_TARGET: Record<number, number> = { [-1]: 4, 0: 4, 1: 3, 2: 3 };
/** Une nouveauté « en direct » au plus toutes les 90 minutes. */
const LIVE_EVENT_MINUTES = 90;
/** Les clients de passage plus vieux que ça sont effacés (le monde ne grossit pas indéfiniment). */
const PURGE_AFTER_DAYS = 45;

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const dowOf = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`).getUTCDay();
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const toHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

interface Taken {
  staff_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

async function bookingsBetween(salonId: string, fromKey: string, toKeyExclusive: string) {
  const r = await db
    .from('bookings')
    .select('id, staff_id, starts_at, ends_at, status, client_id, client_name, source, cancelled_at')
    .eq('salon_id', salonId)
    .gte('starts_at', localDateTimeToISO(fromKey, '00:00'))
    .lt('starts_at', localDateTimeToISO(toKeyExclusive, '00:00'));
  if (r.error) throw r.error;
  return (r.data ?? []) as (Taken & { id: string; client_id: string | null; client_name: string; source: string; cancelled_at: string | null })[];
}

/** Un début de créneau libre pour ce membre ce jour-là, dans les horaires du salon, sans chevauchement. */
function freeSlot(spec: SalonSpec, dateKey: string, staffId: string, minutes: number, taken: Taken[], seed: number): string | null {
  const h = spec.hours[dowOf(dateKey)];
  if (!h) return null;
  const candidates: string[] = [];
  for (let m = toMin(h[0]); m + minutes <= toMin(h[1]); m += 30) candidates.push(toHM(m));
  if (!candidates.length) return null;
  const first = seed % candidates.length;
  for (let i = 0; i < candidates.length; i++) {
    const start = localDateTimeToISO(dateKey, candidates[(first + i) % candidates.length]!);
    const end = plus(start, minutes);
    const clash = taken.some((b) => b.staff_id === staffId && b.status !== 'cancelled' && b.status !== 'no_show' && b.starts_at < end && b.ends_at > start);
    if (!clash) return start;
  }
  return null;
}

const statusFor = (start: string, minutes: number, now: number) => (new Date(plus(start, minutes)).getTime() < now - 3 * 3_600_000 ? 'completed' : 'confirmed');

/** Fait vivre un salon : journées pleines, absence, demande à confirmer, annulation, nouveauté en direct. */
async function animateSalon(log: FastifyBaseLogger, salon: BuiltSalon, ownerId: string): Promise<number> {
  const { spec } = salon;
  if (salon.staff.length === 0 || salon.services.length === 0) return 0;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const today = toLocalDateKey();
  const pool = spec.gender === 'men' ? POOL_MEN : POOL_WOMEN;
  const hourSeed = hash(`${salon.id}:${Math.floor(now / 3_600_000)}`);
  const pick = (seed: number) => {
    const staff = salon.staff[seed % salon.staff.length]!;
    const svc = salon.services[(seed >>> 3) % salon.services.length]!;
    const [name, phone] = pool[(seed >>> 9) % pool.length]!;
    return { staff, svc, name, phone };
  };
  let created = 0;
  let events = 0;

  // Nouveauté « en direct » : décidée AVANT d'écrire, sur la dernière notification du pro.
  const lastNotif = await db.from('notifications').select('created_at').eq('user_id', ownerId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const quietFor = lastNotif.data ? now - new Date(lastNotif.data.created_at as string).getTime() : Infinity;
  const wantsEvent = quietFor > LIVE_EVENT_MINUTES * 60_000;

  const window = await bookingsBetween(salon.id, addDaysToKey(today, -1), addDaysToKey(today, 4));

  // 1) Hier → après-demain : des journées pleines, clients de passage ou par téléphone.
  for (const off of [-1, 0, 1, 2]) {
    const key = addDaysToKey(today, off);
    if (!spec.hours[dowOf(key)]) continue;
    const dayRows = window.filter((b) => b.starts_at >= localDateTimeToISO(key, '00:00') && b.starts_at < localDateTimeToISO(addDaysToKey(key, 1), '00:00'));
    const active = dayRows.filter((b) => b.status !== 'cancelled').length;
    const rows: ReturnType<typeof bookingRow>[] = [];
    for (let i = active; i < (DAY_TARGET[off] ?? 0); i++) {
      const seed = hash(`${salon.id}:${key}:${i}`);
      const { staff, svc, name, phone } = pick(seed);
      const start = freeSlot(spec, key, staff.id, svc.minutes, [...dayRows, ...rows], seed >>> 6);
      if (!start) break;
      rows.push(
        bookingRow(salon, svc, staff.id, start, statusFor(start, svc.minutes, now), { id: null, name, phone }, {
          source: seed % 3 === 0 ? 'phone' : 'walk_in',
          created_at: plus(start, -(60 + (seed % 5) * 24 * 60)),
        }),
      );
    }
    if (rows.length) {
      const ins = await db.from('bookings').insert(rows);
      if (ins.error) log.warn({ err: ins.error }, 'demo journée');
      else created += rows.length;
    }
    // Hier : une absence signalée, comme dans la vraie vie.
    if (off === -1 && !dayRows.some((b) => b.status === 'no_show')) {
      const done = dayRows.find((b) => b.status === 'completed' && !b.client_id);
      if (done) await db.from('bookings').update({ status: 'no_show' }).eq('id', done.id);
    }
  }

  // 2) Une demande à confirmer (le pastille « à valider » n'est jamais vide).
  const pending = window.filter((b) => b.status === 'pending' && b.starts_at > nowIso);
  if (!pending.length) {
    const key = addDaysToKey(today, 1 + (hourSeed % 2));
    const seed = hash(`${salon.id}:pending:${key}`);
    const { staff, svc, name, phone } = pick(seed);
    const start = freeSlot(spec, key, staff.id, svc.minutes, window, seed >>> 6);
    if (start) {
      const ins = await db.from('bookings').insert(bookingRow(salon, svc, staff.id, start, 'confirmed', { id: null, name, phone }, { status: 'pending', source: 'online', created_at: nowIso }));
      if (ins.error) log.warn({ err: ins.error }, 'demo demande');
      else {
        created++;
        events++;
      }
    }
  }

  // 3) Une annulation récente (deux jours) : un client de passage se désiste.
  const recentCancel = window.some((b) => b.status === 'cancelled' && b.cancelled_at && new Date(b.cancelled_at).getTime() > now - 2 * 86_400_000);
  if (!recentCancel && events === 0) {
    const victim = window.find((b) => b.status === 'confirmed' && !b.client_id && b.starts_at > new Date(now + 2 * 3_600_000).toISOString());
    if (victim) {
      const upd = await db
        .from('bookings')
        .update({ status: 'cancelled', cancelled_at: nowIso, cancelled_by: 'client', cancellation_reason: 'Empêchement' })
        .eq('id', victim.id);
      if (upd.error) log.warn({ err: upd.error }, 'demo annulation');
      else events++;
    }
  }

  // 4) Nouveauté en direct : une réservation en ligne qui arrive, si rien ne s'est passé depuis un moment.
  if (wantsEvent && events === 0) {
    const key = addDaysToKey(today, 1 + (hourSeed % 3));
    const seed = hash(`${salon.id}:live:${key}:${hourSeed}`);
    const { staff, svc, name, phone } = pick(seed);
    const start = freeSlot(spec, key, staff.id, svc.minutes, window, seed >>> 6);
    if (start) {
      const ins = await db
        .from('bookings')
        .insert(bookingRow(salon, svc, staff.id, start, 'confirmed', { id: null, name, phone }, { status: spec.autoConfirm ? 'confirmed' : 'pending', source: 'online', created_at: nowIso }));
      if (ins.error) log.warn({ err: ins.error }, 'demo nouveauté');
      else {
        created++;
        events++;
      }
    }
  }

  // 5) Purge des clients de passage anciens.
  await db.from('bookings').delete().eq('salon_id', salon.id).is('client_id', null).lt('starts_at', new Date(now - PURGE_AFTER_DAYS * 86_400_000).toISOString());

  if (created || events) log.info({ salon: spec.slug, created, events }, 'démo animée');
  return created;
}

/** Un client de démonstration garde toujours deux rendez-vous confirmés à venir et une demande en attente. */
async function topUpClient(log: FastifyBaseLogger, salon: BuiltSalon, acct: DemoAccount, userId: string) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const today = toLocalDateKey();
  const up = await db.from('bookings').select('id, status, starts_at, created_at').eq('client_id', userId).eq('salon_id', salon.id).in('status', ['pending', 'confirmed']).gt('starts_at', nowIso);
  if (up.error) throw up.error;
  const mine = up.data ?? [];
  const busyDays = new Set(mine.map((b) => toLocalDateKey(new Date(b.starts_at as string))));
  const client = { id: userId, name: acct.fullName, phone: acct.phone };
  const men = acct.key === 'clienthomme';
  const favourites = men ? ['h-coupe-barbe', 'h-coupe', 'h-barbe', 'h-coupe-barbe-shampoing'] : ['f-brushing', 'f-pose-gel', 'f-manucure', 'f-semi-permanent', 'f-nettoyage-peau'];
  const svcFor = (seed: number) => salon.services.find((s) => s.key === favourites[seed % favourites.length]) ?? salon.services[0]!;
  const rows: ReturnType<typeof bookingRow>[] = [];
  const window = await bookingsBetween(salon.id, today, addDaysToKey(today, 15));

  const place = (status: 'confirmed' | 'pending', fromDay: number, seedKey: string) => {
    for (let off = fromDay; off < fromDay + 10; off++) {
      const key = addDaysToKey(today, off);
      if (busyDays.has(key) || !salon.spec.hours[dowOf(key)]) continue;
      const seed = hash(`${salon.id}:${userId}:${seedKey}:${key}`);
      const staff = salon.staff[seed % salon.staff.length]!;
      const svc = svcFor(seed >>> 4);
      const start = freeSlot(salon.spec, key, staff.id, svc.minutes, [...window, ...rows], seed >>> 6);
      if (!start) continue;
      rows.push(bookingRow(salon, svc, staff.id, start, 'confirmed', client, { status, source: 'online', created_at: nowIso }));
      busyDays.add(key);
      return;
    }
  };
  const confirmed = mine.filter((b) => b.status === 'confirmed').length;
  for (let i = confirmed; i < 2; i++) place('confirmed', 3 + i * 4, `confirmed:${i}`);
  if (!mine.some((b) => b.status === 'pending')) place('pending', 1, 'pending');
  if (rows.length) {
    const ins = await db.from('bookings').insert(rows);
    if (ins.error) log.warn({ err: ins.error }, 'demo client à venir');
  }
  // La demande en attente du client de démonstration ne périme pas tant que le pro ne répond pas :
  // elle reste « fraîche » pour le cron (expiration à 24 h), et redevient une nouveauté dès qu'il la confirme.
  const stale = mine.filter((b) => b.status === 'pending' && new Date(b.created_at as string).getTime() < now - 20 * 3_600_000);
  for (const b of stale) await db.from('bookings').update({ created_at: new Date(now - 3_600_000).toISOString(), pro_reminded_at: null }).eq('id', b.id);
}

/** Historique d'un client de démonstration dans « son » salon : passés terminés, un annulé, deux à venir, avis. */
async function ensureClientHistory(log: FastifyBaseLogger, acct: DemoAccount, userId: string, salon: BuiltSalon) {
  const count = await db.from('bookings').select('id', { count: 'exact', head: true }).eq('client_id', userId);
  if (count.error) throw count.error;
  if ((count.count ?? 0) > 0) return;

  const men = acct.key === 'clienthomme';
  const svc = (key: string) => salon.services.find((s) => s.key === key) ?? salon.services[0]!;
  const staff = salon.staff[0]!.id;
  const staff2 = (salon.staff[1] ?? salon.staff[0])!.id;
  const client = { id: userId, name: acct.fullName, phone: acct.phone };
  const past: [number, string, string, string][] = men
    ? [
        [-52, '18:00', 'h-coupe-barbe', staff],
        [-24, '17:30', 'h-coupe-barbe-shampoing', staff],
        [-6, '18:30', 'h-coupe-barbe', staff2],
      ]
    : [
        [-40, '10:00', 'f-coupe', staff],
        [-19, '14:00', 'f-pose-gel', staff2],
        [-5, '11:00', 'f-brushing', staff],
      ];
  const rows = past.map(([d, hm, key, st]) => bookingRow(salon, svc(key), st, at(d, hm), 'completed', client, { source: 'online', created_at: at(d - 2, '20:15') }));
  // Une annulation ancienne (hors fenêtre anti-abus), par le client.
  rows.push(
    bookingRow(salon, svc(men ? 'h-coupe' : 'f-manucure'), staff, at(-33, men ? '12:00' : '15:00'), 'cancelled', client, {
      source: 'online',
      cancelled_at: at(-34, '09:10'),
      cancelled_by: 'client',
      cancellation_reason: 'Empêchement',
      created_at: at(-36, '21:00'),
    }),
  );
  // À venir : ce qui fait vivre l'écran « Mes rendez-vous ». Créés en ligne, donc notifiés par le déclencheur.
  const upcoming: [number, string, string, string][] = men
    ? [
        [2, '18:00', 'h-coupe-barbe', staff],
        [16, '17:30', 'h-lissage-keratine', staff2],
      ]
    : [
        [3, '14:00', 'f-extension-cils', staff2],
        [12, '10:00', 'f-coloration', staff],
      ];
  // Toutes les lignes portent `created_at` : un lot hétérogène enverrait `null` aux lignes qui l'omettent.
  for (const [d, hm, key, st] of upcoming) rows.push(bookingRow(salon, svc(key), st, at(d, hm), 'confirmed', client, { source: 'online', created_at: at(d - 3, '19:30') }));

  const ins = await db.from('bookings').insert(rows).select('id, starts_at, status, service_name, created_at');
  if (ins.error) throw ins.error;
  const done = (ins.data ?? []).filter((b) => b.status === 'completed').sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));

  // Le déclencheur a notifié chaque ligne « en ligne » comme une demande du moment : on efface ces
  // notifications pour l'historique (passé, annulé) et on date celles des rendez-vous à venir de leur
  // réservation, pour que le journal des deux comptes reste vraisemblable.
  const upcomingIds = (ins.data ?? []).filter((b) => b.status === 'confirmed').map((b) => b.id as string);
  const historyIds = (ins.data ?? []).filter((b) => b.status !== 'confirmed').map((b) => b.id as string);
  if (historyIds.length) await db.from('notifications').delete().in('booking_id', historyIds);
  for (const b of (ins.data ?? []).filter((x) => upcomingIds.includes(x.id as string))) {
    await db.from('notifications').update({ created_at: b.created_at as string, read_at: b.created_at as string }).eq('booking_id', b.id);
  }

  // Avis sur les deux derniers rendez-vous terminés.
  const reviews = men
    ? ['Toujours propre et rapide, Karim connaît ma coupe par cœur.', 'Barbe impeccable, serviette chaude au top. Je recommande.']
    : ['Pose gel très soignée, Lina prend son temps. Tenue parfaite trois semaines.', 'Brushing rapide et brillant, salon calme et propre.']
  ;
  const toReview = done.slice(-2);
  if (toReview.length) {
    const rv = await db.from('reviews').insert(
      toReview.map((b, i) => ({ salon_id: salon.id, booking_id: b.id, client_id: userId, rating: i === toReview.length - 1 ? 5 : 4, comment: reviews[i]!, created_at: plus(String(b.starts_at), 26 * 60) })),
    );
    if (rv.error) log.warn({ err: rv.error }, 'demo reviews');
  }

  const fav = await db.from('favorites').insert({ user_id: userId, salon_id: salon.id }).select('user_id');
  if (fav.error && !/duplicate/i.test(fav.error.message)) log.warn({ err: fav.error }, 'demo favorite');

  // Une notification « merci pour votre visite » lue, pour le dernier passage.
  const last = done.at(-1);
  if (last) {
    const notif = await db.from('notifications').insert({
      user_id: userId,
      type: 'booking_completed',
      title: 'Merci pour votre visite',
      body: `Donnez votre avis sur ${salon.spec.name}`,
      data: { bookingId: last.id, salonId: salon.id, status: 'completed' },
      booking_id: last.id,
      created_at: plus(String(last.starts_at), 4 * 60),
      read_at: plus(String(last.starts_at), 26 * 60),
    });
    if (notif.error) log.warn({ err: notif.error }, 'demo notification');
  }

  // Note du salon sur ce client (fiche client côté pro).
  const note = await db.from('client_notes').upsert(
    { salon_id: salon.id, client_key: userId, notes: men ? 'Dégradé bas, barbe courte. Préfère Karim, vient le jeudi soir.' : 'Cheveux fins : brushing doux. Allergique au gel avec HEMA.', updated_at: new Date().toISOString() },
    { onConflict: 'salon_id,client_key' },
  );
  if (note.error) log.warn({ err: note.error }, 'demo client note');
  log.info({ client: acct.key }, 'historique de démonstration créé');
}

let building: Promise<void> | null = null;

/** Construit (ou complète) tout le monde de démonstration, puis l'anime. Jamais deux passages en parallèle. */
export function ensureDemoWorld(log: FastifyBaseLogger): Promise<void> {
  if (!building) {
    building = (async () => {
      try {
        const ids = new Map<DemoAccountKey, string>();
        for (const acct of DEMO_ACCOUNTS) ids.set(acct.key, await ensureDemoUser(acct));
        const salons = new Map<DemoAccountKey, BuiltSalon>();
        for (const spec of SALONS) salons.set(spec.owner, await ensureSalon(log, ids.get(spec.owner)!, spec));
        const men = salons.get('hommes');
        const women = salons.get('femmes');
        const ch = DEMO_ACCOUNTS.find((a) => a.key === 'clienthomme')!;
        const cf = DEMO_ACCOUNTS.find((a) => a.key === 'clientfemme')!;
        if (men) await ensureClientHistory(log, ch, ids.get('clienthomme')!, men);
        if (women) await ensureClientHistory(log, cf, ids.get('clientfemme')!, women);
        // Puis la vie du jour : journées pleines, demandes, annulations, nouveautés, rendez-vous des clients.
        if (men) {
          await animateSalon(log, men, ids.get('hommes')!);
          await topUpClient(log, men, ch, ids.get('clienthomme')!);
        }
        if (women) {
          await animateSalon(log, women, ids.get('femmes')!);
          await topUpClient(log, women, cf, ids.get('clientfemme')!);
        }
      } catch (err) {
        log.warn({ err }, 'ensureDemoWorld');
      } finally {
        building = null;
      }
    })();
  }
  return building;
}
