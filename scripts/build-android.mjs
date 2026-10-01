/**
 * Livraison Android complète, en une commande :
 *
 *   node scripts/build-android.mjs            → incrémente le numéro de version, puis construit
 *   node scripts/build-android.mjs --pro      → la variante PROFESSIONNELLE (`pro.salondz.app`)
 *   node scripts/build-android.mjs --same     → reconstruit SANS changer le numéro (mise au point)
 *
 * Enchaîne : numéro de version → construction du site → synchronisation de la coque → `.aab` (Play
 * Console) → copie sur le Bureau. UNIQUEMENT le `.aab` : les essais passent par le test interne de
 * Play Console, jamais par un fichier installé à la main.
 *
 * Pourquoi un script : Google REFUSE un envoi dont le numéro a déjà servi, et ce numéro ne peut
 * jamais redescendre. Oublier de l'incrémenter coûte un aller-retour complet avec Play Console —
 * c'est arrivé. Il vit dans `apps/web/android/version.properties`, versionné.
 *
 * Java 21 est OBLIGATOIRE (Capacitor 7) : le Java 17 du système échoue sur « invalid source release ».
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'apps', 'web');
const ANDROID = path.join(WEB, 'android');
/**
 * VARIANTE PROFESSIONNELLE : une seconde application, publiée à part, qui ne contient QUE l'espace
 * professionnel. Tout diffère de bout en bout — le bundle web (les écrans clients n'y sont pas
 * livrés), l'identifiant publié, le nom, le numéro de version et le fichier Firebase.
 */
const PRO = process.argv.includes('--pro');
const VERSION_FILE = path.join(ANDROID, PRO ? 'version-pro.properties' : 'version.properties');
const OUT = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', 'Desktop', 'salondz-play');

const JAVA_HOME = process.env.SALONDZ_JAVA_HOME ?? 'C:/Users/gaci/tools/jdk-21.0.12.1+1';
const ANDROID_HOME = process.env.ANDROID_HOME ?? 'C:/Users/gaci/AppData/Local/Android/Sdk';
/**
 * Par défaut, les fichiers du site sont EMBARQUÉS : l'application démarre toujours, même sans réseau.
 *
 * `--en-ligne` la fait charger salondz.com — un déploiement mettrait alors à jour tout le monde sans
 * passer par le Play Store. **Non validé** : essayé le 25 sept. 2026, l'application s'ouvrait sur un
 * écran blanc, cause non identifiée faute de pouvoir lire les journaux de l'appareil. Ne pas livrer
 * dans ce mode sans l'avoir vu fonctionner sur un téléphone.
 */
const mode = process.argv.includes('--en-ligne') ? 'remote' : 'bundled';
const env = {
  ...process.env,
  JAVA_HOME,
  ANDROID_HOME,
  ANDROID_SDK_ROOT: ANDROID_HOME,
  SALONDZ_APP_MODE: mode,
  // Lu par `capacitor.config.ts` (identifiant, nom) et par Vite (`VITE_APP_FLAVOR`, qui retire les
  // écrans clients du bundle — ils ne sont pas cachés, ils ne sont pas livrés).
  ...(PRO ? { SALONDZ_APP_FLAVOR: 'pro', VITE_APP_FLAVOR: 'pro' } : {}),
};

