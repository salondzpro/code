/** Attend qu'un build arrive chez Apple et finisse d'etre traite. Lecture seule. */
import { asc } from './asc-lib.mjs';
const APP = '6817317513';
const FIN = Date.now() + 45 * 60_000;
let vu = null;
while (Date.now() < FIN) {
  const r = await asc('GET', `/v1/builds?filter[app]=${APP}&limit=5&sort=-uploadedDate`);
  const b = (r.json?.data ?? [])[0];
  const etat = b ? `${b.attributes.version} ${b.attributes.processingState}` : 'aucun build';
  if (etat !== vu) { console.log(new Date().toISOString().slice(11, 19), etat); vu = etat; }
  if (b?.attributes?.processingState === 'VALID') { console.log('PRET', b.id, b.attributes.version); process.exit(0); }
  if (b?.attributes?.processingState === 'FAILED' || b?.attributes?.processingState === 'INVALID') {
    console.log('ECHEC du traitement Apple'); process.exit(1);
  }
  await new Promise((f) => setTimeout(f, 60_000));
}
console.log('toujours aucun build apres 45 min');
process.exit(2);
