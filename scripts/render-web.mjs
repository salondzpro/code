#!/usr/bin/env node
// Met le front web en ligne sur Render (site statique gratuit, CDN) sans passer par le dashboard.
//   node --env-file=.env scripts/render-web.mjs           → crée le site s'il manque, aligne CORS de l'API, suit le déploiement
//   node --env-file=.env scripts/render-web.mjs --deploy  → force un nouveau déploiement du site
//   node --env-file=.env scripts/render-web.mjs --redeploy-api → force un redéploiement de l'API (ex. après un changement de variable)
// Requiert dans .env : RENDER_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY.
// Idempotent : relançable sans risque (le site existant est réutilisé, les variables sont réécrites).

const API = 'https://api.render.com/v1';
const OWNER_ID = 'tea-dag6rklbedkc73fmbv2g'; // workspace Render « My Workspace »
const REPO = 'https://github.com/salondzpro/code';
const SITE_NAME = 'salondz'; // → https://salondz.onrender.com
const API_SERVICE_NAME = 'salondz-api';
const API_URL = 'https://salondz-api.onrender.com';

const key = process.env.RENDER_API_KEY;
if (!key) fail('RENDER_API_KEY manquante dans .env');
for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) if (!process.env[k]) fail(`${k} manquante dans .env`);

const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json', 'Content-Type': 'application/json' };
const forceDeploy = process.argv.includes('--deploy');
const redeployApi = process.argv.includes('--redeploy-api');

const envVars = [
  { key: 'NODE_VERSION', value: '22' },
  { key: 'PNPM_VERSION', value: '10.15.0' },
  { key: 'VITE_SUPABASE_URL', value: process.env.VITE_SUPABASE_URL },
  { key: 'VITE_SUPABASE_PUBLISHABLE_KEY', value: process.env.VITE_SUPABASE_PUBLISHABLE_KEY },
  { key: 'VITE_API_URL', value: API_URL },
  // Pas de fournisseur SMS sur Supabase → secours OTP e-mail. Mettre '0' une fois Twilio branché.
  { key: 'VITE_AUTH_EMAIL_FALLBACK', value: process.env.VITE_AUTH_EMAIL_FALLBACK ?? '1' },
];
if (process.env.VITE_SENTRY_DSN) envVars.push({ key: 'VITE_SENTRY_DSN', value: process.env.VITE_SENTRY_DSN });

const siteSpec = {
  type: 'static_site',
  name: SITE_NAME,
  ownerId: OWNER_ID,
  repo: REPO,
  branch: 'main',
  autoDeploy: 'yes',
  rootDir: '.',
  buildFilter: {
    paths: ['apps/web/**', 'packages/**', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', 'render.yaml'],
    ignoredPaths: [],
  },
  envVars,
  serviceDetails: {
    buildCommand: 'pnpm install --frozen-lockfile --filter "@salondz/web..." && pnpm --filter @salondz/web build',
    publishPath: 'apps/web/dist',
    pullRequestPreviewsEnabled: 'no',
    routes: [{ type: 'rewrite', source: '/*', destination: '/index.html' }],
    headers: [
      { path: '/assets/*', name: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      // L'index (et toute route SPA) doit être revalidé à chaque visite : sinon le téléphone garde l'ancien bundle.
      { path: '/', name: 'Cache-Control', value: 'no-cache' },
      { path: '/index.html', name: 'Cache-Control', value: 'no-cache' },
      { path: '/*', name: 'Cache-Control', value: 'no-cache' },
      { path: '/*', name: 'X-Content-Type-Options', value: 'nosniff' },
      { path: '/*', name: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ],
  },
};

// ---------------------------------------------------------------------------
const services = await get('/services?limit=50');
const byName = (n) => services.find((s) => s.service.name === n)?.service;
const apiService = byName(API_SERVICE_NAME);
let site = byName(SITE_NAME);
let deployId;

if (!site) {
  const res = await call('POST', '/services', siteSpec);
  site = res.service;
  deployId = res.deployId;
  console.log(`Site créé : ${site.name} (${site.id}) → ${site.serviceDetails?.url}`);
} else {
  console.log(`Site existant : ${site.name} (${site.id}) → ${site.serviceDetails?.url}`);
  await call('PUT', `/services/${site.id}/env-vars`, envVars);
  console.log(`Variables de build réécrites (${envVars.length}).`);
  if (forceDeploy) {
    deployId = (await call('POST', `/services/${site.id}/deploys`, { clearCache: 'do_not_clear' })).id;
  }
}
const siteUrl = site.serviceDetails?.url ?? `https://${SITE_NAME}.onrender.com`;

// CORS de l'API : le site web doit figurer dans CORS_ORIGINS.
if (apiService) {
  const vars = (await get(`/services/${apiService.id}/env-vars?limit=100`)).map((e) => e.envVar);
  const cors = vars.find((v) => v.key === 'CORS_ORIGINS');
  const origins = new Set((cors?.value ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  let changed = false;
  if (!origins.has(siteUrl)) {
    origins.add(siteUrl);
    await call('PUT', `/services/${apiService.id}/env-vars/CORS_ORIGINS`, { value: [...origins].join(',') });
    console.log(`CORS_ORIGINS de l'API mis à jour : ${[...origins].join(',')}.`);
    changed = true;
  } else {
    console.log(`CORS_ORIGINS de l'API contient déjà ${siteUrl}.`);
  }
  // Une variable modifiée par l'API Render ne redéploie PAS le service : on le fait explicitement.
  if (changed || redeployApi) {
    const dep = await call('POST', `/services/${apiService.id}/deploys`, { clearCache: 'do_not_clear' });
    await follow(apiService.id, dep.id, "Redéploiement de l'API");
  }
  const pre = await fetch(`${API_URL}/v1/salons`, { method: 'OPTIONS', headers: { Origin: siteUrl, 'Access-Control-Request-Method': 'GET' } });
  const allow = pre.headers.get('access-control-allow-origin');
  console.log(`CORS ${siteUrl} → API : ${allow === siteUrl ? 'ok' : `KO (allow-origin=${allow})`}`);
}
else {
  console.warn(`Service ${API_SERVICE_NAME} introuvable : CORS_ORIGINS non modifié.`);
}

// Suivi du déploiement du site.
if (deployId) await follow(site.id, deployId, 'Déploiement du site');

// Vérification HTTP.
const r = await fetch(`${siteUrl}/`, { redirect: 'manual' });
const html = await r.text();
console.log(`GET ${siteUrl}/ → ${r.status} ${/<div id="root">/.test(html) ? '(index Vite ok)' : '(contenu inattendu)'}`);
const deep = await fetch(`${siteUrl}/recherche`, { redirect: 'manual' });
console.log(`GET ${siteUrl}/recherche → ${deep.status} (règle SPA ${deep.status === 200 ? 'ok' : 'KO'})`);

// ---------------------------------------------------------------------------
async function get(path) {
  return call('GET', path);
}
async function follow(serviceId, id, label) {
  process.stdout.write(`${label} `);
  for (let i = 0; i < 90; i++) {
    const d = await get(`/services/${serviceId}/deploys/${id}`);
    process.stdout.write(`${d.status} `);
    if (d.status === 'live') break;
    if (/failed|canceled|deactivated/.test(d.status)) fail(`\n${label} : ${d.status} — voir les logs sur https://dashboard.render.com`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log();
}
async function call(method, path, body) {
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) fail(`${method} ${path} → ${res.status} ${typeof json === 'string' ? json : json?.message ?? text}`);
  return json;
}
function fail(msg) {
  console.error(msg);
  process.exit(1);
}
