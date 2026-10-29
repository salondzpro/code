/**
 * Construction du SITE publié sur Render (29 oct. 2026) : le bundle grand public, puis les paquets
 * de MISE À JOUR AUTOMATIQUE des applications embarquées (`src/lib/liveUpdate.ts`).
 *
 *   dist/                         le site salondz.com (inchangé)
 *   dist/ota/client/latest.json   + <version>.zip  → application iPhone grand public
 *   dist/ota/pro/latest.json      + <version>.zip  → application PRO (iPhone et Android)
 *
 * La version est le commit déployé (`RENDER_GIT_COMMIT`), inscrite dans chaque bundle
 * (`VITE_BUNDLE_VERSION`) : une application compare la sienne à `latest.json` et ne télécharge
 * que si elles diffèrent. `OTA_MIN_NATIVE_BUILD` (facultatif) : numéro de build natif minimal —
 * à poser quand un changement web EXIGE un greffon natif récent.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const git = () => {
  try {
    return execSync('git rev-parse --short=12 HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return null;
  }
};
const version = (process.env.RENDER_GIT_COMMIT || '').slice(0, 12) || git() || `t${Date.now()}`;
const minNativeBuild = Number(process.env.OTA_MIN_NATIVE_BUILD || 0) || 0;

function vite(outDir, extra = {}) {
  execSync(`npx vite build --outDir ${outDir} --emptyOutDir`, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, VITE_BUNDLE_VERSION: version, ...extra },
  });
}

/** Zip du dossier (sans `ota/`), fichiers à la racine : c'est le format qu'attend le greffon. */
function zipDir(dir) {
  const files = {};
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const rel = relative(dir, p).split('\\').join('/');
      if (rel === 'ota' || rel.startsWith('ota/')) continue;
      if (statSync(p).isDirectory()) walk(p);
      else files[rel] = [readFileSync(p), { level: /\.(png|webp|jpg|woff2|zip)$/.test(name) ? 0 : 9 }];
    }
  };
  walk(dir);
  if (!files['index.html']) throw new Error(`index.html absent de ${dir}`);
  return zipSync(files);
}

function publish(flavor, srcDir) {
  const zip = zipDir(srcDir);
  const out = join(ROOT, 'dist', 'ota', flavor);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `${version}.zip`), zip);
  const latest = {
    version,
    url: `/ota/${flavor}/${version}.zip`,
    sha256: createHash('sha256').update(zip).digest('hex'),
    minNativeBuild,
    builtAt: new Date().toISOString(),
  };
  writeFileSync(join(out, 'latest.json'), JSON.stringify(latest, null, 2));
  console.log(`[ota] ${flavor} ${version} — ${(zip.length / 1024).toFixed(0)} ko`);
}

vite('dist');
// Variante PRO : construite à part, jamais servie comme site, seulement empaquetée.
vite('dist-pro', { VITE_APP_FLAVOR: 'pro' });
const proBundle = readdirSync(join(ROOT, 'dist-pro', 'assets')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(ROOT, 'dist-pro', 'assets', f), 'utf8')).join('');
if (!proBundle.includes('https://api.salondz.com')) throw new Error('Le bundle pro ne vise pas https://api.salondz.com.');
publish('client', join(ROOT, 'dist'));
publish('pro', join(ROOT, 'dist-pro'));
rmSync(join(ROOT, 'dist-pro'), { recursive: true, force: true });
