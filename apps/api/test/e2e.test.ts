/**
 * Test de bout en bout contre le VRAI projet Supabase (utilise SUPABASE_SECRET_KEY).
 * Crée des utilisateurs jetables, déroule le parcours pro + client, vérifie
 * l'atomicité des réservations concurrentes, puis nettoie tout.
 *
 *   pnpm --filter @salondz/api test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { addDaysToKey, localDateTimeToISO, toLocalDateKey } from '@salondz/constants';
import { buildApp, type App } from '../src/app';
import { config } from '../src/config';
import { db } from '../src/lib/supabase';

const RUN = Date.now().toString(36);
const PASSWORD = `Test-${RUN}-Aa1!`;

interface TestUser {
  id: string;
  email: string;
  token: string;
}

async function createUser(label: string, role: 'client' | 'pro', fullName: string): Promise<TestUser> {
  const email = `e2e-${label}-${RUN}@salondz.test`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  });
  if (error) throw error;
  const res = await fetch(`${config.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string; msg?: string };
  if (!json.access_token) throw new Error(`login failed: ${JSON.stringify(json)}`);
  return { id: data.user.id, email, token: json.access_token };
}

let app: App;
let pro: TestUser;
let clientA: TestUser;
let clientB: TestUser;
let salonId = '';
let salonSlug = '';
let serviceId = '';
let staffId = '';
const dateKey = addDaysToKey(toLocalDateKey(), 3);
const slotIso = localDateTimeToISO(dateKey, '10:00');

const call = (method: string, url: string, token?: string, body?: unknown) =>
  app.inject({
    method: method as 'GET',
    url,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    payload: body === undefined ? undefined : JSON.stringify(body),
  });

before(async () => {
  app = await buildApp();
  [pro, clientA, clientB] = await Promise.all([
    createUser('pro', 'pro', 'Karim Barber'),
    createUser('clienta', 'client', 'Amine Test'),
    createUser('clientb', 'client', 'Yasmine Test'),
  ]);
});

after(async () => {
  await app?.close();
  for (const u of [pro, clientA, clientB]) {
    if (u?.id) await db.auth.admin.deleteUser(u.id);
  }
});

test('health', async () => {
  const r = await call('GET', '/health');
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().ok, true);
});

test('JWT ES256 accepté : GET /v1/me renvoie le profil créé par trigger', async () => {
  const r = await call('GET', '/v1/me', pro.token);
  assert.equal(r.statusCode, 200, r.body);
  const body = r.json();
  assert.equal(body.profile.id, pro.id);
  assert.equal(body.profile.role, 'pro');
  assert.equal(body.profile.fullName, 'Karim Barber');
  assert.equal(body.salon, null);
});

test('sans token → 401', async () => {
  const r = await call('GET', '/v1/me');
  assert.equal(r.statusCode, 401);
  assert.equal(r.json().error.code, 'UNAUTHORIZED');
});

test('pro : création du salon (slug auto, staff par défaut, horaires par défaut)', async () => {
  const r = await call('POST', '/v1/pro/salon', pro.token, {
    name: `Barber Élégance ${RUN}`,
    wilayaCode: 16,
    city: 'Alger Centre',
    address: '12 rue Didouche Mourad',
    phone: '05 51 23 45 67',
    genderTarget: 'men',
    categoryIds: ['barbier', 'coiffure-homme'],
  });
  assert.equal(r.statusCode, 201, r.body);
  const s = r.json();
  salonId = s.id;
  salonSlug = s.slug;
  assert.match(s.slug, /^barber-elegance-/);
  assert.equal(s.phone, '+213551234567');
  assert.deepEqual(s.categoryIds, ['barbier', 'coiffure-homme']);
  assert.equal(s.staff.length, 1);
  assert.equal(s.staff[0].displayName, 'Karim Barber');
  staffId = s.staff[0].id;
  assert.equal(s.openingHours.length, 7);
  assert.equal(s.isPublished, false);
});

test('pro : impossible de publier sans service', async () => {
  const r = await call('PATCH', '/v1/pro/salon', pro.token, { isPublished: true });
  assert.equal(r.statusCode, 400);
  assert.equal(r.json().error.code, 'CANNOT_PUBLISH');
});

test('pro : ajout service + horaires 7j/7 + publication', async () => {
  const svc = await call('POST', '/v1/pro/services', pro.token, { name: 'Coupe + barbe', durationMinutes: 30, priceDa: 800 });
  assert.equal(svc.statusCode, 201, svc.body);
  serviceId = svc.json().id;

  const hours = await call('PUT', '/v1/pro/salon/hours', pro.token, {
    hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, opensAt: '09:00', closesAt: '19:00', isClosed: false })),
  });
  assert.equal(hours.statusCode, 200, hours.body);

  const pub = await call('PATCH', '/v1/pro/salon', pro.token, { isPublished: true, slotIntervalMinutes: 30 });
  assert.equal(pub.statusCode, 200, pub.body);
  assert.equal(pub.json().isPublished, true);
});

test('public : recherche (wilaya + catégorie + texte accentué)', async () => {
  const r = await call('GET', `/v1/salons?wilaya=16&category=barbier&q=elegance`);
  assert.equal(r.statusCode, 200, r.body);
  const items = r.json().items as { id: string; minPriceDa: number }[];
  const mine = items.find((s) => s.id === salonId);
  assert.ok(mine, 'salon publié doit apparaître');
  assert.equal(mine.minPriceDa, 800);
});

test('public : page salon par slug (une requête, services/staff actifs)', async () => {
  const r = await call('GET', `/v1/salons/${salonSlug}`);
  assert.equal(r.statusCode, 200, r.body);
  const s = r.json();
  assert.equal(s.services.length, 1);
  assert.equal(s.staff.length, 1);
  assert.equal(s.openingHours[0].opensAt, '09:00');
  assert.match(r.headers['cache-control'] as string, /public/);
});

test('public : disponibilités du jour J+3 (créneaux de 30 min, 09:00 → 18:30)', async () => {
  const r = await call('GET', `/v1/salons/${salonId}/availability?serviceId=${serviceId}&date=${dateKey}`);
  assert.equal(r.statusCode, 200, r.body);
  const a = r.json();
  assert.equal(a.slots.length, 20);
  assert.equal(a.slots[0].startsAt, new Date(localDateTimeToISO(dateKey, '09:00')).toISOString());
  assert.equal(a.slots.at(-1).startsAt, new Date(localDateTimeToISO(dateKey, '18:30')).toISOString());
  assert.deepEqual(a.slots[0].staffIds, [staffId]);
});

test('client : réservation hors horaires refusée', async () => {
  const r = await call('POST', '/v1/bookings', clientA.token, { salonId, serviceId, startsAt: localDateTimeToISO(dateKey, '20:00') });
  assert.equal(r.statusCode, 400, r.body);
  assert.equal(r.json().error.code, 'OUTSIDE_OPENING_HOURS');
});

test('client : réservation dans le passé refusée', async () => {
  const r = await call('POST', '/v1/bookings', clientA.token, { salonId, serviceId, startsAt: '2020-01-01T10:00:00+01:00' });
  assert.equal(r.statusCode, 400, r.body);
  assert.ok(['IN_PAST', 'TOO_SOON'].includes(r.json().error.code), r.body);
});

test('COURSE : 2 clients, même créneau, en parallèle → exactement 1 succès', async () => {
  const [ra, rb] = await Promise.all([
    call('POST', '/v1/bookings', clientA.token, { salonId, serviceId, startsAt: slotIso, notes: 'A' }),
    call('POST', '/v1/bookings', clientB.token, { salonId, serviceId, startsAt: slotIso, notes: 'B' }),
  ]);
  const codes = [ra.statusCode, rb.statusCode].sort();
  assert.deepEqual(codes, [201, 409], `A=${ra.body} B=${rb.body}`);
  const loser = ra.statusCode === 409 ? ra : rb;
  assert.equal(loser.json().error.code, 'SLOT_TAKEN');
  const winner = ra.statusCode === 201 ? ra : rb;
  const b = winner.json();
  assert.equal(b.status, 'confirmed');
  assert.equal(b.priceDa, 800);
  assert.equal(b.salon.slug, salonSlug);
  assert.equal(b.staff.id, staffId);
});

test('créneau pris disparaît des disponibilités', async () => {
  const r = await call('GET', `/v1/salons/${salonId}/availability?serviceId=${serviceId}&date=${dateKey}`);
  const starts = (r.json().slots as { startsAt: string }[]).map((s) => s.startsAt);
  assert.ok(!starts.includes(new Date(slotIso).toISOString()));
  assert.equal(starts.length, 19);
});

test('pro : walk-in chevauchant (10:15) refusé, 10:30 accepté', async () => {
  const bad = await call('POST', '/v1/pro/bookings', pro.token, {
    serviceId,
    staffId,
    startsAt: localDateTimeToISO(dateKey, '10:15'),
    clientName: 'Client de passage',
  });
  assert.equal(bad.statusCode, 409, bad.body);
  assert.equal(bad.json().error.code, 'SLOT_TAKEN');

  const ok = await call('POST', '/v1/pro/bookings', pro.token, {
    serviceId,
    staffId,
    startsAt: localDateTimeToISO(dateKey, '10:30'),
    clientName: 'Client de passage',
    clientPhone: '0661234567',
  });
  assert.equal(ok.statusCode, 201, ok.body);
  assert.equal(ok.json().source, 'walk_in');
  assert.equal(ok.json().clientPhone, '+213661234567');
});

test('pro : agenda du jour + stats + notifications côté pro', async () => {
  const r = await call('GET', `/v1/pro/bookings?from=${dateKey}&to=${dateKey}`, pro.token);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().items.length, 2);

  const stats = await call('GET', '/v1/pro/stats', pro.token);
  assert.equal(stats.statusCode, 200, stats.body);

  const notifs = await call('GET', '/v1/me/notifications', pro.token);
  assert.equal(notifs.statusCode, 200, notifs.body);
  assert.ok(notifs.json().items.some((n: { type: string }) => n.type === 'booking_created'));
});

test('client : mes réservations à venir, déplacement, annulation', async () => {
  const winnerToken = (await call('GET', '/v1/me/bookings?scope=upcoming', clientA.token)).json().items.length ? clientA.token : clientB.token;
  const mine = await call('GET', '/v1/me/bookings?scope=upcoming', winnerToken);
  assert.equal(mine.statusCode, 200, mine.body);
  assert.equal(mine.json().items.length, 1);
  const id = mine.json().items[0].id as string;

  const moved = await call('POST', `/v1/bookings/${id}/reschedule`, winnerToken, { startsAt: localDateTimeToISO(dateKey, '14:00') });
  assert.equal(moved.statusCode, 200, moved.body);
  assert.equal(new Date(moved.json().startsAt).toISOString(), new Date(localDateTimeToISO(dateKey, '14:00')).toISOString());

  const otherToken = winnerToken === clientA.token ? clientB.token : clientA.token;
  const forbidden = await call('POST', `/v1/bookings/${id}/cancel`, otherToken, {});
  assert.equal(forbidden.statusCode, 404);

  const cancelled = await call('POST', `/v1/bookings/${id}/cancel`, winnerToken, { reason: 'Empêchement' });
  assert.equal(cancelled.statusCode, 200, cancelled.body);
  assert.equal(cancelled.json().status, 'cancelled');
  assert.equal(cancelled.json().cancelledBy, 'client');

  const again = await call('POST', `/v1/bookings/${id}/cancel`, winnerToken, {});
  assert.equal(again.statusCode, 409);
});

test('salon dépublié → page publique 404 pour un anonyme, visible pour le propriétaire', async () => {
  await call('PATCH', '/v1/pro/salon', pro.token, { isPublished: false });
  const anon = await call('GET', `/v1/salons/${salonSlug}`);
  assert.equal(anon.statusCode, 404);
  const owner = await call('GET', `/v1/salons/${salonSlug}`, pro.token);
  assert.equal(owner.statusCode, 200);
});

test('cron interne : jeton requis', async () => {
  const no = await call('POST', '/internal/cron/tick');
  assert.equal(no.statusCode, 401);
  const ok = await call('POST', '/internal/cron/tick', config.INTERNAL_CRON_TOKEN);
  assert.equal(ok.statusCode, 200, ok.body);
  assert.ok('reminders' in ok.json());
});
