/**
 * Fabrique un vrai MP4 image par image, plus vite que le temps réel. Un enregistrement de l'écran
 * (`MediaRecorder`) perd les images tant que l'encodeur démarre : une vidéo de 27 s sortait avec 15 s de
 * figé. Ici chaque image est dessinée puis encodée, aucune ne peut manquer. Le fichier est un MP4
 * classique, non fragmenté : c'est ce que les réseaux acceptent le mieux. Écrit à la main pour ne pas
 * ajouter de dépendance : `apps/web/package.json` modifié sur `main` part en boutique.
 */
const FPS = 30;
const CODECS = ['avc1.42E01F', 'avc1.4D401F', 'avc1.64001F'];
const BITRATE = 5_000_000;
const KEY_EVERY = FPS * 2;

type Sample = { data: Uint8Array; key: boolean };

/** Rend `null` si le téléphone ne sait pas faire : l'appelant passe alors à l'enregistrement. */
export async function encodeVideo(
  size: { width: number; height: number },
  durationMs: number,
  draw: (g: CanvasRenderingContext2D, ms: number) => void,
  onProgress: (ratio: number) => void,
  stopped: () => boolean,
  /** Bande son facultative : sans encodeur audio sur le téléphone, la vidéo sort muette. */
  audio: AudioBuffer | null = null,
): Promise<Blob | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  let config: VideoEncoderConfig | null = null;
  for (const codec of CODECS) {
    const c: VideoEncoderConfig = { codec, ...size, bitrate: BITRATE, framerate: FPS, avc: { format: 'avc' } };
    const support = await VideoEncoder.isConfigSupported(c).catch(() => null);
    if (support?.supported) {
      config = c;
      break;
    }
  }
  if (!config) return null;

  const samples: Sample[] = [];
  let description: Uint8Array | null = null;
  let failed = false;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      samples.push({ data, key: chunk.type === 'key' });
      const d = meta?.decoderConfig?.description;
      if (d) description = ArrayBuffer.isView(d) ? new Uint8Array(d.buffer as ArrayBuffer, d.byteOffset, d.byteLength) : new Uint8Array(d as ArrayBuffer);
    },
    error: () => {
      failed = true;
    },
  });
  encoder.configure(config);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const total = Math.round((durationMs / 1000) * FPS);
  for (let i = 0; i < total; i += 1) {
    if (stopped() || failed) {
      if (encoder.state !== 'closed') encoder.close();
      return null;
    }
    draw(g, (i * 1000) / FPS);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1_000_000) / FPS), duration: Math.round(1_000_000 / FPS) });
    encoder.encode(frame, { keyFrame: i % KEY_EVERY === 0 });
    frame.close();
    // On laisse respirer l'écran, et l'encodeur rattraper son retard.
    while (encoder.encodeQueueSize > 4) await new Promise((ok) => setTimeout(ok, 4));
    if (i % 6 === 0) {
      onProgress(i / total);
      await new Promise((ok) => setTimeout(ok, 0));
    }
  }
  await encoder.flush();
  encoder.close();
  if (failed || !description || samples.length !== total) return null;
  const sound = audio ? await encodeAudio(audio).catch(() => null) : null;
  return muxMp4(samples, description, size, sound);
}

/* ------------------------------ Le son (AAC) ------------------------------ */

type AudioTrack = { samples: Uint8Array[]; rate: number; channels: number };
const AAC_FRAME = 1024;

async function encodeAudio(buffer: AudioBuffer): Promise<AudioTrack | null> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return null;
  const rate = buffer.sampleRate;
  const channels = Math.min(2, buffer.numberOfChannels);
  const config: AudioEncoderConfig = { codec: 'mp4a.40.2', sampleRate: rate, numberOfChannels: channels, bitrate: 128_000 };
  const support = await AudioEncoder.isConfigSupported(config).catch(() => null);
  if (!support?.supported) return null;
  const samples: Uint8Array[] = [];
  let failed = false;
  const encoder = new AudioEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      samples.push(data);
    },
    error: () => {
      failed = true;
    },
  });
  encoder.configure(config);
  const step = AAC_FRAME * 8;
  for (let at = 0; at < buffer.length; at += step) {
    const n = Math.min(step, buffer.length - at);
    const planar = new Float32Array(n * channels);
    for (let c = 0; c < channels; c += 1) planar.set(buffer.getChannelData(c).subarray(at, at + n), c * n);
    const data = new AudioData({ format: 'f32-planar', sampleRate: rate, numberOfFrames: n, numberOfChannels: channels, timestamp: Math.round((at / rate) * 1_000_000), data: planar });
    encoder.encode(data);
    data.close();
    if (failed) break;
  }
  await encoder.flush();
  encoder.close();
  // Le flux brut (sans en-têtes ADTS) est ce que le MP4 attend ; un flux à en-têtes serait illisible.
  if (failed || !samples.length || (samples[0]![0] === 0xff && (samples[0]![1]! & 0xf0) === 0xf0)) return null;
  return { samples, rate, channels };
}

/** AudioSpecificConfig : AAC-LC, fréquence, nombre de voies. */
function audioConfig(rate: number, channels: number): Uint8Array {
  const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  const index = Math.max(0, rates.indexOf(rate));
  return Uint8Array.from([(2 << 3) | (index >> 1), ((index & 1) << 7) | (channels << 3)]);
}

