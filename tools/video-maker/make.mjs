#!/usr/bin/env node
/**
 * Fabrique une vidéo « comment réserver » en filmant le VRAI site : l'interface vient du site publié, donc
 * un écran modifié apparaît dans la prochaine vidéo sans rien toucher ici.
 *
 *   node make.mjs --profil hommes --voix windows --site https://salondz.com
 *
 * Le parcours se joue dans la démonstration du navigateur : aucune réservation réelle n'est créée.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';
import { chromium } from 'playwright-core';
import { makeVoices, mixTrack } from './audio.mjs';
import { narration, play, PROFILES, TITLES } from './scenario.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const site = arg('site', 'https://salondz.com');
const profile = PROFILES[arg('profil', 'hommes')];
const voice = arg('voix', 'none');
if (!profile) throw new Error('Profil inconnu : hommes ou femmes');
const dir = path.join(here, 'out');
fs.mkdirSync(dir, { recursive: true });
const output = path.resolve(arg('sortie', path.join(dir, `salondz-${profile.slug}.mp4`)));

// Les couleurs viennent du design du site.
const tokens = fs.readFileSync(path.join(root, 'apps/web/src/styles/tokens.css'), 'utf8');
const color = (name, fallback) => tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1] ?? fallback;
const colors = { accent: color('accent', '#6c5ce7'), ink: color('ink', '#1e1b30'), subtle: color('subtle', '#716f80') };

const lines = narration(profile);
console.log(`Voix : ${voice}`);
const voices = await makeVoices(lines, dir, voice);

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-DZ', timezoneId: 'Africa/Algiers' });
const page = await context.newPage();
// Le matin : la journée a des heures libres, quelle que soit l'heure où l'outil tourne.
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Algiers' });
await page.clock.setFixedTime(new Date(`${today}T08:00:00+01:00`));

await page.goto(`${site}/connexion`);
await page.fill('input[type=email]', 'client@salondz.com');
await page.fill('input[type=password]', 'client@salondz.com');
await page.locator('button[type=submit]').first().click();
await page.waitForTimeout(3000);

// Le profil Instagram est une maquette : c'est le seul écran qui n'est pas Salon DZ.
const photo = (k) => `${site}/demo/${k}.webp`;
const instagram = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;font:14px Inter,-apple-system,Segoe UI,sans-serif;color:#1e1b30;background:#fff}
.t{display:flex;justify-content:space-between;padding:14px 16px;font-weight:600;font-size:16px}.h{display:flex;gap:18px;padding:6px 16px;align-items:center}
.a{width:84px;height:84px;border-radius:50%;padding:3px;border:2.5px solid #e1306c}.a img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.s{display:flex;gap:26px;margin-top:8px;font-size:12.5px}.s i{display:block;width:34px;height:11px;margin-bottom:6px;border-radius:4px;background:#e6e5ee}
.b{padding:10px 16px;line-height:1.5}.b a{color:#00376b;font-weight:600;text-decoration:none}.m{color:#636174}
.k{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:4px 16px 14px}.k b{padding:8px 0;border-radius:8px;background:#efefef;text-align:center;font-weight:600}.k b:first-child{background:#0095f6;color:#fff}
.g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px;border-top:1px solid #e6e5ee}.g img{width:100%;aspect-ratio:1;object-fit:cover;display:block}</style>
<div class=t><span>‹ ${profile.handle}</span><span>···</span></div>
<div class=h><div class=a><img src="${photo(profile.photos[0])}"></div><div><b>${profile.name}</b><div class=s><span><i></i>publications</span><span><i></i>followers</span><span><i></i>suivi(e)s</span></div></div></div>
<div class=b><div class=m>${profile.job} · 📍 ${profile.city}</div><div>Réservez en ligne 👇</div><a id=bio-link href="${site}/s/${profile.slug}">🔗 salondz.com/${profile.slug}</a></div>
<div class=k><b>Suivre</b><b>Message</b><b>Contacter</b></div>
<div class=g>${[...profile.photos, ...profile.photos].slice(0, 9).map((k) => `<img src="${photo(k)}">`).join('')}</div>`;
await page.route('https://instagram.salondz.invalid/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: instagram }));
await page.goto('https://instagram.salondz.invalid/profil');
await page.waitForTimeout(1500);

// L'écran est filmé tel qu'il est affiché.
const shots = [];
const cdp = await context.newCDPSession(page);
cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  shots.push({ s: metadata.timestamp, data });
  void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 780, maxHeight: 1600, everyNthFrame: 1 });

const start = Date.now();
const now = () => Date.now() - start;
const scenes = [];
const taps = [];
const keys = [];
let due = 0;
const need = async (locator, what) => {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    await page.screenshot({ path: path.join(dir, 'arret.png') });
    throw new Error(`Le parcours a changé : ${what} est introuvable. Capture dans out/arret.png`);
  }
  await locator.first().scrollIntoViewIfNeeded().catch(() => undefined);
};
const wait = (ms) => page.waitForTimeout(ms);
const gestures = {
  profile,
  /** Une scène ne se termine qu'une fois sa phrase dite. */
  async scene(id) {
    const left = due - now();
    if (left > 0) await wait(left);
    const ms = now();
    scenes.push({ id, ms, title: TITLES[id]?.(profile) ?? null });
    due = ms + (voices[id]?.seconds ?? 0) * 1000 + 250;
  },
  pause: wait,
  async scroll(locator) {
    await locator.first().evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await wait(900);
  },
  async tap(locator, what) {
    await need(locator, what);
    const b = await locator.first().boundingBox();
    await wait(700);
    taps.push({ ms: now(), x: b.x + b.width / 2, y: b.y + b.height / 2 });
    await locator.first().tap({ timeout: 5000 });
    await wait(300);
  },
  async type(locator, text, what) {
    await gestures.tap(locator, what);
    for (const ch of text) {
      await page.keyboard.type(ch);
      keys.push(now());
      await wait(55 + Math.random() * 60);
    }
  },
};
await play(gestures, page);
const tail = due - now();
if (tail > 0) await wait(tail);
const endAt = now();
await cdp.send('Page.stopScreencast');
await browser.close();
if (!shots.length) throw new Error('Rien n’a été filmé');

