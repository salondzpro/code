/** Capacites de l App ID et profils disponibles : la signature echoue si le profil n autorise pas
 *  ce que les habilitations reclament (ici les notifications). Lecture seule. */
import { asc } from './asc-lib.mjs';
const BUNDLE = 'dz.salondz.app';
const ids = (await asc('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE}&include=bundleIdCapabilities`)).json;
const id = ids?.data?.[0];
if (!id) { console.log('App ID introuvable'); process.exit(1); }
console.log(`App ID ${id.attributes.identifier} (${id.id})`);
const caps = (ids.included ?? []).map((c) => c.attributes.capabilityType);
console.log('capacites :', caps.join(', ') || 'aucune');
console.log('  notifications :', caps.includes('PUSH_NOTIFICATIONS') ? 'ACTIVEES' : 'MANQUANTES → la signature echouera');
const profs = (await asc('GET', '/v1/profiles?limit=20&include=bundleId')).json?.data ?? [];
for (const p of profs) {
  const a = p.attributes;
  console.log(` profil ${a.name} · ${a.profileType} · ${a.profileState} · expire ${a.expirationDate?.slice(0,10)}`);
}
