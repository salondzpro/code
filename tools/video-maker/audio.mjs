/**
 * Le son. Les clics sont calculés ici : aucun fichier à acheter. La voix passe par un fournisseur au choix.
 * `elevenlabs` : voix humaine, exige ELEVENLABS_API_KEY et ELEVENLABS_VOICE_ID dans le `.env`.
 * `windows` : voix de Windows, robotique, seulement pour caler les temps. `none` : clics seuls.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';

const run = promisify(execFile);
export const RATE = 44100;

async function speakWindows(text, file) {
  const script = `Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $v=$s.GetInstalledVoices()|?{$_.VoiceInfo.Culture.Name -like 'fr*'}|select -First 1; if($v){$s.SelectVoice($v.VoiceInfo.Name)}; $s.Rate=1; $s.SetOutputToWaveFile('${file.replace(/'/g, "''")}'); $s.Speak([IO.File]::ReadAllText('${file}.txt',[Text.Encoding]::UTF8)); $s.Dispose()`;
  fs.writeFileSync(`${file}.txt`, text, 'utf8');
  await run('powershell.exe', ['-NoProfile', '-Command', script]);
  fs.rmSync(`${file}.txt`);
}

async function speakElevenLabs(text, file) {
  const { ELEVENLABS_API_KEY: key, ELEVENLABS_VOICE_ID: voice } = process.env;
  if (!key || !voice) throw new Error('Voix elevenlabs : ELEVENLABS_API_KEY et ELEVENLABS_VOICE_ID manquent dans le .env');
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!r.ok) throw new Error(`Voix elevenlabs : réponse ${r.status}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

/** Une voix mono en nombres de -1 à 1. */
async function decode(file) {
  const raw = `${file}.f32`;
  await run(ffmpeg, ['-y', '-v', 'error', '-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', raw]);
  const b = fs.readFileSync(raw);
  fs.rmSync(raw);
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
}

export async function makeVoices(lines, dir, provider) {
  const out = {};
  for (const [id, text] of Object.entries(lines)) {
    if (provider === 'none') {
      out[id] = { samples: new Float32Array(0), seconds: 0 };
      continue;
    }
    const file = path.join(dir, `voix-${id}.${provider === 'windows' ? 'wav' : 'mp3'}`);
    await (provider === 'windows' ? speakWindows : speakElevenLabs)(text, file);
    const samples = await decode(file);
    out[id] = { samples, seconds: samples.length / RATE };
  }
  return out;
}

/** Un clic : un petit choc, puis un son bref qui s'éteint. */
function click(volume, pitch, ms) {
  const n = Math.round((RATE * ms) / 1000);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = i / RATE;
    const env = Math.exp(-x * (5000 / ms));
    out[i] = volume * env * (0.55 * Math.sin(2 * Math.PI * pitch * x) + 0.45 * (Math.random() * 2 - 1) * Math.exp(-x * 900));
  }
  return out;
}

function add(track, samples, seconds, gain = 1) {
  const at = Math.round(seconds * RATE);
  for (let i = 0; i < samples.length && at + i < track.length; i += 1) track[at + i] += samples[i] * gain;
}

/** La bande son complète : voix aux débuts de scène, clics aux gestes. */
export function mixTrack(file, seconds, voices, taps, keys) {
  const track = new Float32Array(Math.ceil(seconds * RATE));
  const tap = click(0.55, 1900, 45);
  const key = click(0.22, 2600, 22);
  for (const v of voices) add(track, v.samples, v.at, 0.95);
  for (const s of taps) add(track, tap, s);
  for (const s of keys) add(track, key, s);
  const pcm = Buffer.alloc(track.length * 2);
  track.forEach((v, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([head, pcm]));
}
