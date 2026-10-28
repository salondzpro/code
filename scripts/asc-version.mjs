/**
 * Crée la version SUIVANTE d'une fiche App Store (mise à jour) et remplit ses « Nouveautés ».
 *
 *   node scripts/asc-version.mjs 1.0.1            → « Salon DZ »
 *   node scripts/asc-version.mjs 1.0.1 --pro      → « Salon DZ Pro »
 *
 * Pourquoi un script : une mise à jour exige un texte « Nouveautés » dans CHAQUE langue de la fiche,
 * sans quoi la soumission est refusée — et Apple ne le recopie pas de la version précédente
 * (description, mots-clés et visuels, eux, sont repris). Publication automatique dès l'accord
 * d'Apple (`AFTER_APPROVAL`), comme la 1.0.
 *
 * Le numéro doit être celui du projet Xcode (`MARKETING_VERSION` dans `project.pbxproj`) : Apple
 * range chaque build sous ce numéro, et `asc-soumettre.mjs` ne rattache qu'un build du MÊME numéro.
 *
 * Apple refuse d'ouvrir une nouvelle version tant que la précédente est en revue : le script le dit
 * et s'arrête, il suffit de le relancer après l'accord. Relancé sur une version existante, il met
 * seulement les « Nouveautés » à jour.
 */
import { asc } from './asc-lib.mjs';

const PRO = process.argv.includes('--pro');
const APP = PRO ? '6821947874' : '6817317513';
const NUMERO = process.argv.slice(2).find((a) => /^\d+\.\d+(\.\d+)?$/.test(a));
if (!NUMERO) {
  console.log('usage : node scripts/asc-version.mjs <numéro, ex. 1.0.1> [--pro]');
  process.exit(1);
}

/** Texte des nouveautés, par langue de fiche. Une langue absente d'ici reçoit le texte français. */
const NOUVEAUTES = {
  'fr-FR': PRO
    ? 'Accueil plus compact : votre journée, le prochain client et les demandes à valider, sans rien d’autre.\nInscription : l’adresse du salon se choisit en trois étapes (wilaya, adresse, emplacement exact sur la carte) et se confirme avant de continuer.\nUne adresse e-mail déjà associée à un compte professionnel est signalée dès la saisie.\nAgenda et réservations redessinés. L’application ne zoome plus par erreur.'
    : 'L’application ne zoome plus par erreur (pincement, taille de police du téléphone).\nEspace professionnel : accueil, agenda et réservations redessinés.\nCorrections et améliorations.',
};

const lire = async (p) => (await asc('GET', p)).json?.data ?? null;
const detail = (r) => (r.json?.errors ?? []).map((e) => `${e.code} — ${e.detail ?? e.title}`).join('\n  ') || JSON.stringify(r.json);

const versions = (await lire(`/v1/apps/${APP}/appStoreVersions?limit=10`)) ?? [];
let version = versions.find((v) => v.attributes.platform === 'IOS' && v.attributes.versionString === NUMERO);

if (version) {
  console.log(`· version ${NUMERO} déjà ouverte (${version.attributes.appStoreState})`);
} else {
  const r = await asc('POST', '/v1/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString: NUMERO, releaseType: 'AFTER_APPROVAL', copyright: '2026 Salon DZ' },
      relationships: { app: { data: { type: 'apps', id: APP } } },
    },
  });
  if (r.status >= 300) {
    console.log(`✖ création de la version ${NUMERO} refusée :`, r.status, '\n  ' + detail(r));
    const enCours = versions.find((v) => ['WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_DEVELOPER_RELEASE'].includes(v.attributes.appStoreState));
    if (enCours) console.log(`  (la version ${enCours.attributes.versionString} est encore ${enCours.attributes.appStoreState} : relancer après l'accord d'Apple)`);
    process.exit(2);
  }
  version = r.json.data;
  console.log(`✔ version ${NUMERO} créée (publication automatique après accord)`);
}

const locs = (await lire(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)) ?? [];
for (const loc of locs) {
  const texte = NOUVEAUTES[loc.attributes.locale] ?? NOUVEAUTES['fr-FR'];
  const r = await asc('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
    data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { whatsNew: texte } },
  });
  console.log(r.status < 300 ? `✔ nouveautés (${loc.attributes.locale})` : `✖ nouveautés (${loc.attributes.locale}) : ${detail(r)}`);
}
console.log(`\nSuite : compiler (node --env-file=.env scripts/codemagic.mjs --lancer${PRO ? ' --pro' : ''}), puis node scripts/asc-soumettre.mjs${PRO ? ' --pro' : ''}`);
