/** Les builds reçus par Apple pour Salon DZ, et l'état de la version. Lecture seule. */
import { asc } from './asc-lib.mjs';

/**
 * Deux applications, une fiche chacune : `--pro` vise « Salon DZ Pro » (id 6821947874, bundle
 * pro.salondz.app, créée par le propriétaire le 12 oct. 2026), sinon « Salon DZ » (6817317513).
 */
const PRO = process.argv.includes('--pro');
const APP = PRO ? '6821947874' : '6817317513';

const builds = (await asc('GET', `/v1/builds?filter[app]=${APP}&limit=10&sort=-uploadedDate`)).json?.data ?? [];
console.log(`builds reçus : ${builds.length}`);
for (const b of builds) {
  const a = b.attributes;
  console.log(` ${a.version}  ${a.processingState}  ${a.uploadedDate}  expiré: ${a.expired}`);
}

// Apple rend parfois une réponse vide sur une lecture parfaitement valable. On le dit plutôt que
// de s'arrêter sur un accès à `undefined` — le script sert à RENSEIGNER, pas à planter.
const v = (await asc('GET', `/v1/apps/${APP}/appStoreVersions?limit=5`)).json?.data?.find((x) => x.attributes.platform === 'IOS');
console.log(v ? `version ${v.attributes.versionString} : ${v.attributes.appStoreState}` : 'version : lecture indisponible, réessayer');
