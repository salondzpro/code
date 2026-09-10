/**
 * Recadrage avant enregistrement (logo, photo de profil, avatar d'employé, couverture) : l'image se déplace au
 * doigt / à la souris dans un cadre au bon format, un curseur règle le zoom, « Valider » produit le fichier
 * recadré (WebP) qui est ensuite compressé et envoyé comme d'habitude. Sans dépendance : canvas natif.
 */
import { useEffect, useRef, useState } from 'react';
import { BottomSheet, Button } from './ui';

/** Format des photos de couverture (cartes marketplace, page publique). */
export const COVER_ASPECT = 16 / 10;

const OUT_WIDTH = { square: 900, cover: 1600 } as const;

export function ImageCropper({
  file,
  aspect = 1,
  round = false,
  title = 'Recadrer la photo',
  onCancel,
  onDone,
}: {
  file: File;
  /** Largeur / hauteur du cadre (1 = carré). */
  aspect?: number;
  /** Aperçu rond (logo, avatar) — le fichier produit reste carré. */
  round?: boolean;
  title?: string;
  onCancel: () => void;
  onDone: (cropped: File) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    // L'URL n'est libérée qu'une fois l'image chargée : en dev (StrictMode), l'effet est joué deux fois et une
    // révocation immédiate ferait échouer le premier chargement (erreur console « ERR_FILE_NOT_FOUND »).
    let loaded = false;
    let gone = false;
    const im = new Image();
    im.onload = () => {
      loaded = true;
      if (gone) URL.revokeObjectURL(u);
      else setImg(im);
    };
    im.onerror = () => {
      loaded = true;
      if (gone) URL.revokeObjectURL(u);
    };
    im.src = u;
    setZoom(1);
    setPos({ x: 0, y: 0 });
    return () => {
      gone = true;
      if (loaded) URL.revokeObjectURL(u);
    };
  }, [file]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setFrame({ w, h: Math.round(w / aspect) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  const base =
    img && frame.w ? Math.max(frame.w / img.naturalWidth, frame.h / img.naturalHeight) : 1;
  const scale = base * zoom;
  const dispW = img ? img.naturalWidth * scale : 0;
  const dispH = img ? img.naturalHeight * scale : 0;
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.max(-(dispW - frame.w) / 2, Math.min((dispW - frame.w) / 2, p.x)),
    y: Math.max(-(dispH - frame.h) / 2, Math.min((dispH - frame.h) / 2, p.y)),
  });
  const shown = clamp(pos);

  const validate = async () => {
    if (!img || !frame.w) return;
    setBusy(true);
    try {
      const outW = round || aspect === 1 ? OUT_WIDTH.square : OUT_WIDTH.cover;
      const outH = Math.round(outW / aspect);
      const sx = (dispW / 2 - frame.w / 2 - shown.x) / scale;
      const sy = (dispH / 2 - frame.h / 2 - shown.y) / scale;
      const sw = frame.w / scale;
      const sh = frame.h / scale;
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponible');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.86),
      );
      if (!blob) throw new Error('Recadrage impossible');
      onDone(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dim !z-40" onClick={onCancel} />
      <BottomSheet className="!z-50">
        <div className="text-center text-[1.125rem] font-bold tracking-[-0.4px]">{title}</div>
        <p className="p text-center text-[0.8125rem]">
          Déplacez la photo dans le cadre et ajustez le zoom.
        </p>
        <div
          ref={frameRef}
          className={`relative mx-auto w-full max-w-[22rem] select-none overflow-hidden bg-line ${round ? 'rounded-full' : 'rounded-[1rem]'}`}
          style={{
            height: frame.h || undefined,
            aspectRatio: `${aspect}`,
            touchAction: 'none',
            cursor: 'grab',
          }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY, px: shown.x, py: shown.y };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setPos(
              clamp({
                x: drag.current.px + (e.clientX - drag.current.x),
                y: drag.current.py + (e.clientY - drag.current.y),
              }),
            );
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          role="img"
          aria-label="Aperçu du recadrage"
        >
          {url && img && (
            <img
              src={url}
              alt=""
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: dispW,
                height: dispH,
                transform: `translate(calc(-50% + ${shown.x}px), calc(-50% + ${shown.y}px))`,
              }}
            />
          )}
        </div>
        <label className="flex items-center gap-3 text-[0.8125rem] text-muted">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-ink"
            aria-label="Zoom"
          />
        </label>
        <div className="g2">
          <Button variant="g" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => void validate()} disabled={busy || !img}>
            {busy ? 'Recadrage…' : 'Valider'}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
