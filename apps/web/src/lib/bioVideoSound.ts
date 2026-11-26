/**
 * LA BANDE SON DE « MA VIDÉO » (18 nov. 2026, demande du propriétaire : « des bruits de clic tout au
 * long, un petit fond de musique, des effets sonores et une voix off »).
 *
 * Tout est fabriqué sur le téléphone, dans un `OfflineAudioContext`, sans fichier de musique : aucune
 * licence à payer, aucun morceau d'un autre. Seule la VOIX OFF est un fichier, enregistré une fois par
 * langue et par type de salon (`public/video/voix/<langue>-<f|h>-<n>.mp3` : voix de femme pour un salon
 * de femmes, d'homme pour un salon d'hommes, et le tutoiement/vouvoiement de l'arabe accordé). Une
 * réplique manquante est simplement sautée : la vidéo garde musique et effets.
 *
 * Mixage : musique douce (pad + arpège + battement léger) baissée sous la voix, clic à chaque toucher du
 * curseur, souffle à chaque changement d'écran, frappe du clavier pendant la saisie, carillon de la
 * confirmation et de la fin.
 */
import type { BioSoundCues } from './bioVideo';

export const SOUND_RATE = 44100;
const CHANNELS = 2;

/** Les répliques, dans l'ordre ; `at` = moment souhaité (ms). Une réplique attend la fin de la précédente. */
export type VoiceLine = { at: number; file: string };

async function fetchClip(ctx: BaseAudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await ctx.decodeAudioData(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/* ------------------------------ Les effets ------------------------------ */

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = b.getChannelData(0);
  // Bruit pseudo-aléatoire déterministe : la même vidéo sonne pareil à chaque fabrication.
  let s = 12345;
  for (let i = 0; i < data.length; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (s / 0x3fffffff - 1) * 0.9;
  }
  return b;
}

function envGain(ctx: BaseAudioContext, at: number, peak: number, attack: number, decay: number, out: AudioNode) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(out);
  return g;
}

/** Le clic de souris : un petit claquement sec, deux couches (bruit filtré + tic aigu). */
function click(ctx: BaseAudioContext, noise: AudioBuffer, at: number, out: AudioNode) {
  const n = ctx.createBufferSource();
  n.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.value = 3800;
  hp.Q.value = 1.2;
  n.connect(hp);
  hp.connect(envGain(ctx, at, 0.9, 0.001, 0.035, out));
  n.start(at, (at * 0.37) % 0.5, 0.06);
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(1800, at);
  o.frequency.exponentialRampToValueAtTime(900, at + 0.03);
  o.connect(envGain(ctx, at, 0.35, 0.001, 0.04, out));
  o.start(at);
  o.stop(at + 0.08);
}

/** Le souffle d'un écran qui passe : bruit dont le filtre monte puis redescend. */
function whoosh(ctx: BaseAudioContext, noise: AudioBuffer, at: number, out: AudioNode, level = 0.32) {
  const n = ctx.createBufferSource();
  n.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(400, at);
  bp.frequency.exponentialRampToValueAtTime(2600, at + 0.18);
  bp.frequency.exponentialRampToValueAtTime(700, at + 0.42);
  n.connect(bp);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(level, at + 0.14);
  g.gain.linearRampToValueAtTime(0, at + 0.45);
  bp.connect(g);
  g.connect(out);
  n.start(at, 0.3, 0.5);
}

/** Une touche du clavier du téléphone. */
function key(ctx: BaseAudioContext, noise: AudioBuffer, at: number, out: AudioNode) {
  const n = ctx.createBufferSource();
  n.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2400 + ((at * 7919) % 1) * 900;
  bp.Q.value = 3;
  n.connect(bp);
  bp.connect(envGain(ctx, at, 0.28, 0.001, 0.025, out));
  n.start(at, 0.1, 0.04);
}

/** Carillon : notes claires qui s'éteignent lentement. */
function chime(ctx: BaseAudioContext, at: number, notes: number[], out: AudioNode, level = 0.22, gap = 0.09) {
  notes.forEach((f, i) => {
    const t = at + i * gap;
    [1, 2].forEach((h) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * h;
      o.connect(envGain(ctx, t, level / h / h, 0.005, 1.1, out));
      o.start(t);
      o.stop(t + 1.3);
    });
  });
}

/** « Pop » : le logo qui se pose. */
function pop(ctx: BaseAudioContext, at: number, out: AudioNode) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(220, at);
  o.frequency.exponentialRampToValueAtTime(880, at + 0.09);
  o.connect(envGain(ctx, at, 0.4, 0.005, 0.16, out));
  o.start(at);
  o.stop(at + 0.25);
}