const run = (cmd, args, cwd) => {
  console.log(`\n▸ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, env, stdio: 'inherit', shell: true });
};

// 1. Numéro de version
const raw = readFileSync(VERSION_FILE, 'utf8');
const current = Number(/^versionCode=(\d+)$/m.exec(raw)?.[1] ?? 0);
const next = process.argv.includes('--same') ? current : current + 1;
const versionName = /^versionName=(.+)$/m.exec(raw)?.[1]?.trim() ?? '1.0.0';
if (next !== current) {
  writeFileSync(VERSION_FILE, raw.replace(/^versionCode=\d+$/m, `versionCode=${next}`));
}
console.log(`Version ${versionName} (${next})${next === current ? ' — inchangée' : ` — était ${current}`}`);
console.log(mode === 'remote' ? 'Mode : EN LIGNE (mises à jour sans passer par le Play Store)' : 'Mode : EMBARQUÉ (fonctionne hors ligne)');
console.log(PRO ? 'Variante : PROFESSIONNELLE (pro.salondz.app)' : 'Variante : grand public (dz.salondz.app)');

// 2. Le site, puis la coque
// Le raccourci `pnpm` global est cassé sur cette machine : on passe par le fichier de corepack.
const PNPM = process.env.SALONDZ_PNPM ?? 'C:/Users/gaci/AppData/Local/node/corepack/v1/pnpm/9.15.0/bin/pnpm.cjs';
run('node', [PNPM, '--filter', '@salondz/web', 'build'], ROOT);

// Garde-fou : l'adresse de l'API doit se retrouver dans le bundle. Sans lui, une construction qui
// reprend le `.env` de développement produit une application qui cherche le serveur SUR LE
// TÉLÉPHONE (`http://localhost:8090`) : tout appel réel échoue sur « Pas de connexion ». C'est
// exactement ce qui a été livré, et le défaut est resté invisible parce que les comptes de
// démonstration n'appellent jamais l'API. Les bonnes valeurs sont dans `.env.production`.
const ASSETS = path.join(WEB, 'dist', 'assets');
const vise = readdirSync(ASSETS)
  .filter((f) => f.endsWith('.js'))
  .map((f) => /VITE_API_URL:"([^"]*)"/.exec(readFileSync(path.join(ASSETS, f), 'utf8'))?.[1])
  .find(Boolean);
if (vise !== 'https://api.salondz.com') {
  throw new Error(`Le site a été construit pour « ${vise ?? 'aucune adresse' } » au lieu de https://api.salondz.com — vérifier .env.production`);
}
console.log(`API visée par l'application : ${vise}`);

run('npx', ['cap', 'sync', 'android'], WEB);

// 3. UNIQUEMENT le `.aab`. Le propriétaire essaie ses versions par le TEST INTERNE de Play Console,
// jamais par un fichier installé à la main : un `.apk` en plus allongeait la compilation pour rien, et
// deux fichiers voisins ont déjà été confondus (l'ancien APK Expo installé à la place du nouveau).
// Chemin complet : sous Windows, « ./gradlew.bat » n'est pas reconnu par l'interpréteur de commandes.
/**
 * ICÔNES DE LA VARIANTE PROFESSIONNELLE. `res-pro/` ne contient QUE les fichiers qui diffèrent ;
 * on les pose par-dessus `res/` le temps de la compilation, après avoir mis de côté les originaux.
 * Gradle refuse deux dossiers de ressources (il les fusionne et signale les doublons), d'où cette
 * superposition plutôt qu'un `sourceSets`.
 */
const RES = path.join(ANDROID, 'app', 'src', 'main', 'res');
const RES_PRO = path.join(ANDROID, 'app', 'src', 'main', 'res-pro');

/** Chemins relatifs de tous les fichiers d'un dossier, en descendant. */
const fichiersDe = (racine, base = '') =>
  existsSync(racine)
    ? readdirSync(path.join(racine, base), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? fichiersDe(racine, path.join(base, e.name)) : [path.join(base, e.name)],
      )
    : [];

const GS = path.join(ANDROID, 'app', 'google-services.json');
const GS_PRO = path.join(ANDROID, 'app', 'google-services-pro.json');
const GS_SAUVE = path.join(ANDROID, 'app', 'google-services.grandpublic.json');
/** Originaux mis de côté, pour être remis quoi qu'il arrive. */
const sauvegardes = [];
if (PRO) {
  // Le greffon Google Services REFUSE de compiler si l'identifiant publié ne figure pas dans le
  // fichier (« No matching client found »). On pose celui de la variante pro le temps de la
  // compilation, et on remet l'autre ensuite — y compris si Gradle échoue.
  if (!existsSync(GS_PRO)) throw new Error(`${GS_PRO} manquant : lancer node --env-file=.env scripts/firebase-app-pro.mjs`);
  copyFileSync(GS, GS_SAUVE);
  copyFileSync(GS_PRO, GS);

  const icones = fichiersDe(RES_PRO);
  if (!icones.length) throw new Error(`${RES_PRO} vide : lancer node scripts/make-capacitor-icons.mjs --pro`);
  // Les originaux sont mis de côté HORS de `res/` : Android refuse toute extension qui ne soit pas
  // .png ou .xml, et une sauvegarde laissée dans l'arborescence fait échouer la fusion.
  const ABRI = path.join(ANDROID, 'build', 'icones-grandpublic');
  for (const rel of icones) {
    const dest = path.join(RES, rel);
    if (existsSync(dest)) {
      const garde = path.join(ABRI, rel);
      mkdirSync(path.dirname(garde), { recursive: true });
      copyFileSync(dest, garde);
      sauvegardes.push([garde, dest]);
    }
    copyFileSync(path.join(RES_PRO, rel), dest);
  }
  console.log(`Icônes professionnelles posées (${icones.length} fichiers).`);
}
try {
  run(`"${path.join(ANDROID, 'gradlew.bat')}"`, [':app:bundleRelease', ...(PRO ? ['-PsalondzPro'] : []), '--no-daemon'], ANDROID);
} finally {
  if (PRO && existsSync(GS_SAUVE)) {
    copyFileSync(GS_SAUVE, GS);
    rmSync(GS_SAUVE);
  }
  for (const [garde, dest] of sauvegardes) {
    copyFileSync(garde, dest);
    rmSync(garde);
  }
}

// 4. Sur le Bureau, avec le numéro dans le nom : impossible d'envoyer deux fois le même fichier
mkdirSync(OUT, { recursive: true });
const built = path.join(ANDROID, 'app', 'build', 'outputs');
const aab = path.join(OUT, `salon-dz${PRO ? '-pro' : ''}-${versionName}-versionCode${next}.aab`);
copyFileSync(path.join(built, 'bundle', 'release', 'app-release.aab'), aab);

console.log(`\n✔ À envoyer sur Play Console : ${aab}`);
