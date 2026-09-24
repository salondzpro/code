/**
 * Livraison Android complète, en une commande :
 *
 *   node scripts/build-android.mjs            → incrémente le numéro de version, puis construit
 *   node scripts/build-android.mjs --same     → reconstruit SANS changer le numéro (mise au point)
 *
 * Enchaîne : numéro de version → construction du site → synchronisation de la coque → `.aab` (Play
 * Console) et `.apk` (essai sur téléphone) → copie sur le Bureau.
 *
 * Pourquoi un script : Google REFUSE un envoi dont le numéro a déjà servi, et ce numéro ne peut
 * jamais redescendre. Oublier de l'incrémenter coûte un aller-retour complet avec Play Console —
 * c'est arrivé. Il vit dans `apps/web/android/version.properties`, versionné.
 *
 * Java 21 est OBLIGATOIRE (Capacitor 7) : le Java 17 du système échoue sur « invalid source release ».
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'apps', 'web');
const ANDROID = path.join(WEB, 'android');
const VERSION_FILE = path.join(ANDROID, 'version.properties');
const OUT = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', 'Desktop', 'salondz-play');

const JAVA_HOME = process.env.SALONDZ_JAVA_HOME ?? 'C:/Users/gaci/tools/jdk-21.0.12.1+1';
const ANDROID_HOME = process.env.ANDROID_HOME ?? 'C:/Users/gaci/AppData/Local/Android/Sdk';
/**
 * Android charge le site publié (`remote`) : un déploiement met à jour l'application de tout le monde
 * sans passer par le Play Store, et la connexion s'y comporte exactement comme sur le site.
 * `--embarque` revient aux fichiers embarqués (fonctionne hors ligne, mais impose un envoi au Store
 * pour la moindre correction).
 */
const mode = process.argv.includes('--embarque') ? 'bundled' : 'remote';
const env = { ...process.env, JAVA_HOME, ANDROID_HOME, ANDROID_SDK_ROOT: ANDROID_HOME, SALONDZ_APP_MODE: mode };

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

// 2. Le site, puis la coque
// Le raccourci `pnpm` global est cassé sur cette machine : on passe par le fichier de corepack.
const PNPM = process.env.SALONDZ_PNPM ?? 'C:/Users/gaci/AppData/Local/node/corepack/v1/pnpm/9.15.0/bin/pnpm.cjs';
run('node', [PNPM, '--filter', '@salondz/web', 'build'], ROOT);
run('npx', ['cap', 'sync', 'android'], WEB);

// 3. Les deux formats : `.aab` pour Play Console, `.apk` pour essayer sur un téléphone
// Chemin complet : sous Windows, « ./gradlew.bat » n'est pas reconnu par l'interpréteur de commandes.
run(`"${path.join(ANDROID, 'gradlew.bat')}"`, [':app:bundleRelease', ':app:assembleRelease', '--no-daemon'], ANDROID);

// 4. Sur le Bureau, avec le numéro dans le nom : impossible d'envoyer deux fois le même fichier
mkdirSync(OUT, { recursive: true });
const built = path.join(ANDROID, 'app', 'build', 'outputs');
const aab = path.join(OUT, `salon-dz-${versionName}-versionCode${next}.aab`);
const apk = path.join(OUT, `salon-dz-${versionName}-versionCode${next}-test.apk`);
copyFileSync(path.join(built, 'bundle', 'release', 'app-release.aab'), aab);
copyFileSync(path.join(built, 'apk', 'release', 'app-release.apk'), apk);

console.log(`\n✔ À envoyer sur Play Console : ${aab}`);
console.log(`✔ À installer pour essayer  : ${apk}`);
