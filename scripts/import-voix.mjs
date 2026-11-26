/**
 * IMPORT DE LA VOIX OFF ENREGISTRÉE de la vidéo « Ma pub » (26 nov. 2026).
 *
 *   node scripts/import-voix.mjs phrase1.ogg phrase2.ogg … phrase7.ogg
 *
 * Sept fichiers, DANS L'ORDRE des phrases de `VOIX` (lib/bioVideo.ts) — tout format que Chrome sait
 * lire : notes vocales WhatsApp (.ogg/.opus), .m4a, .mp3, .wav. Pour chacun : silences du début et de
 * la fin coupés, grave nettoyé (passe-haut 80 Hz), voix compressée et mise au même niveau, puis WAV
 * mono 24 kHz dans `apps/web/public/video/voix/voix-<n>.wav`. Écrit `voix.json` (fichiers + durées,
 * lus par la vidéo pour caler les sous-titres) et `src/lib/voixVersion.ts` (les vidéos sont refaites).
 * Un seul fichier contenant les 7 phrases à la suite est aussi accepté : il est découpé aux silences.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web');
const OUT = path.join(ROOT, 'public', 'video', 'voix');
const RATE = 24000;
const N = 7;
// `--genre h|f` : voix des salons d'hommes (h) ou de femmes (f) ; sans : la même pour les deux.
const args = process.argv.slice(2);
const gi = args.indexOf('--genre');
const genre = gi >= 0 ? args[gi + 1] : null;
if (gi >= 0 && genre !== 'h' && genre !== 'f') {
  console.error('--genre h ou f');
  process.exit(1);
}
const fichiers = gi >= 0 ? args.filter((_, i) => i !== gi && i !== gi + 1) : args;
if (fichiers.length !== 1 && fichiers.length !== N) {
  console.error(`Donnez ${N} fichiers (une phrase chacun), ou un seul fichier avec les ${N} phrases à la suite.`);
  process.exit(1);
}

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
await p.setContent('<html></html>');
const resultats = await p.evaluate(
  async ({ datas, RATE, N }) => {
    const ctx = new AudioContext();
    const decode = async (b64) => ctx.decodeAudioData(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer);
    /** Mono, 24 kHz, passe-haut 80 Hz, compresseur, normalisé à −1 dBFS en crête. */
    const traiter = async (buf) => {
      const off = new OfflineAudioContext(1, Math.ceil(buf.duration * RATE), RATE);
      const src = off.createBufferSource();
      src.buffer = buf;
      const hp = off.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 80;
      const presence = off.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 3200;
      presence.gain.value = 2.5;
      const comp = off.createDynamicsCompressor();
      comp.threshold.value = -22;
      comp.ratio.value = 3.5;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      src.connect(hp).connect(presence).connect(comp).connect(off.destination);
      src.start();
      const r = await off.startRendering();
      const x = r.getChannelData(0);
      let peak = 0;
      for (const v of x) peak = Math.max(peak, Math.abs(v));
      const k = peak > 0 ? 0.89 / peak : 1;
      return Float32Array.from(x, (v) => v * k);
    };
    /** Coupe les silences du début et de la fin (seuil −40 dB, 80 ms de marge). */
    const rogner = (x) => {
      const seuil = 0.01;
      const marge = Math.round(0.08 * RATE);
      let a = 0;
      while (a < x.length && Math.abs(x[a]) < seuil) a++;
      let z = x.length - 1;
      while (z > a && Math.abs(x[z]) < seuil) z--;
      return x.slice(Math.max(0, a - marge), Math.min(x.length, z + marge));
    };
    /** Un seul fichier : découpé aux N−1 plus longs silences (≥ 350 ms). */
    const decouper = (x) => {
      const fen = Math.round(0.02 * RATE);
      const silences = [];
      let debut = -1;
      for (let i = 0; i < x.length; i += fen) {
        let e = 0;
        for (let j = i; j < Math.min(x.length, i + fen); j++) e = Math.max(e, Math.abs(x[j]));
        if (e < 0.02) {
          if (debut < 0) debut = i;
        } else if (debut >= 0) {
          if (i - debut > 0.35 * RATE) silences.push([debut, i]);
          debut = -1;
        }
      }
      const coupes = silences.sort((a, b) => b[1] - b[0] - (a[1] - a[0])).slice(0, N - 1).map(([a, z]) => Math.round((a + z) / 2)).sort((a, b) => a - b);
      if (coupes.length < N - 1) throw new Error(`Seulement ${coupes.length + 1} phrases repérées : laissez une pause nette entre les phrases.`);
      const bornes = [0, ...coupes, x.length];
      return bornes.slice(0, -1).map((a, i) => x.slice(a, bornes[i + 1]));
    };
    const bufs = await Promise.all(datas.map(decode));
    let morceaux = await Promise.all(bufs.map(traiter));
    if (morceaux.length === 1) morceaux = decouper(morceaux[0]);
    return morceaux.map((x) => {
      const y = rogner(x);
      return { dur: Math.round((y.length / RATE) * 1000), pcm: Array.from(y) };
    });
  },
  { datas: fichiers.map((f) => fs.readFileSync(f).toString('base64')), RATE, N },
);
await b.close();

/** WAV PCM 16 bits mono. */
function wav(pcm) {
  const data = Buffer.alloc(pcm.length * 2);
  pcm.forEach((v, i) => data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

fs.mkdirSync(OUT, { recursive: true });
const hash = crypto.createHash('sha256');
const lignes = resultats.map((r, i) => {
  const file = `voix-${genre ? `${genre}-` : ''}${i + 1}.wav`;
  const buf = wav(r.pcm);
  hash.update(buf);
  fs.writeFileSync(path.join(OUT, file), buf);
  console.log(`${file}  ${(r.dur / 1000).toFixed(2)} s  ${Math.round(buf.length / 1024)} ko`);
  return { file, dur: r.dur };
});
// voix.json : { h: [...], f: [...] } — un genre importé ne remplace que le sien.
const cheminJson = path.join(OUT, 'voix.json');
let index = {};
try {
  index = JSON.parse(fs.readFileSync(cheminJson, 'utf8'));
} catch {
  /* premier import */
}
delete index.lignes;
for (const g of genre ? [genre] : ['h', 'f']) index[g] = lignes;
fs.writeFileSync(cheminJson, JSON.stringify(index, null, 2) + '\n');
hash.update(JSON.stringify(index));
const version = hash.digest('hex').slice(0, 12);
fs.writeFileSync(
  path.join(ROOT, 'src', 'lib', 'voixVersion.ts'),
  `/** Empreinte de l'enregistrement de la voix off : écrite par \`scripts/import-voix.mjs\`. Change → vidéos refaites. */\nexport const VOIX_VERSION = '${version}';\n`,
);
console.log(`voix.json écrit, version ${version}`);