/** Impact sourd (« boom » de bande-annonce) : la photo du salon qui apparaît. */
function impact(ctx: BaseAudioContext, noise: AudioBuffer, at: number, out: AudioNode) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(90, at);
  o.frequency.exponentialRampToValueAtTime(38, at + 0.6);
  o.connect(envGain(ctx, at, 0.75, 0.004, 0.9, out));
  o.start(at);
  o.stop(at + 1);
  const n = ctx.createBufferSource();
  n.buffer = noise;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  n.connect(lp);
  lp.connect(envGain(ctx, at, 0.25, 0.002, 0.35, out));
  n.start(at);
  n.stop(at + 0.5);
}

/** Montée (« riser ») : souffle filtré qui s'ouvre jusqu'à l'instant `at`, avant la confirmation. */
function riser(ctx: BaseAudioContext, noise: AudioBuffer, at: number, dur: number, out: AudioNode) {
  const from = Math.max(0, at - dur);
  const n = ctx.createBufferSource();
  n.buffer = noise;
  n.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(300, from);
  bp.frequency.exponentialRampToValueAtTime(5200, at);
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0.0001, from);
  gn.gain.exponentialRampToValueAtTime(0.16, at - 0.02);
  gn.gain.linearRampToValueAtTime(0, at + 0.05);
  n.connect(bp);
  bp.connect(gn);
  gn.connect(out);
  n.start(from);
  n.stop(at + 0.1);
}

/* ------------------------------ La musique ------------------------------ */

const BPM = 104;
const BEAT = 60 / BPM;
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** Progression lumineuse, quatre accords d'une mesure chacun (fa – do – ré mineur – si bémol). */
const CHORDS = [
  [53, 57, 60, 64],
  [48, 55, 59, 64],
  [50, 57, 60, 65],
  [46, 53, 57, 62],
];

function music(ctx: BaseAudioContext, noise: AudioBuffer, seconds: number, out: AudioNode) {
  /*
   * FOND MUSICAL DOUX (refonte du 26 nov. 2026, demande du propriétaire : « la musique ne doit pas
   * être trop forte ») : un piano électrique feutré (sinus + harmonique douce, léger trémolo), une
   * basse ronde et une pulsation à peine audible. Plus de nappe en dents de scie ni d'arpège brillant :
   * rien qui dispute la place à la voix. Tout passe sous un filtre à 2,8 kHz, la zone de la voix reste libre.
   */
  const bars = Math.ceil(seconds / (BEAT * 4)) + 1;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2800;
  tone.connect(out);
  const keys = ctx.createGain();
  keys.gain.value = 0.11;
  keys.connect(tone);
  // Trémolo lent : le piano « respire ».
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 4.2;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = 0.025;
  lfo.connect(lfoAmt);
  lfoAmt.connect(keys.gain);
  lfo.start(0);
  lfo.stop(seconds + 1);
  const note = (m: number, at: number, len: number, level: number) => {
    [
      [1, 'sine', level],
      [2, 'sine', level * 0.18],
    ].forEach(([mult, type, lv]) => {
      const o = ctx.createOscillator();
      o.type = type as OscillatorType;
      o.frequency.value = hz(m) * (mult as number);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(lv as number, at + 0.012);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, (lv as number) * 0.25), at + len * 0.6);
      g.gain.linearRampToValueAtTime(0, at + len);
      o.connect(g);
      g.connect(keys);
      o.start(at);
      o.stop(at + len + 0.05);
    });
  };
  for (let b = 0; b < bars; b += 1) {
    const chord = CHORDS[b % CHORDS.length]!;
    const t = b * BEAT * 4;
    // Accord plaqué au temps 1, repris en douceur au temps 3 (sur le contretemps).
    chord.forEach((m, i) => note(m, t + i * 0.018, BEAT * 2.2, 0.32));
    chord.slice(1).forEach((m, i) => note(m + 12, t + BEAT * 2.5 + i * 0.02, BEAT * 1.3, 0.12));
    // Basse ronde, discrète.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz(chord[0]! - 12);
    o.connect(envGain(ctx, t, 0.1, 0.02, BEAT * 3, tone));
    o.start(t);
    o.stop(t + BEAT * 4);
    // Pulsation feutrée sur 1 et 3, souffle de shaker sur les contretemps.
    for (let beat = 0; beat < 4; beat += 1) {
      const tk = t + beat * BEAT;
      if (beat % 2 === 0) {
        const k = ctx.createOscillator();
        k.type = 'sine';
        k.frequency.setValueAtTime(95, tk);
        k.frequency.exponentialRampToValueAtTime(42, tk + 0.14);
        k.connect(envGain(ctx, tk, 0.12, 0.003, 0.22, out));
        k.start(tk);
        k.stop(tk + 0.3);
      }
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      n.connect(hp);
      hp.connect(envGain(ctx, tk + BEAT / 2, 0.025, 0.004, 0.07, out));
      n.start(tk + BEAT / 2, (beat * 0.13) % 0.5, 0.1);
    }
  }
}

