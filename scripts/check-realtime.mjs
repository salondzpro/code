/**
 * Vérifie EN PRODUCTION que le temps réel arrive bien au professionnel.
 *
 * Reproduit exactement le scénario qui échouait : le pro est « sur sa page d'accueil »
 * (socket Realtime abonné aux réservations de son salon), la cliente réserve, et l'on
 * attend l'événement sans jamais actualiser quoi que ce soit.
 *
 *   node --env-file=.env scripts/check-realtime.mjs
 *
 * Utilise les deux comptes de démonstration (numéro + code fixe) et annule le rendez-vous
 * créé à la fin, pour ne rien laisser derrière.
 */
import { createClient } from '@supabase/supabase-js';

// Valeurs recopiées volontairement : les paquets internes sont en TypeScript et ne
// s'importent pas depuis un script .mjs (même choix que scripts/seed-demo.mjs).
// Source : packages/constants/src/phone.ts (TEST_ACCOUNTS, TEST_LOGIN_CODE).
const DEMO_PRO_PHONE = '0603044619';
const DEMO_CLIENT_PHONE = '0603044618';
const DEMO_CODE = '1111';

const dateKeyDZ = (offsetDays = 0) => {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = fmt.format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const API = process.env.CHECK_API_URL ?? 'https://salondz-api.onrender.com';
const SUPABASE_URL = process.env.SUPABASE_URL;
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !PUBLISHABLE) throw new Error('SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY manquants');

const WAIT_MS = 25_000;

const call = async (method, path, token, body) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* pas du JSON */ }
  return { status: res.status, json, text };
};

const login = async (phone) => {
  const r = await call('POST', '/auth/dev-login', undefined, { phone, code: DEMO_CODE });
  const at = r.json?.accessToken ?? r.json?.access_token;
  if (!at) throw new Error(`connexion ${phone} refusée : ${r.status} ${r.text.slice(0, 200)}`);
  return at;
};

const pro = await login(DEMO_PRO_PHONE);
const client = await login(DEMO_CLIENT_PHONE);
console.log('sessions de démonstration obtenues');

const salonRes = await call('GET', '/pro/salon', pro);
const salon = salonRes.json?.salon;
if (!salon) throw new Error(`salon du pro introuvable : ${salonRes.status} ${salonRes.text.slice(0, 200)}`);
console.log('salon :', salon.name, salon.id);

// Le pro « ouvre son accueil » : socket Realtime authentifié, filtré sur son salon.
const asPro = createClient(SUPABASE_URL, PUBLISHABLE, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${pro}` } },
});
await asPro.realtime.setAuth(pro);

let received = null;
const gotEvent = new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), WAIT_MS);
  timer.unref?.();
  asPro
    .channel(`check-realtime:${salon.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings', filter: `salon_id=eq.${salon.id}` }, (payload) => {
      received = payload.new;
      clearTimeout(timer);
      resolve(payload.new);
    })
    .subscribe((status) => {
      console.log('canal pro :', status);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        resolve(null);
      }
    });
});

// Laisse le filtre s'enregistrer côté serveur avant l'écriture.
await new Promise((r) => setTimeout(r, 2500));

// La cliente cherche un créneau libre : fiche publique pour les prestations, puis disponibilités.
const publicRes = await call('GET', `/salons/${salon.slug}`);
const serviceId = publicRes.json?.services?.find((x) => x.isActive !== false)?.id;
if (!serviceId) throw new Error(`aucune prestation sur la fiche publique : ${publicRes.status} ${publicRes.text.slice(0, 300)}`);

let slotIso = null;
for (let day = 1; day <= 7 && !slotIso; day++) {
  const date = dateKeyDZ(day);
  const av = await call('GET', `/salons/${salon.id}/availability?serviceId=${serviceId}&date=${date}`);
  slotIso = av.json?.slots?.[0]?.startsAt ?? null;
  if (slotIso) console.log('créneau visé :', date, slotIso);
}
if (!slotIso) throw new Error('aucun créneau libre dans les sept prochains jours');

const booking = await call('POST', '/bookings', client, {
  salonId: salon.id,
  serviceId,
  startsAt: slotIso,
  notes: 'Vérification temps réel (script)',
});
if (booking.status !== 201) throw new Error(`réservation refusée : ${booking.status} ${booking.text.slice(0, 300)}`);
console.log('réservation créée :', booking.json.id);

const evt = await gotEvent;
const ok = !!evt && evt.id === booking.json.id;
console.log(ok ? '\nÉVÉNEMENT REÇU SANS ACTUALISER : le temps réel fonctionne.' : `\nAUCUN ÉVÉNEMENT en ${WAIT_MS / 1000} s : le temps réel ne parvient pas au pro.`);
if (evt && !ok) console.log('événement reçu pour une autre réservation :', received?.id);

// Nettoyage : on ne laisse pas de rendez-vous de test dans le salon de démonstration.
const undo = await call('POST', `/bookings/${booking.json.id}/cancel`, client, { reason: 'Vérification automatique' });
console.log('annulation du rendez-vous de test :', undo.status === 200 ? 'ok' : `échec (${undo.status}) ${undo.text.slice(0, 150)}`);

await asPro.removeAllChannels();
asPro.realtime.disconnect();
process.exit(ok ? 0 : 1);
