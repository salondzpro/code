/**
 * Envoie les visuels de présentation sur la fiche App Store (iPhone 6,7 pouces).
 *
 *   node scripts/asc-captures.mjs              → remplace la série existante
 *   node scripts/asc-captures.mjs --lire       → montre seulement ce qui est en ligne
 *
 * Apple n'accepte pas un simple POST de fichier : une capture s'envoie en QUATRE temps.
 *   1. on déclare le fichier (nom et taille) et Apple répond par des « opérations d'envoi » ;
 *   2. on pousse les octets à l'adresse indiquée, morceau par morceau si elle en demande plusieurs ;
 *   3. on confirme avec l'empreinte MD5 du fichier, qu'Apple recalcule de son côté ;
 *   4. Apple passe la capture de `AWAITING_UPLOAD` à `COMPLETE` (asynchrone : on attend).
 * Sauter l'étape 3 laisse une capture fantôme qui bloque l'envoi en revue sans rien afficher.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { asc } from './asc-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = path.join(ROOT, 'apps', 'web', 'ios', 'store', 'presentation-6-7');
const APP = '6817317513';
const TYPE = 'APP_IPHONE_67'; // 1290 × 2796 ; la seule série obligatoire depuis qu'Apple a simplifié
const LIRE = process.argv.includes('--lire');

const lire = async (p) => (await asc('GET', p)).json?.data ?? null;
const echec = (label, r) => {
  const d = r.json?.errors?.map((e) => `${e.title} — ${e.detail || ''}`).join(' | ') || JSON.stringify(r.json);
  throw new Error(`${label} : ${r.status} ${d}`);
};

// ---------------------------------------------------------------------------------------------
// La série de captures, rattachée à la version française
// ---------------------------------------------------------------------------------------------
const versions = await lire(`/v1/apps/${APP}/appStoreVersions?limit=5`);
const VER = versions.find((v) => v.attributes.platform === 'IOS').id;
const locs = await lire(`/v1/appStoreVersions/${VER}/appStoreVersionLocalizations`);
const LOC = locs.find((l) => l.attributes.locale === 'fr-FR').id;

let series = (await lire(`/v1/appStoreVersionLocalizations/${LOC}/appScreenshotSets`)) ?? [];
let serie = series.find((s) => s.attributes.screenshotDisplayType === TYPE);

if (LIRE) {
  console.log('séries en ligne :', series.map((s) => s.attributes.screenshotDisplayType).join(', ') || 'aucune');
  if (serie) {
    const shots = (await lire(`/v1/appScreenshotSets/${serie.id}/appScreenshots`)) ?? [];
    for (const s of shots) console.log(' ', s.attributes.fileName, s.attributes.assetDeliveryState?.state);
  }
  process.exit(0);
}

if (!serie) {
  const r = await asc('POST', '/v1/appScreenshotSets', {
    data: {
      type: 'appScreenshotSets',
      attributes: { screenshotDisplayType: TYPE },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: LOC } } },
    },
  });
  if (r.status >= 300) echec('création de la série', r);
  serie = r.json.data;
  console.log('✔ série', TYPE, 'créée');
} else {
  // On repart d'une série vide : sinon les nouveaux visuels s'AJOUTENT aux anciens et la fiche
  // montre deux générations mélangées.
  const anciennes = (await lire(`/v1/appScreenshotSets/${serie.id}/appScreenshots`)) ?? [];
  for (const a of anciennes) await asc('DELETE', `/v1/appScreenshots/${a.id}`);
  if (anciennes.length) console.log(`· ${anciennes.length} ancienne(s) capture(s) retirée(s)`);
}

// ---------------------------------------------------------------------------------------------
// Envoi, dans l'ordre des noms de fichier : c'est l'ordre d'affichage sur la fiche.
// ---------------------------------------------------------------------------------------------
const fichiers = fs.readdirSync(DOSSIER).filter((f) => f.endsWith('.png')).sort();
if (!fichiers.length) throw new Error(`aucun visuel dans ${DOSSIER}`);

const envoyees = [];
for (const nom of fichiers) {
  const chemin = path.join(DOSSIER, nom);
  const octets = fs.readFileSync(chemin);

  const r = await asc('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileSize: octets.length, fileName: nom },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: serie.id } } },
    },
  });
  if (r.status >= 300) echec(`déclaration de ${nom}`, r);
  const shot = r.json.data;

  for (const op of shot.attributes.uploadOperations ?? []) {
    const morceau = octets.subarray(op.offset, op.offset + op.length);
    const entetes = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    const rep = await fetch(op.url, { method: op.method, headers: entetes, body: morceau });
    if (!rep.ok) throw new Error(`envoi de ${nom} : ${rep.status} ${await rep.text()}`);
  }

  // L'empreinte est la preuve que le fichier est arrivé entier : Apple la recalcule et refuse si
  // elle diffère. MD5 n'est pas un choix de sécurité, c'est ce que l'API impose.
  const empreinte = crypto.createHash('md5').update(octets).digest('hex');
  const fin = await asc('PATCH', `/v1/appScreenshots/${shot.id}`, {
    data: { type: 'appScreenshots', id: shot.id, attributes: { uploaded: true, sourceFileChecksum: empreinte } },
  });
  if (fin.status >= 300) echec(`confirmation de ${nom}`, fin);

  envoyees.push({ nom, id: shot.id });
  console.log('✔', nom, Math.round(octets.length / 1024) + ' Ko');
}

// ---------------------------------------------------------------------------------------------
// Apple traite les images en arrière-plan : tant qu'une capture n'est pas `COMPLETE`, elle peut
// encore être refusée (mauvaise taille, transparence). On attend le verdict plutôt que de dire
// « c'est envoyé » sans savoir.
// ---------------------------------------------------------------------------------------------
console.log('\nTraitement par Apple…');
for (let essai = 0; essai < 20; essai++) {
  await new Promise((r) => setTimeout(r, 4000));
  const etats = [];
  for (const e of envoyees) {
    const d = await lire(`/v1/appScreenshots/${e.id}`);
    etats.push({ nom: e.nom, etat: d?.attributes?.assetDeliveryState?.state, erreurs: d?.attributes?.assetDeliveryState?.errors });
  }
  if (etats.every((e) => e.etat === 'COMPLETE')) {
    console.log(`✔ ${etats.length} visuels en ligne sur la fiche App Store (${TYPE})`);
    process.exit(0);
  }
  const rates = etats.filter((e) => e.etat === 'FAILED');
  if (rates.length) {
    for (const r of rates) console.log('✖', r.nom, JSON.stringify(r.erreurs));
    process.exit(1);
  }
}
console.log('! toujours en traitement après 80 s — relancer avec --lire pour voir où ça en est');
