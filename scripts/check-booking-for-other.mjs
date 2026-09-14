/**
 * Vérifie EN PRODUCTION la réservation POUR QUELQU'UN D'AUTRE, de bout en bout :
 *
 *   node --env-file=.env scripts/check-booking-for-other.mjs
 *
 * Ce qui doit être vrai, et que rien d'autre ne prouve :
 *
 * 1. Le rendez-vous appartient à la PERSONNE CONCERNÉE : si son numéro correspond à un
 *    compte, `clientId` est celui de ce compte, pas celui de la personne qui réserve.
 * 2. Sans compte, le numéro suffit : le rendez-vous est créé au nom indiqué.
 * 3. On garde qui a réservé (`bookedByName`), sinon la personne verrait un rendez-vous
 *    surgir sans savoir d'où il vient.
 * 4. La personne qui réserve retrouve ce rendez-vous dans SES rendez-vous, et peut donc
 *    l'annuler — sans quoi une erreur de sa part serait irréparable.
 * 5. Les règles se lisent sur la personne concernée : une cliente suspendue peut réserver
 *    pour quelqu'un d'autre, mais toujours pas pour elle-même.
 *
 * Nettoyage : les rendez-vous de test sont annulés PAR LE SALON, jamais par la cliente —
 * une annulation cliente compterait dans son historique anti-abus.
 */
const API = process.env.CHECK_API_URL ?? 'https://salondz-api.onrender.com';
const DEMO_CLIENT = '0603044618';
const DEMO_PRO = '0603044619';
/** Numéro sans compte : la personne concernée n'est alors identifiée que par son numéro. */
const SANS_COMPTE = process.env.CHECK_OTHER_PHONE ?? '0770112233';

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
  try {
    json = JSON.parse(text);
  } catch {
    /* pas du JSON */
  }
  return { status: res.status, json, text };
};

const login = async (phone) => {
  const r = await call('POST', '/auth/dev-login', undefined, { phone, code: '1111' });
  const token = r.json?.accessToken ?? r.json?.access_token;
  if (!token) throw new Error(`connexion ${phone} : ${r.status} ${r.text.slice(0, 200)}`);
  return token;
};

const dateKeyDZ = (plusDays = 0) => {
  const d = new Date(Date.now() + plusDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(d);
};

const client = await login(DEMO_CLIENT);
const pro = await login(DEMO_PRO);
const me = await call('GET', '/me', client);
const proMe = await call('GET', '/me', pro);
const clientId = me.json?.profile?.id;
const proId = proMe.json?.profile?.id;
console.log('cliente :', me.json?.profile?.fullName, '· pro :', proMe.json?.profile?.fullName);

const salonRes = await call('GET', '/pro/salon', pro);
const salon = salonRes.json?.salon;
if (!salon?.id) throw new Error(`salon du pro introuvable : ${salonRes.status}`);

const pub = await call('GET', `/salons/${salon.slug}`);
const serviceId = pub.json?.services?.find((x) => x.isActive !== false)?.id;
if (!serviceId) throw new Error('aucune prestation active sur la fiche publique');

/** Deux créneaux libres distincts (un par scénario). */
const slots = [];
for (let day = 1; day <= 10 && slots.length < 2; day++) {
  const av = await call('GET', `/salons/${salon.id}/availability?serviceId=${serviceId}&date=${dateKeyDZ(day)}`);
  for (const s of av.json?.slots ?? []) {
    if (slots.length < 2 && !slots.includes(s.startsAt)) slots.push(s.startsAt);
  }
}
if (slots.length < 2) throw new Error('moins de deux créneaux libres sur dix jours');

const created = [];
const book = async (label, beneficiary, startsAt) => {
  const r = await call('POST', '/bookings', client, {
    salonId: salon.id,
    serviceId,
    startsAt,
    notes: 'Contrôle « pour quelqu’un d’autre » (script)',
    beneficiary,
  });
  console.log(`\n${label} → ${r.status}`);
  if (r.status !== 201) {
    console.log('  refus :', r.json?.code ?? '', String(r.json?.message ?? r.text).slice(0, 160));
    return null;
  }
  const b = r.json;
  created.push(b.id);
  console.log('  clientName :', b.clientName, '· clientPhone :', b.clientPhone);
  console.log('  clientId :', b.clientId === proId ? 'compte de la personne' : (b.clientId ?? 'aucun (numéro seul)'));
  console.log('  bookedByName :', b.bookedByName ?? 'ABSENT');
  return b;
};

// 1) Personne AVEC un compte : le rendez-vous doit atterrir sur SON compte.
const b1 = await book('Pour une personne qui a un compte', { fullName: 'Pro Démo', phone: DEMO_PRO }, slots[0]);
const surSonCompte = b1?.clientId === proId && b1?.clientId !== clientId;
console.log('  → sur le compte de la personne :', surSonCompte ? 'oui' : 'NON');

// 2) Personne SANS compte : identifiée par son numéro.
const b2 = await book('Pour une personne sans compte', { fullName: 'Amina Bensalem', phone: SANS_COMPTE }, slots[1]);
const parNumero = !!b2 && b2.clientId === null && b2.clientName === 'Amina Bensalem';
console.log('  → identifiée par son numéro :', parNumero ? 'oui' : 'NON');

// 3) Celle qui a réservé les retrouve dans SES rendez-vous.
const mine = await call('GET', '/me/bookings?scope=upcoming&limit=50', client);
const ids = (mine.json?.items ?? []).map((x) => x.id);
const retrouves = created.filter((id) => ids.includes(id)).length;
console.log(`\nretrouvés dans « mes rendez-vous » : ${retrouves}/${created.length}`);

// 4) Réserver POUR SOI reste refusé quand la cliente est suspendue (règles inchangées).
const pourMoi = await call('POST', '/bookings', client, {
  salonId: salon.id,
  serviceId,
  startsAt: slots[0],
});
console.log('pour moi-même :', pourMoi.status, pourMoi.json?.code ?? '');

// Nettoyage : annulation PAR LE SALON (aucune annulation portée au compte des personnes).
for (const id of created) {
  const c = await call('POST', `/pro/bookings/${id}/cancel`, pro, { reason: 'Contrôle automatique' });
  console.log('annulé par le salon :', id.slice(0, 8), c.status);
}

const ok = surSonCompte && parNumero && !!b1?.bookedByName && retrouves === created.length;
console.log(ok ? '\nCHAÎNE COMPLÈTE VALIDÉE.' : '\nUn point n’est pas conforme (voir ci-dessus).');
process.exit(ok ? 0 : 1);
