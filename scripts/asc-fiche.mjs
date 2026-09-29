/**
 * Remplit la fiche App Store de Salon DZ par l'API d'Apple, sans passer par l'interface web.
 *
 *   node scripts/asc-fiche.mjs                              → écrit tout et affiche ce qui reste
 *   node scripts/asc-fiche.mjs --telephone "+213 6 …"        → avec le vrai numéro de revue
 *   node scripts/asc-fiche.mjs --lire                        → n'écrit rien, montre l'état actuel
 *
 * POURQUOI UN SCRIPT : la fiche compte une trentaine de champs répartis sur six ressources
 * différentes (fiche, version, classification, revue, tarif, disponibilité). Les saisir à la main,
 * c'est une heure de clics et une faute de frappe garantie ; ici les textes viennent de docs/STORES.md,
 * ils sont les MÊMES que ceux de Google Play, et l'opération se rejoue à l'identique.
 *
 * Le script est idempotent : il relit l'existant, ne crée que ce qui manque, et met à jour le reste.
 *
 * CE QU'IL NE PEUT PAS FAIRE : les étiquettes de confidentialité (« App Privacy »). Apple a retiré
 * `appDataUsages` de l'API — vérifié, les six chemins répondent 404. C'est le seul formulaire qui
 * reste à cocher à la main ; son contenu est décrit dans docs/STORES.md § 3.
 */
import { asc } from './asc-lib.mjs';

const APP = '6817317513';
const LIRE = process.argv.includes('--lire');

const ok = [];
const reste = [];

/** Un appel d'écriture : tracé, et jamais silencieux en cas de refus d'Apple. */
async function ecrire(label, method, p, body) {
  if (LIRE) {
    console.log('· (lecture seule)', label);
    return null;
  }
  const r = await asc(method, p, body);
  if (r.status >= 200 && r.status < 300) {
    ok.push(label);
    console.log('✔', label);
    return r.json;
  }
  const detail = r.json?.errors?.map((e) => `${e.title} — ${e.detail || ''}`).join(' | ') || JSON.stringify(r.json);
  reste.push(`${label} : ${detail}`);
  console.log('✖', label, '→', r.status, detail);
  return null;
}

const lire = async (p) => (await asc('GET', p)).json?.data ?? null;

/**
 * `--lire` : l'état réel de la fiche chez Apple, sans rien écrire. C'est ce qu'on regarde avant
 * d'annoncer que la fiche est prête — un champ vide ne se voit pas autrement qu'en le demandant.
 */
