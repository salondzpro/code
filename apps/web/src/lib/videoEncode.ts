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
  return muxMp4(samples, description, size);
}

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

/** Une piste vidéo, une image tous les 1/30 s, les index devant les données : lecture immédiate. */
function muxMp4(samples: Sample[], avcC: Uint8Array, size: { width: number; height: number }): Blob {
  const count = samples.length;
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
  const moov = (offset: number) =>
    box(
      'moov',
      full('mvhd', 0, u32(0, 0, FPS, count, 0x10000), u16(0x100, 0), u32(0, 0), MATRIX, new Uint8Array(24), u32(2)),
      box(
        'trak',
        full('tkhd', 3, u32(0, 0, 1, 0, count, 0, 0), u16(0, 0, 0, 0), MATRIX, u32(size.width * 0x10000, size.height * 0x10000)),
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
    );
  const ftyp = box('ftyp', text('isom'), u32(0x200), text('isomiso2avc1mp41'));
  const head = ftyp.length + moov(0).length;
  const payload = samples.reduce((a, s) => a + s.data.length, 0);
  const parts = [ftyp, moov(head + 8), u32(payload + 8), text('mdat'), ...samples.map((s) => s.data)];
  return new Blob(parts as unknown as BlobPart[], { type: 'video/mp4' });
}
