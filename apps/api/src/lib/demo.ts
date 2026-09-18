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
  // Agenda vivant : quelques clients de passage aujourd'hui et demain (sans compte).
  await seedWalkIns(log, { id: salonId, spec, staff, services: built });
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

/** Rendez-vous de clients de passage (sans compte) : l'agenda du pro n'est jamais vide en démonstration. */
async function seedWalkIns(log: FastifyBaseLogger, salon: BuiltSalon) {
  const [s1, s2] = salon.staff;
  if (!s1 || !s2) return;
  const svc = (key: string) => salon.services.find((s) => s.key === key) ?? salon.services[0]!;
  const men = salon.spec.gender === 'men';
  const names: [string, string][] = men
    ? [
        ['Mohamed R.', 'h-coupe-barbe'],
        ['Sid Ali', 'h-coupe'],
        ['Rayan B.', 'h-barbe'],
        ['Walid', 'h-coupe-barbe-brushing'],
        ['Anis K.', 'h-tracage'],
        ['Hamza', 'h-coupe-barbe'],
      ]
    : [
        ['Nadia B.', 'f-brushing'],
        ['Sarah M.', 'f-pose-gel'],
        ['Meriem', 'f-manucure'],
        ['Rania K.', 'f-extension-cils'],
        ['Houda', 'f-coupe'],
        ['Imène', 'f-nettoyage-peau'],
      ];
  // Deux colonnes, aucun chevauchement : chaque membre enchaîne ses rendez-vous.
  const rows: Record<string, unknown>[] = [];
  const dayPlan: [number, string, string][] = [
    [0, '10:00', '16:00'],
    [1, '10:30', '15:00'],
  ];
  let n = 0;
  for (const [day, t1, t2] of dayPlan) {
    let cursor1 = at(day, t1);
    let cursor2 = at(day, t2);
    for (let k = 0; k < 3; k++) {
      const [name, key] = names[n % names.length]!;
      n++;
      const a = svc(key);
      const useFirst = k % 2 === 0;
      const start = useFirst ? cursor1 : cursor2;
      const status = new Date(start).getTime() < Date.now() - 3 * 3_600_000 ? 'completed' : 'confirmed';
      rows.push(bookingRow(salon, a, useFirst ? s1.id : s2.id, start, status, { id: null, name, phone: null }, { source: 'walk_in' }));
      if (useFirst) cursor1 = plus(start, a.minutes + 15);
      else cursor2 = plus(start, a.minutes + 15);
    }
  }
  const ins = await db.from('bookings').insert(rows);
  if (ins.error) log.warn({ err: ins.error }, 'demo walk-ins');
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

/** Construit (ou complète) tout le monde de démonstration. Jamais deux constructions en parallèle. */
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
      } catch (err) {
        log.warn({ err }, 'ensureDemoWorld');
      } finally {
        building = null;
      }
    })();
  }
  return building;
}
