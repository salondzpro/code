/**
 * App ID de l'application PROFESSIONNELLE iPhone (`pro.salondz.app`), par l'API App Store Connect.
 *
 *   node scripts/asc-app-id-pro.mjs            → crée l'App ID s'il manque, pose les capacités
 *   node scripts/asc-app-id-pro.mjs --lire     → n'écrit rien, dit ce qui existe
 *
 * Pourquoi : Codemagic (`fetch-signing-files --create`) sait fabriquer un profil, pas poser les
 * CAPACITÉS d'un App ID. Sans « Push Notifications » le profil ne porte pas `aps-environment` et
 * Xcode échoue à la signature sur un message qui parle des notifications sans dire que l'App ID
 * ne les autorise pas ; sans « Associated Domains », les liens universels ne s'ouvrent pas.
 * Idempotent : relancer ne crée rien deux fois. Ce que l'API ne fait PAS : créer l'application
 * dans App Store Connect (fiche, SKU) — c'est au propriétaire, comme pour `dz.salondz.app`.
 */
import { asc, TEAM_ID } from './asc-lib.mjs';

const BUNDLE = 'pro.salondz.app';
const LIRE = process.argv.includes('--lire');
const VOULUES = ['PUSH_NOTIFICATIONS', 'ASSOCIATED_DOMAINS'];

const existants = (await asc('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE}&include=bundleIdCapabilities`)).json;
let appId = existants?.data?.find((b) => b.attributes.identifier === BUNDLE) ?? null;
let caps = (existants?.included ?? []).filter((c) => c.type === 'bundleIdCapabilities').map((c) => c.attributes.capabilityType);

if (!appId) {
  if (LIRE) {
    console.log(`App ID ${BUNDLE} : ABSENT (lancer sans --lire pour le créer)`);
    process.exit(1);
  }
  const r = await asc('POST', '/v1/bundleIds', {
    data: { type: 'bundleIds', attributes: { identifier: BUNDLE, name: 'Salon DZ Pro', platform: 'IOS', seedId: TEAM_ID } },
  });
  if (r.status !== 201) {
    console.error('✖ création refusée', r.status, JSON.stringify(r.json?.errors ?? r.json));
    process.exit(1);
  }
  appId = r.json.data;
  caps = [];
  console.log(`✔ App ID créé : ${BUNDLE} (${appId.id})`);
} else {
  console.log(`App ID ${BUNDLE} : présent (${appId.id}) · capacités : ${caps.join(', ') || 'aucune'}`);
}

for (const cap of VOULUES) {
  if (caps.includes(cap)) continue;
  if (LIRE) {
    console.log(`  capacité ${cap} : MANQUANTE`);
    continue;
  }
  const r = await asc('POST', '/v1/bundleIdCapabilities', {
    data: {
      type: 'bundleIdCapabilities',
      attributes: { capabilityType: cap },
      relationships: { bundleId: { data: { type: 'bundleIds', id: appId.id } } },
    },
  });
  if (r.status !== 201) {
    console.error(`✖ capacité ${cap} refusée`, r.status, JSON.stringify(r.json?.errors ?? r.json));
    process.exit(1);
  }
  console.log(`✔ capacité ${cap} posée`);
}
console.log(LIRE ? 'Lecture terminée.' : `Prêt pour la signature : Codemagic (étiquette ios-pro-N) récupérera ou créera le profil App Store de ${BUNDLE}.`);
