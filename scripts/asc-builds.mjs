/** Les builds arrives chez Apple pour Salon DZ, et l'etat de la version. Lecture seule. */
import { asc } from './asc-lib.mjs';
const APP = '6817317513';
const r = await asc('GET', `/v1/builds?filter[app]=${APP}&limit=10&sort=-uploadedDate`);
const builds = r.json?.data ?? [];
console.log(`builds recus : ${builds.length}`);
for (const b of builds) {
  const a = b.attributes;
  console.log(` ${a.version}  ${a.processingState}  ${a.uploadedDate}  expire: ${a.expired}`);
}
const v = (await asc('GET', `/v1/apps/${APP}/appStoreVersions?limit=1`)).json?.data?.[0];
console.log(`version ${v.attributes.versionString} : ${v.attributes.appStoreState}`);