if (LIRE) {
  const infos = await lire(`/v1/apps/${APP}/appInfos`);
  const INFO = infos[0].id;
  const [fiche] = await lire(`/v1/appInfos/${INFO}/appInfoLocalizations`);
  const cat = await lire(`/v1/appInfos/${INFO}/primaryCategory`);
  const cat2 = await lire(`/v1/appInfos/${INFO}/secondaryCategory`);
  const age = await lire(`/v1/appInfos/${INFO}/ageRatingDeclaration`);
  const versions = await lire(`/v1/apps/${APP}/appStoreVersions?limit=5`);
  const v = versions.find((x) => x.attributes.platform === 'IOS');
  const [locv] = await lire(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`);
  const revue = await lire(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`);
  const prix = await lire(`/v1/appPriceSchedules/${APP}/manualPrices?limit=2`);
  const pays = (await asc('GET', `/v2/appAvailabilities/${APP}/territoryAvailabilities?limit=1`)).json?.meta?.paging?.total;
  const series = (await lire(`/v1/appStoreVersionLocalizations/${locv.id}/appScreenshotSets`)) ?? [];

  const dit = (nom, valeur) => console.log(` ${valeur ? '✔' : '✖'} ${nom.padEnd(28)} ${valeur ? String(valeur).replace(/\s+/g, ' ').slice(0, 72) : '— vide —'}`);
  console.log(`\nFiche « ${infos[0].attributes ? 'Salon DZ' : ''} » · version ${v.attributes.versionString} · ${v.attributes.appStoreState}\n`);
  dit('nom', fiche.attributes.name);
  dit('sous-titre', fiche.attributes.subtitle);
  dit('confidentialité', fiche.attributes.privacyPolicyUrl);
  dit('catégories', [cat?.id, cat2?.id].filter(Boolean).join(' / '));
  dit('description', locv.attributes.description?.length + ' caractères');
  dit('mots-clés', locv.attributes.keywords);
  dit('texte promotionnel', locv.attributes.promotionalText);
  dit('assistance', locv.attributes.supportUrl);
  dit('marketing', locv.attributes.marketingUrl);
  dit('copyright', v.attributes.copyright);
  dit('classification', age?.attributes?.userGeneratedContent === null ? null : 'renseignée (4+)');
  dit('compte de démonstration', revue?.attributes?.demoAccountName);
  // Le numéro fictif remplit le champ mais ne joint personne : il doit se signaler comme manquant,
  // sinon un futur passage conclurait que la fiche est complète.
  const tel = revue?.attributes?.contactPhone;
  dit('téléphone de revue', tel === '+213 555 00 00 00' ? null : tel);
  if (tel === '+213 555 00 00 00') console.log('   ↳ numéro fictif en place : node scripts/asc-fiche.mjs --telephone "+213 …"');
  dit('tarif', prix?.length ? 'gratuit' : null);
  dit('disponibilité', pays ? `${pays} pays` : null);
  dit('captures', series.map((s) => s.attributes.screenshotDisplayType).join(', '));
  console.log('\n Étiquettes de confidentialité : à cocher dans l’interface web (Apple a retiré l’API).');
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------
// Les textes. Repris mot pour mot de docs/STORES.md, pour que les deux boutiques disent la même chose.
// ---------------------------------------------------------------------------------------------
const SOUS_TITRE = 'Coiffeur, barbier, institut';
const PROMO =
  'Trouvez un salon près de vous, réservez en quelques secondes et recevez vos rappels par notification. ' +
  'Pour les professionnels : agenda, demandes et rappels en direct.';
const MOTS_CLES = 'coiffeur,barbier,salon,beauté,rendez-vous,réservation,ongles,cils,institut,Algérie,agenda,Alger';
const DESCRIPTION = `Salon DZ, c'est la réservation de salon en Algérie : simple, et sans avoir à appeler.

POUR LES CLIENTS
• Trouvez barbiers, coiffeurs, instituts, ongles, cils et soins près de chez vous, avec les disponibilités en temps réel
• Réservez en quelques secondes, en dinars algériens
• Recevez la confirmation du salon et vos rappels (la veille et 2 h avant) directement par notification
• Reportez ou annulez en un geste, et retrouvez tous vos rendez-vous au même endroit
• Réservez aussi pour un proche
• Laissez un avis après votre rendez-vous

POUR LES PROFESSIONNELS
• Votre agenda, votre équipe et vos prestations dans votre poche
• Recevez chaque nouvelle demande en direct, confirmez ou refusez d'un geste
• Un rappel une heure avant chaque rendez-vous : plus besoin de vous envoyer un message pour ne pas oublier
• Votre page en ligne, votre lien et votre QR code à partager avec vos clients
• Fiche client, historique et chiffre d'affaires

Les confirmations, les demandes et les rappels passent par les notifications de l'application : fini les messages à recopier.`;

const limites = {
  'sous-titre': [SOUS_TITRE, 30],
  'texte promotionnel': [PROMO, 170],
  'mots-clés': [MOTS_CLES, 100],
  description: [DESCRIPTION, 4000],
};
for (const [nom, [texte, max]] of Object.entries(limites)) {
  if (texte.length > max) throw new Error(`${nom} : ${texte.length} caractères pour ${max} autorisés`);
  console.log(`  ${nom} : ${texte.length}/${max}`);
}

// ---------------------------------------------------------------------------------------------
// 1. Fiche : sous-titre, politique de confidentialité, catégories
// ---------------------------------------------------------------------------------------------
const infos = await lire(`/v1/apps/${APP}/appInfos`);
const INFO = infos[0].id;
const locFiche = await lire(`/v1/appInfos/${INFO}/appInfoLocalizations`);
const LOC_FICHE = locFiche.find((l) => l.attributes.locale === 'fr-FR').id;

await ecrire('sous-titre + politique de confidentialité', 'PATCH', `/v1/appInfoLocalizations/${LOC_FICHE}`, {
  data: {
    type: 'appInfoLocalizations',
    id: LOC_FICHE,
    attributes: { subtitle: SOUS_TITRE, privacyPolicyUrl: 'https://salondz.com/confidentialite' },
  },
});

// « Style de vie » en premier (c'est une application de réservation, pas un outil médical),
// « Santé et remise en forme » en second : c'est là que cherchent les clientes d'instituts.
await ecrire('catégories (Style de vie / Santé et remise en forme)', 'PATCH', `/v1/appInfos/${INFO}`, {
  data: {
    type: 'appInfos',
    id: INFO,
    relationships: {
      primaryCategory: { data: { type: 'appCategories', id: 'LIFESTYLE' } },
      secondaryCategory: { data: { type: 'appCategories', id: 'HEALTH_AND_FITNESS' } },
    },
  },
});

// ---------------------------------------------------------------------------------------------
// 2. Version 1.0 : description, mots-clés, liens, copyright
// ---------------------------------------------------------------------------------------------
const versions = await lire(`/v1/apps/${APP}/appStoreVersions?limit=5`);
const version = versions.find((v) => v.attributes.platform === 'IOS');
const VER = version.id;
console.log(`  version ${version.attributes.versionString} (${version.attributes.appStoreState})`);

const locVer = await lire(`/v1/appStoreVersions/${VER}/appStoreVersionLocalizations`);
const LOC_VER = locVer.find((l) => l.attributes.locale === 'fr-FR').id;

await ecrire('description, mots-clés, liens', 'PATCH', `/v1/appStoreVersionLocalizations/${LOC_VER}`, {
  data: {
    type: 'appStoreVersionLocalizations',
    id: LOC_VER,
    attributes: {
      description: DESCRIPTION,
      keywords: MOTS_CLES,
      promotionalText: PROMO,
      supportUrl: 'https://salondz.com/aide',
      marketingUrl: 'https://salondz.com',
    },
  },
});

await ecrire('copyright + publication après validation', 'PATCH', `/v1/appStoreVersions/${VER}`, {
  data: {
    type: 'appStoreVersions',
    id: VER,
    // `usesIdfa: false` : aucune régie publicitaire dans l'application, ce qui évite le questionnaire
    // de suivi publicitaire. `AFTER_APPROVAL` : mise en vente dès l'accord d'Apple, sans date à tenir.
    attributes: { copyright: '2026 Salon DZ', releaseType: 'AFTER_APPROVAL', usesIdfa: false },
  },
});

// ---------------------------------------------------------------------------------------------
// 3. Classification par âge. Une application de réservation ne contient aucun contenu sensible ;
//    le seul « oui » est le contenu publié par les utilisateurs (les avis sur les salons), ce qui
//    donne 4+. Les types attendus par Apple diffèrent d'un champ à l'autre (booléen ou énumération) :
//    ils ont été relevés sur l'API, pas devinés.
// ---------------------------------------------------------------------------------------------
const RIEN = 'NONE';
await ecrire('classification par âge (4+)', 'PATCH', `/v1/ageRatingDeclarations/${INFO}`, {
  data: {
    type: 'ageRatingDeclarations',
    id: INFO,
    attributes: {
      advertising: false,
      ageAssurance: false,
      gambling: false,
      lootBox: false,
      healthOrWellnessTopics: false,
      messagingAndChat: false,
      parentalControls: false,
      socialMedia: false,
      unrestrictedWebAccess: false,
      userGeneratedContent: true, // les avis laissés par les clients
      alcoholTobaccoOrDrugUseOrReferences: RIEN,
      contests: RIEN,
      gamblingSimulated: RIEN,
      gunsOrOtherWeapons: RIEN,
      horrorOrFearThemes: RIEN,
      matureOrSuggestiveThemes: RIEN,
      medicalOrTreatmentInformation: RIEN,
      profanityOrCrudeHumor: RIEN,
      sexualContentGraphicAndNudity: RIEN,
      sexualContentOrNudity: RIEN,
      violenceCartoonOrFantasy: RIEN,
      violenceRealistic: RIEN,
      violenceRealisticProlongedGraphicOrSadistic: RIEN,
      ageRatingOverride: RIEN,
      koreaAgeRatingOverride: RIEN,
    },
  },
});

// ---------------------------------------------------------------------------------------------
// 4. Coordonnées et notes pour la revue. Apple ouvre réellement l'application : sans compte de
//    démonstration, elle est refusée pour « impossible d'accéder au contenu ».
// ---------------------------------------------------------------------------------------------
const PLACEHOLDER = '+213 555 00 00 00';
const TELEPHONE = (() => {
  const i = process.argv.indexOf('--telephone');
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : PLACEHOLDER;
})();
if (TELEPHONE === PLACEHOLDER) {
  reste.push('téléphone de revue : numéro fictif, à remplacer par node scripts/asc-fiche.mjs --telephone "+213 …"');
}

// Sans accent ni caractère typographique : ce texte est lu par un relecteur d'Apple qui ne parle pas
// forcément français et le fait traduire ; les apostrophes courbes passent mal dans leurs outils.
const NOTES = [
  'Salon DZ est une application de reservation de salons de coiffure et de beaute en Algerie.',
  '',
  'DEUX ESPACES, DEUX COMPTES DE TEST (deja confirmes, aucun e-mail a ouvrir) :',
  '  Cliente       : relecteur-client@salondz.com  /  QGoZhKNjY_vyAa1!',
  '  Professionnel : relecteur-pro@salondz.com  /  1PWysk0F3tAfAa1!',
  "A l'ouverture, le portail client s'affiche ; le bouton << Portail professionnels >> ouvre l'autre espace.",
  '',
  'PARCOURS CONSEILLE (cliente) : se connecter, chercher un salon, ouvrir << Salon Demonstration >>',
  "(Alger Centre), choisir une prestation, reserver un creneau, puis << Mes rendez-vous >>.",
  'PARCOURS CONSEILLE (professionnel) : se connecter, agenda du jour, confirmer une demande.',
  '',
  'AUTORISATIONS, ET POURQUOI :',
  '  Position : uniquement application ouverte, pour classer les salons par distance. Facultative :',
  '    sans elle, la recherche se fait par ville et tout le reste fonctionne.',
  '  Notifications : rappels de rendez-vous et confirmations du salon. Facultatives.',
  "  Photos / appareil photo : uniquement pour qu'un professionnel illustre son salon.",
  '',
  "SUPPRESSION DU COMPTE : dans l'application (Reglages > Supprimer mon compte) et sur",
  'https://salondz.com/supprimer.',
  '',
  'Aucun achat integre, aucune publicite, aucun pistage. Les prix sont en dinars algeriens et le',
  "paiement se fait sur place, au salon : rien n'est encaisse dans l'application.",
].join('\n');

const REVUE = {
  contactFirstName: 'Salon',
  contactLastName: 'DZ',
  contactEmail: 'support@salondz.com',
  contactPhone: TELEPHONE,
  demoAccountRequired: true,
  demoAccountName: 'relecteur-client@salondz.com',
  demoAccountPassword: 'QGoZhKNjY_vyAa1!',
  notes: NOTES,
};
const revueExistante = await lire(`/v1/appStoreVersions/${VER}/appStoreReviewDetail`);
if (revueExistante) {
  await ecrire('coordonnées et notes de revue (mise à jour)', 'PATCH', `/v1/appStoreReviewDetails/${revueExistante.id}`, {
    data: { type: 'appStoreReviewDetails', id: revueExistante.id, attributes: REVUE },
  });
} else {
  await ecrire('coordonnées et notes de revue', 'POST', '/v1/appStoreReviewDetails', {
    data: {
      type: 'appStoreReviewDetails',
      attributes: REVUE,
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: VER } } },
    },
  });
}

