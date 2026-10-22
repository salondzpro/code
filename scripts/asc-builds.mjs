/** Les builds reçus par Apple pour Salon DZ, et l'état de la version. Lecture seule. */
import { asc } from './asc-lib.mjs';

/**
 * Deux applications, une fiche chacune : `--pro` vise « Salon DZ Pro » (id 6821947874, bundle
 * pro.salondz.app, créée par le propriétaire le 12 oct. 2026), sinon « Salon DZ » (6817317513).
 */
const PRO = process.argv.includes('--pro');
const APP = PRO ? '6821947874' : '6817317513';

const rep = (await asc('GET', `/v1/builds?filter[app]=${APP}&limit=10&sort=-uploadedDate&include=preReleaseVersion`)).json;
const builds = rep?.data ?? [];
const numeros = new Map((rep?.included ?? []).map((x) => [x.id, x.attributes?.version]));
console.log(`builds reçus : ${builds.length}`);
for (const b of builds) {
  const a = b.attributes;
  const v = numeros.get(b.relationships?.preReleaseVersion?.data?.id) ?? '?';
  console.log(` ${v} (${a.version})  ${a.processingState}  ${a.uploadedDate}  expiré: ${a.expired}`);
}

// Apple rend parfois une réponse vide sur une lecture parfaitement valable. On le dit plutôt que
// de s'arrêter sur un accès à `undefined` — le script sert à RENSEIGNER, pas à planter.
const vs = (await asc('GET', `/v1/apps/${APP}/appStoreVersions?limit=5`)).json?.data?.filter((x) => x.attributes.platform === 'IOS') ?? [];
if (!vs.length) console.log('version : lecture indisponible, réessayer');
for (const v of vs) console.log(`version ${v.attributes.versionString} : ${v.attributes.appStoreState}`);