const descriptor = (tag: number, ...parts: Uint8Array[]) => {
  const body = join(parts);
  return join([Uint8Array.from([tag, body.length]), body]);
};

const text = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
function u32(...values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((v, i) => view.setUint32(i * 4, v));
  return out;
}
function u16(...values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 2);
  const view = new DataView(out.buffer);
  values.forEach((v, i) => view.setUint16(i * 2, v));
  return out;
}
function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
const box = (type: string, ...parts: Uint8Array[]) => {
  const body = join(parts);
  return join([u32(body.length + 8), text(type), body]);
};
const full = (type: string, flags: number, ...parts: Uint8Array[]) => box(type, u32(flags), ...parts);
const MATRIX = u32(0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000);

/**
 * Une piste vidéo (une image tous les 1/30 s) et, s'il y en a, une piste son AAC ; les index devant les
 * données : lecture immédiate. Les deux pistes sont deux blocs à la suite dans `mdat`.
 */
function muxMp4(samples: Sample[], avcC: Uint8Array, size: { width: number; height: number }, sound: AudioTrack | null): Blob {
  const count = samples.length;
  const movieMs = Math.round((count * 1000) / FPS);
  const soundTrak = (offset: number) => {
    if (!sound) return new Uint8Array(0);
    const n = sound.samples.length;
    const units = n * AAC_FRAME;
    const esds = full(
      'esds',
      0,
      descriptor(
        0x03,
        u16(2),
        Uint8Array.from([0]),
        descriptor(0x04, Uint8Array.from([0x40, 0x15, 0, 0, 0]), u32(128_000, 128_000), descriptor(0x05, audioConfig(sound.rate, sound.channels))),
        descriptor(0x06, Uint8Array.from([0x02])),
      ),
    );
    const mp4a = box('mp4a', new Uint8Array(6), u16(1), u32(0, 0), u16(sound.channels, 16, 0, 0), u32(sound.rate * 0x10000), esds);
    return box(
      'trak',
      full('tkhd', 3, u32(0, 0, 2, 0, Math.min(movieMs, Math.round((units * 1000) / sound.rate)), 0, 0), u16(0, 1, 0x100, 0), MATRIX, u32(0, 0)),
      box(
        'mdia',
        full('mdhd', 0, u32(0, 0, sound.rate, units), u16(0x55c4, 0)),
        full('hdlr', 0, u32(0), text('soun'), new Uint8Array(12), text('SalonDZ\0')),
        box(
          'minf',
          full('smhd', 0, u16(0, 0)),
          box('dinf', full('dref', 0, u32(1), full('url ', 1))),
          box(
            'stbl',
            full('stsd', 0, u32(1), mp4a),
            full('stts', 0, u32(1, n, AAC_FRAME)),
            full('stsc', 0, u32(1, 1, n, 1)),
            full('stsz', 0, u32(0, n, ...sound.samples.map((s) => s.length))),
            full('stco', 0, u32(1, offset)),
          ),
        ),
      ),
    );
  };
  const avc1 = box(
    'avc1',
    new Uint8Array(6),
    u16(1),
    new Uint8Array(16),
    u16(size.width, size.height),
    u32(0x480000, 0x480000, 0),
    u16(1),
    new Uint8Array(32),
    u16(0x18, 0xffff),
    box('avcC', avcC),
  );
  const keys = samples.flatMap((s, i) => (s.key ? [i + 1] : []));
  const videoBytes = samples.reduce((a, s) => a + s.data.length, 0);
  const moov = (offset: number) =>
    box(
      'moov',
      full('mvhd', 0, u32(0, 0, 1000, movieMs, 0x10000), u16(0x100, 0), u32(0, 0), MATRIX, new Uint8Array(24), u32(sound ? 3 : 2)),
      box(
        'trak',
        full('tkhd', 3, u32(0, 0, 1, 0, movieMs, 0, 0), u16(0, 0, 0, 0), MATRIX, u32(size.width * 0x10000, size.height * 0x10000)),
        box(
          'mdia',
          full('mdhd', 0, u32(0, 0, FPS, count), u16(0x55c4, 0)),
          full('hdlr', 0, u32(0), text('vide'), new Uint8Array(12), text('SalonDZ\0')),
          box(
            'minf',
            full('vmhd', 1, new Uint8Array(8)),
            box('dinf', full('dref', 0, u32(1), full('url ', 1))),
            box(
              'stbl',
              full('stsd', 0, u32(1), avc1),
              full('stts', 0, u32(1, count, 1)),
              full('stss', 0, u32(keys.length, ...keys)),
              full('stsc', 0, u32(1, 1, count, 1)),
              full('stsz', 0, u32(0, count, ...samples.map((s) => s.data.length))),
              full('stco', 0, u32(1, offset)),
            ),
          ),
        ),
      ),
      soundTrak(offset + videoBytes),
    );
  const ftyp = box('ftyp', text('isom'), u32(0x200), text('isomiso2avc1mp41'));
  const head = ftyp.length + moov(0).length;
  const soundData = sound?.samples ?? [];
  const payload = videoBytes + soundData.reduce((a, s) => a + s.length, 0);
  const parts = [ftyp, moov(head + 8), u32(payload + 8), text('mdat'), ...samples.map((s) => s.data), ...soundData];
  return new Blob(parts as unknown as BlobPart[], { type: 'video/mp4' });
}