// ---------------------------------------------------------------------------------------------
// 5. Tarif : gratuit. Sans grille de prix, l'application ne peut pas partir en revue.
// ---------------------------------------------------------------------------------------------
const BASE = 'DZA'; // le marché d'origine ; le gratuit vaut ensuite pour tous les pays.
const manuels = await lire(`/v1/appPriceSchedules/${APP}/manualPrices?limit=2`);
if (manuels && manuels.length) {
  console.log('· tarif déjà défini');
  ok.push('tarif (déjà défini)');
} else {
  const points = await lire(`/v1/apps/${APP}/appPricePoints?filter[territory]=${BASE}&limit=1`);
  const gratuit = points?.find((p) => Number(p.attributes.customerPrice) === 0);
  // Une ressource créée dans la même requête se désigne par un identifiant « local » : Apple exige
  // littéralement la forme ${nom}, accolades comprises, pour la distinguer d'un identifiant réel.
  const local = (nom) => '${' + nom + '}';
  if (!gratuit) reste.push(`tarif : aucun point de tarif gratuit trouvé pour ${BASE}`);
  else
    await ecrire('tarif : gratuit', 'POST', '/v1/appPriceSchedules', {
      data: {
        type: 'appPriceSchedules',
        relationships: {
          app: { data: { type: 'apps', id: APP } },
          baseTerritory: { data: { type: 'territories', id: BASE } },
          manualPrices: { data: [{ type: 'appPrices', id: local('gratuit') }] },
        },
      },
      included: [
        {
          type: 'appPrices',
          id: local('gratuit'),
          attributes: { startDate: null, endDate: null },
          relationships: { appPricePoint: { data: { type: 'appPricePoints', id: gratuit.id } } },
        },
      ],
    });
}

