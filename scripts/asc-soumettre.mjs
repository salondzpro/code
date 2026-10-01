/**
 * Rattache le dernier build à la version 1.0 et l'envoie en REVUE chez Apple.
 *
 *   node scripts/asc-soumettre.mjs --verifier   → dit ce qui manque, sans rien envoyer
 *   node scripts/asc-soumettre.mjs              → rattache le build et soumet
 *
 * L'envoi en revue se fait en trois temps chez Apple, et non par un simple bouton :
 *   1. la version doit pointer vers un build TRAITÉ (`VALID`) — un build encore en cours est refusé ;
 *   2. on ouvre une « soumission de revue » pour l'application ;
 *   3. on y place la version, puis on ferme la soumission — c'est cette fermeture qui l'envoie.
 *
 * Une soumission déjà ouverte est réutilisée : en rouvrir une seconde fait échouer la première.
 */
import { asc } from './asc-lib.mjs';

const APP = '6817317513';
const VERIFIER = process.argv.includes('--verifier');

const lire = async (p) => (await asc('GET', p)).json?.data ?? null;
/**
 * Le message d'Apple sur un refus de mise en revue est volontairement vague : « cette ressource ne
 * peut pas être relue, voyez les erreurs associées ». Les VRAIES raisons sont enfouies dans
 * `meta.associatedErrors`, et sans elles on cherche à l'aveugle — c'est ainsi qu'on a soupçonné
 * les étiquettes de confidentialité pendant deux jours alors qu'il manquait une tout autre
 * déclaration. On les déplie donc systématiquement.
 */
const detail = (r) => {
  const erreurs = r.json?.errors ?? [];
  const lignes = [];
  for (const e of erreurs) {
    lignes.push(`${e.title} — ${e.detail || ''}`);
    for (const [ou, liste] of Object.entries(e.meta?.associatedErrors ?? {})) {
      for (const a of liste) {
        lignes.push(`  ↳ ${a.code}`, `     ${a.title} : ${a.detail}`, `     (${ou})`);
      }
    }
  }
  return lignes.join('\n  ') || JSON.stringify(r.json);
};

// ---------------------------------------------------------------------------------------------
// 1. Le build
// ---------------------------------------------------------------------------------------------
const builds = (await lire(`/v1/builds?filter[app]=${APP}&limit=10&sort=-uploadedDate`)) ?? [];
if (!builds.length) {
  console.log('✖ aucun build reçu par Apple — lancer la compilation avant de soumettre');
  process.exit(2);
}
for (const b of builds.slice(0, 3)) {
  console.log(`  build ${b.attributes.version} · ${b.attributes.processingState} · ${b.attributes.uploadedDate}`);
}
const build = builds.find((b) => b.attributes.processingState === 'VALID');
if (!build) {
  console.log('✖ aucun build TRAITÉ : Apple met quelques minutes après l’envoi. Réessayer plus tard.');
  process.exit(2);
}

// ---------------------------------------------------------------------------------------------
// 2. La version
// ---------------------------------------------------------------------------------------------
const versions = await lire(`/v1/apps/${APP}/appStoreVersions?limit=5`);
const version = versions.find((v) => v.attributes.platform === 'IOS');
console.log(`  version ${version.attributes.versionString} · ${version.attributes.appStoreState}`);

if (VERIFIER) {
  const rattache = await lire(`/v1/appStoreVersions/${version.id}/build`);
  console.log(`  build rattaché : ${rattache ? rattache.id : '— aucun —'}`);
  console.log(`\nPrêt à soumettre : build ${build.attributes.version} disponible.`);
  process.exit(0);
}

const lien = await asc('PATCH', `/v1/appStoreVersions/${version.id}`, {
  data: {
    type: 'appStoreVersions',
    id: version.id,
    relationships: { build: { data: { type: 'builds', id: build.id } } },
  },
});
if (lien.status >= 300) {
  console.log('✖ rattachement du build :', lien.status, detail(lien));
  process.exit(1);
}
console.log(`✔ build ${build.attributes.version} rattaché à la version ${version.attributes.versionString}`);

// ---------------------------------------------------------------------------------------------
// 3. La soumission de revue
// ---------------------------------------------------------------------------------------------
const ouvertes = (await lire(`/v1/reviewSubmissions?filter[app]=${APP}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW&limit=5`)) ?? [];
let soumission = ouvertes[0];
if (soumission) {
  console.log(`· soumission déjà ouverte (${soumission.attributes.state}), on la réutilise`);
} else {
  const r = await asc('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: APP } } },
    },
  });
  if (r.status >= 300) {
    console.log('✖ ouverture de la soumission :', r.status, detail(r));
    process.exit(1);
  }
  soumission = r.json.data;
  console.log('✔ soumission de revue ouverte');
}

const items = (await lire(`/v1/reviewSubmissions/${soumission.id}/items`)) ?? [];
if (!items.length) {
  const r = await asc('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: soumission.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
      },
    },
  });
  if (r.status >= 300) {
    console.log('✖ ajout de la version à la soumission :', r.status, detail(r));
    process.exit(1);
  }
  console.log('✔ version ajoutée à la soumission');
}

const envoi = await asc('PATCH', `/v1/reviewSubmissions/${soumission.id}`, {
  data: { type: 'reviewSubmissions', id: soumission.id, attributes: { submitted: true } },
});
if (envoi.status >= 300) {
  console.log('✖ envoi en revue :', envoi.status, detail(envoi));
  process.exit(1);
}
console.log(`\n✔ Salon DZ ${version.attributes.versionString} est EN REVUE chez Apple (état : ${envoi.json?.data?.attributes?.state}).`);
