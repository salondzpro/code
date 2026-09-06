// Données de démonstration : 2 salons publiés avec photos, une cliente avec un rendez-vous et des favoris.
//   pnpm demo:seed      → crée les comptes et écrit scripts/.demo.json (ids + sessions, gitignoré)
//   pnpm demo:cleanup   → supprime les comptes créés (cascade sur salons, réservations, avis)
// Requiert l'API locale (pnpm dev:api) et les variables de `.env` (chargées par `node --env-file`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '.demo.json');
const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;
const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY / SUPABASE_PUBLISHABLE_KEY manquants (lancer via pnpm demo:seed)');
}
const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

if (process.argv.includes('--cleanup')) {
  if (!fs.existsSync(OUT)) {
    console.log('rien à nettoyer (pas de scripts/.demo.json)');
    process.exit(0);
  }
  const demo = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  for (const id of demo.userIds) await admin.auth.admin.deleteUser(id).catch((e) => console.log('cleanup', e.message));
  fs.unlinkSync(OUT);
  console.log('cleanup done');
  process.exit(0);
}

const health = await fetch(`${API}/health`).catch(() => null);
if (!health?.ok) throw new Error(`API injoignable sur ${API} : lancer pnpm dev:api`);

const RUN = Date.now().toString(36);
const PASSWORD = `Demo-${RUN}-Aa1!`;
const userIds = [];

async function user(label, role, fullName, meta = {}) {
  const email = `demo-${label}-${RUN}@salondz.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: fullName, ...meta },
  });
  if (error) throw error;
  userIds.push(data.user.id);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const session = await res.json();
  if (!session.access_token) throw new Error(`connexion impossible pour ${email}: ${JSON.stringify(session)}`);
  return { id: data.user.id, email, session, token: session.access_token };
}

async function api(method, p, token, body) {
  const res = await fetch(`${API}/v1${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const U = (id, w = 900) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;
const PHOTOS = {
  sarahCover: U('photo-1600948836101-f9ffda59d250'),
  sarahLogo: U('photo-1554519934-e32b1629d9ee', 400),
  nails1: U('photo-1604654894610-df63bc536371'),
  nails2: U('photo-1632345031435-8727f6897d53'),
  nails3: U('photo-1610992015732-2449b76344bc'),
  hair1: U('photo-1560066984-138dadb4c035'),
  hair2: U('photo-1522337660859-02fbefca4702'),
  amineCover: U('photo-1585747860715-2ba37e788b70'),
  amineLogo: U('photo-1633681926022-84c23e8cb2d6', 400),
  barber1: U('photo-1503951914875-452162b0f3f1'),
};

async function salon(pro, body, services, photos) {
  const s = await api('POST', '/pro/salon', pro.token, body);
  const created = [];
  for (const sv of services) {
    const r = await api('POST', '/pro/services', pro.token, {
      name: sv.name,
      durationMinutes: sv.min,
      priceDa: sv.price,
      categoryId: sv.cat ?? null,
      description: sv.desc,
      isActive: true,
    });
    created.push(r);
    if (sv.photos?.length) await api('PUT', `/pro/services/${r.id}/photos`, pro.token, { photos: sv.photos.map((url) => ({ url })) });
  }
  await api('PUT', '/pro/salon/hours', pro.token, {
    hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, opensAt: '09:00', closesAt: '19:00', isClosed: d === 5 })),
  });
  if (photos.length) await api('PUT', '/pro/salon/photos', pro.token, { photos: photos.map((url) => ({ url })) });
  await api('PATCH', '/pro/salon', pro.token, { isPublished: true, description: body.description });
  return { ...s, services: created };
}