scenes.push({ id: 'end', ms: endAt, title: null });
console.log(`Parcours filmé : ${(endAt / 1000).toFixed(1)} s, ${shots.length} images, ${taps.length} touchers`);

// Les temps morts sautent : chargement, attente du navigateur. La voix et les gestes gardent leur vitesse.
const busy = [
  ...scenes.map((x) => [x.ms, x.ms + 700 + (voices[x.id]?.seconds ?? 0) * 1000]),
  ...taps.map((x) => [x.ms - 900, x.ms + 600]),
  ...keys.map((k) => [k - 80, k + 160]),
]
  .filter(([from]) => from < endAt)
  .sort((x, y) => x[0] - y[0]);
const knots = [[0, 0]];
let src = 0;
let edited = 0;
for (const [from, to] of busy) {
  if (from > src) {
    edited += Math.min(from - src, 250);
    src = from;
    knots.push([src, edited]);
  }
  if (to > src) {
    edited += to - src;
    src = to;
    knots.push([src, edited]);
  }
}
if (endAt > src) knots.push([endAt, edited + 200]);
const lookup = (list, value, a, b) => {
  for (let i = 0; i + 1 < list.length; i += 1) {
    const [p, q] = [list[i], list[i + 1]];
    if (value <= q[a]) return p[b] + ((value - p[a]) / Math.max(1, q[a] - p[a])) * (q[b] - p[b]);
  }
  return list[list.length - 1][b];
};
const toEdit = (ms) => lookup(knots, ms, 0, 1);
const toFilm = (ms) => lookup(knots, ms, 1, 0);
for (const x of scenes) x.ms = toEdit(x.ms);
for (const x of taps) x.ms = toEdit(x.ms);
const endEdit = toEdit(endAt);
const endVoice = (voices.end?.seconds ?? 0) * 1000;
const total = endEdit + Math.max(3600, endVoice + 1000);
console.log(`Après montage : ${(total / 1000).toFixed(1)} s`);

// La bande son.
const wav = path.join(dir, 'son.wav');
mixTrack(wav, total / 1000, scenes.filter((x) => voices[x.id]?.samples.length).map((x) => ({ samples: voices[x.id].samples, at: x.ms / 1000 + 0.1 })), taps.map((x) => x.ms / 1000), keys.map((k) => toEdit(k) / 1000));

// Le montage, image par image.
const fonts = ['outfit-latin.woff2|Outfit|normal|400 700', 'instrument-serif-italic.woff2|Instrument Serif|italic|400']
  .map((f) => {
    const [file, family, style, weight] = f.split('|');
    const data = fs.readFileSync(path.join(root, 'apps/web/public/fonts', file)).toString('base64');
    return `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2')}`;
  })
  .join('');
const editor = await chromium.launch({ channel: 'chrome' });
const canvas = await editor.newPage({ viewport: { width: 1080, height: 1920 } });
await canvas.route('https://montage.salondz.invalid/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(here, 'compose.html'), 'utf8').replace('/*FONTS*/', fonts) }));
await canvas.goto('https://montage.salondz.invalid/');
await canvas.evaluate((o) => window.setup(o), {
  colors,
  profile,
  avatar: await fetch(photo(profile.photos[0])).then(async (r) => `data:image/webp;base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`).catch(() => null),
  scenes,
  taps,
  endAt: endEdit,
  pageAt: scenes.find((x) => x.id === 'page').ms,
});

const FPS = 30;
const encoder = spawn(ffmpeg, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', wav, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', output], { stdio: ['pipe', 'inherit', 'inherit'] });
const first = shots[0].s;
const offset = start / 1000 - first;
let shown = -1;
const frames = Math.round((total / 1000) * FPS);
for (let i = 0; i < frames; i += 1) {
  const ms = (i * 1000) / FPS;
  let k = shown;
  const film = toFilm(ms) / 1000;
  while (k + 1 < shots.length && shots[k + 1].s - first - offset <= film) k += 1;
  if (k !== shown && k >= 0) {
    await canvas.evaluate((d) => window.setShot(d), shots[k].data);
    shown = k;
  } else if (shown < 0) {
    await canvas.evaluate((d) => window.setShot(d), shots[0].data);
    shown = 0;
  }
  const jpeg = await canvas.evaluate((t) => window.frame(t), ms);
  if (!encoder.stdin.write(Buffer.from(jpeg, 'base64'))) await new Promise((ok) => encoder.stdin.once('drain', ok));
  if (i % 150 === 0) console.log(`Montage ${Math.round((i / frames) * 100)} %`);
}
encoder.stdin.end();
await new Promise((ok, ko) => encoder.on('close', (code) => (code ? ko(new Error(`ffmpeg ${code}`)) : ok())));
await editor.close();
console.log(`Vidéo prête : ${output} (${(total / 1000).toFixed(1)} s, ${(fs.statSync(output).size / 1e6).toFixed(1)} Mo)`);
