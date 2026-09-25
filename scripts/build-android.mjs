/**
 * Livraison Android complète, en une commande :
 *
 *   node scripts/build-android.mjs            → incrémente le numéro de version, puis construit
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
 * Par défaut, les fichiers du site sont EMBARQUÉS : l'application démarre toujours, même sans réseau.
 *
 * `--en-ligne` la fait charger salondz.com — un déploiement mettrait alors à jour tout le monde sans
 * passer par le Play Store. **Non validé** : essayé le 25 sept. 2026, l'application s'ouvrait sur un
 * écran blanc, cause non identifiée faute de pouvoir lire les journaux de l'appareil. Ne pas livrer
 * dans ce mode sans l'avoir vu fonctionner sur un téléphone.
 */
const mode = process.argv.includes('--en-ligne') ? 'remote' : 'bundled';
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

// 3. UNIQUEMENT le `.aab`. Le propriétaire essaie ses versions par le TEST INTERNE de Play Console,
// jamais par un fichier installé à la main : un `.apk` en plus allongeait la compilation pour rien, et
// deux fichiers voisins ont déjà été confondus (l'ancien APK Expo installé à la place du nouveau).
// Chemin complet : sous Windows, « ./gradlew.bat » n'est pas reconnu par l'interpréteur de commandes.
run(`"${path.join(ANDROID, 'gradlew.bat')}"`, [':app:bundleRelease', '--no-daemon'], ANDROID);

// 4. Sur le Bureau, avec le numéro dans le nom : impossible d'envoyer deux fois le même fichier
mkdirSync(OUT, { recursive: true });
const built = path.join(ANDROID, 'app', 'build', 'outputs');
const aab = path.join(OUT, `salon-dz-${versionName}-versionCode${next}.aab`);
copyFileSync(path.join(built, 'bundle', 'release', 'app-release.aab'), aab);

console.log(`\n✔ À envoyer sur Play Console : ${aab}`);