const sarahPro = await user('sarah', 'pro', 'Sarah Benali');
const sarah = await salon(
  sarahPro,
  {
    name: 'Sarah Beauty Studio',
    wilayaCode: 16,
    city: 'Hydra',
    address: '14 rue des Frères Bouadou',
    phone: '05 55 88 22 11',
    genderTarget: 'women',
    categoryIds: ['coiffure-lissage', 'ongles', 'cils'],
    description: 'Salon calme, produits sans parabène. Sarah et son équipe reçoivent sur rendez-vous uniquement.',
    lat: 36.7455,
    lng: 3.0295,
    zone: 'Hydra',
    logoUrl: PHOTOS.sarahLogo,
  },
  [
    { name: 'Coupe femme', min: 45, price: 1800, cat: 'coiffure-lissage', photos: [PHOTOS.hair1, PHOTOS.hair2] },
    { name: 'Brushing', min: 30, price: 1200, cat: 'coiffure-lissage', photos: [PHOTOS.hair2] },
    {
      name: 'Pose gel',
      min: 75,
      price: 2500,
      cat: 'ongles',
      desc: 'Préparation, pose gel couleur et finition. Gel sans HEMA, tenue trois à quatre semaines.',
      photos: [PHOTOS.nails1, PHOTOS.nails2, PHOTOS.nails3],
    },
    { name: 'Manucure', min: 45, price: 1500, cat: 'manucure', photos: [PHOTOS.nails3] },
    { name: 'Soin visage', min: 60, price: 3000, cat: 'soins' },
    { name: 'Extensions cils', min: 90, price: 4000, cat: 'cils' },
    { name: 'Formule Éclat', min: 150, price: 4200, cat: 'coiffure-lissage', desc: 'Coupe + Brushing + Manucure', photos: [PHOTOS.nails2] },
  ],
  [PHOTOS.sarahCover, PHOTOS.nails1, PHOTOS.hair1],
);

const aminePro = await user('amine', 'pro', 'Amine Kaci');
const amine = await salon(
  aminePro,
  {
    name: 'Amine Barber',
    wilayaCode: 16,
    city: 'Alger-Centre',
    address: '3 rue Didouche Mourad',
    phone: '05 51 23 45 67',
    genderTarget: 'men',
    categoryIds: ['coiffure', 'soins-peau'],
    description: 'Barbier depuis 2012. Coupe, barbe, rasage à l’ancienne.',
    lat: 36.7728,
    lng: 3.0588,
    zone: 'Alger-Centre',
    logoUrl: PHOTOS.amineLogo,
  },
  [
    { name: 'Coupe', min: 30, price: 900, cat: 'coiffure', photos: [PHOTOS.barber1] },
    { name: 'Barbe', min: 20, price: 500, cat: 'coiffure' },
    { name: 'Rasage', min: 20, price: 700, cat: 'coiffure' },
    { name: 'Nettoyage de peau', min: 30, price: 1500, cat: 'soins-peau' },
  ],
  [PHOTOS.amineCover],
);

const client = await user('ines', 'client', 'Inès Rahmani');
await api('PATCH', '/me', client.token, { market: 'women', phone: '05 66 12 48 79' });

// Rendez-vous à J+2 10:00 (Pose gel + Manucure) chez Sarah, favoris sur les deux salons.
const d = new Date(Date.now() + 2 * 86_400_000);
const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(d);
const gel = sarah.services.find((s) => s.name === 'Pose gel');
const manu = sarah.services.find((s) => s.name === 'Manucure');
const booking = await api('POST', '/bookings', client.token, {
  salonId: sarah.id,
  serviceIds: [gel.id, manu.id],
  staffId: null,
  startsAt: `${dateKey}T10:00:00+01:00`,
  notes: 'Base fine, gel rose pâle si possible',
  clientName: 'Inès Rahmani',
  clientPhone: '05 66 12 48 79',
});
await api('PUT', `/me/favorites/${sarah.id}`, client.token);
await api('PUT', `/me/favorites/${amine.id}`, client.token);

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      userIds,
      sarah: { id: sarah.id, slug: sarah.slug, gel: gel.id },
      amine: { id: amine.id, slug: amine.slug },
      booking: { id: booking.id },
      client: client.session,
      sarahPro: sarahPro.session,
      aminePro: aminePro.session,
    },
    null,
    2,
  ),
);
console.log('demo ok', { sarah: sarah.slug, amine: amine.slug, booking: booking.id, date: dateKey, out: OUT });
