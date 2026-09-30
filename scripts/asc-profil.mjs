/**
 * Le profil de signature iOS de Salon DZ : l'inspecter, et le SUPPRIMER pour qu'il soit recréé.
 *
 *   node scripts/asc-profil.mjs             → montre le profil et ses capacités
 *   node scripts/asc-profil.mjs --refaire   → le supprime ; Codemagic en recrée un au prochain build
 *
 * POURQUOI : un profil de provisionnement FIGE les capacités de l'App ID au moment de sa création.
 * Celui-ci est né le 23 sept. 2026, avant que l'application ne réclame l'habilitation
 * `aps-environment` — d'où « requires a provisioning profile with the Push Notifications feature »
 * à la compilation. Le supprimer suffit : `app-store-connect fetch-signing-files --create` en
 * fabrique un neuf, qui reprend TOUTES les capacités actuelles de l'App ID.
 *
 * Ce script ne touche QUE les profils. Les CERTIFICATS ne sont jamais révoqués : le compte en a
 * trois, le maximum autorisé par Apple, et deux servent à d'autres applications.
 */
import { asc } from './asc-lib.mjs';

const BUNDLE = 'dz.salondz.app';
const REFAIRE = process.argv.includes('--refaire');

const idr = await asc('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE}&include=bundleIdCapabilities`);
const appId = idr.json?.data?.[0];
const caps = (idr.json?.included ?? []).map((c) => c.attributes.capabilityType);
console.log(`App ID ${BUNDLE} · capacités : ${caps.join(', ')}`);
if (!caps.includes('PUSH_NOTIFICATIONS')) {
  console.log('✖ les notifications ne sont PAS activées sur l’App ID : les activer avant de refaire le profil');
  process.exit(1);
}

const profils = (await asc('GET', '/v1/profiles?limit=50&include=bundleId')).json;
const miens = (profils?.data ?? []).filter((p) => {
  const bid = profils.included?.find((i) => i.type === 'bundleIds' && i.id === p.relationships?.bundleId?.data?.id);
  return bid?.attributes?.identifier === BUNDLE;
});
if (!miens.length) {
  console.log('aucun profil pour cette application — Codemagic en créera un tout seul');
  process.exit(0);
}
for (const p of miens) {
  const a = p.attributes;
  console.log(` profil « ${a.name} » (${p.id}) · ${a.profileType} · ${a.profileState} · créé ${a.createdDate?.slice(0, 10)}`);
}

if (!REFAIRE) {
  console.log('\n(--refaire pour les supprimer et laisser Codemagic en recréer)');
  process.exit(0);
}
for (const p of miens) {
  const r = await asc('DELETE', `/v1/profiles/${p.id}`);
  console.log(r.status < 300 ? `✔ profil « ${p.attributes.name} » supprimé` : `✖ ${r.status} ${JSON.stringify(r.json)}`);
}
console.log('\nProchain build : fetch-signing-files --create fabriquera un profil avec les notifications.');