// ---------------------------------------------------------------------------------------------
// 6. Disponibilité : tous les pays. L'application vise l'Algérie, mais la diaspora réserve pour sa
//    famille depuis la France ou le Canada — il n'y a aucune raison de fermer la porte.
// ---------------------------------------------------------------------------------------------
const dispo = (await asc('GET', `/v2/appAvailabilities/${APP}`)).json?.data;
if (dispo) {
  console.log('· disponibilité déjà définie');
  ok.push('disponibilité (déjà définie)');
} else {
  const pays = [];
  for (let page = '/v1/territories?limit=200'; page; ) {
    const r = await asc('GET', page);
    pays.push(...(r.json?.data ?? []).map((t) => t.id));
    const suivant = r.json?.links?.next;
    page = suivant ? suivant.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  console.log(`  ${pays.length} pays`);
  // Même règle que pour le tarif : les disponibilités sont créées dans la requête, donc désignées
  // par un identifiant local ${PAYS}, tandis que le pays lui-même garde son identifiant réel.
  const localPays = (id) => '${' + id + '}';
  await ecrire('disponibilité : tous les pays', 'POST', '/v2/appAvailabilities', {
    data: {
      type: 'appAvailabilities',
      attributes: { availableInNewTerritories: true },
      relationships: {
        app: { data: { type: 'apps', id: APP } },
        territoryAvailabilities: { data: pays.map((id) => ({ type: 'territoryAvailabilities', id: localPays(id) })) },
      },
    },
    included: pays.map((id) => ({
      type: 'territoryAvailabilities',
      id: localPays(id),
      attributes: { available: true },
      relationships: { territory: { data: { type: 'territories', id } } },
    })),
  });
}

console.log(`\n--- écrit : ${ok.length} · reste : ${reste.length} ---`);
for (const r of reste) console.log('  ! ' + r);