/* ------------------------------ Le mixage ------------------------------ */

/** Rend toute la bande son. `null` si le navigateur ne sait pas faire (la vidéo reste muette). */
export async function renderBioSound(cues: BioSoundCues, durationMs: number, voice: VoiceLine[]): Promise<AudioBuffer | null> {
  const Offline = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!Offline) return null;
  const seconds = durationMs / 1000;
  const ctx = new Offline(CHANNELS, Math.ceil(SOUND_RATE * seconds), SOUND_RATE);
  const noise = noiseBuffer(ctx, 1);

  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -14;
  master.ratio.value = 4;
  const outGain = ctx.createGain();
  outGain.gain.value = 0.95;
  master.connect(outGain);
  outGain.connect(ctx.destination);

  const fx = ctx.createGain();
  fx.gain.value = 0.8;
  fx.connect(master);

  // La musique entre en fondu, s'efface sous la voix, et sort en fondu.
  const musicBus = ctx.createGain();
  musicBus.connect(master);
  // Niveaux (26 nov. 2026) : fond nettement plus bas, et presque effacé sous la voix.
  const base = 0.3;
  const duck = 0.07;
  musicBus.gain.setValueAtTime(0, 0);
  musicBus.gain.linearRampToValueAtTime(base, 0.6);

  // Voix : chaque réplique attend la fin de la précédente, jamais deux voix l'une sur l'autre.
  const clips = await Promise.all(voice.map((v) => fetchClip(ctx, v.file)));
  const voiceBus = ctx.createGain();
  voiceBus.gain.value = 1.3;
  voiceBus.connect(master);
  let free = 0;
  const spans: [number, number][] = [];
  clips.forEach((clip, i) => {
    if (!clip) return;
    const start = Math.max(voice[i]!.at / 1000, free + 0.12);
    if (start >= seconds - 0.3) return;
    const src = ctx.createBufferSource();
    src.buffer = clip;
    src.connect(voiceBus);
    src.start(start);
    free = start + clip.duration;
    spans.push([start, Math.min(free, seconds)]);
  });
  spans.forEach(([a, b]) => {
    musicBus.gain.setValueAtTime(base, Math.max(0.6, a - 0.25));
    musicBus.gain.linearRampToValueAtTime(duck, Math.max(0.6, a - 0.05));
    musicBus.gain.setValueAtTime(duck, b);
    musicBus.gain.linearRampToValueAtTime(base, b + 0.35);
  });
  const fadeAt = Math.max(1, seconds - 1.6);
  musicBus.gain.setValueAtTime(spans.some(([a, b]) => fadeAt >= a && fadeAt <= b + 0.35) ? duck : base, fadeAt);
  musicBus.gain.linearRampToValueAtTime(0, seconds);
  music(ctx, noise, seconds, musicBus);

  const s = (ms: number) => ms / 1000;
  pop(ctx, s(cues.pop), fx);
  if (cues.impact != null) impact(ctx, noise, s(cues.impact), fx);
  if (cues.riser != null) riser(ctx, noise, s(cues.riser), 1.1, fx);
  cues.whooshes.forEach((ms) => whoosh(ctx, noise, s(ms), fx));
  // Mouvements de caméra : un souffle plus léger que les changements d'écran.
  (cues.zooms ?? []).forEach((ms) => whoosh(ctx, noise, s(ms), fx, 0.12));
  cues.taps.forEach((ms) => click(ctx, noise, s(ms), fx));
  cues.typing.forEach(([from, to, letters]) => {
    for (let i = 0; i < letters; i += 1) key(ctx, noise, s(from + ((to - from) * i) / Math.max(1, letters)), fx);
  });
  chime(ctx, s(cues.success), [hz(76), hz(83), hz(88)], fx);
  chime(ctx, s(cues.stores), [hz(81), hz(88)], fx, 0.16, 0.12);

  return ctx.startRendering();
}
