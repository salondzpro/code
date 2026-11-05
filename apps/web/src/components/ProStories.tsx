/**
 * Les ronds de l'accueil, comme des stories : « Ma vidéo » ouvre la vidéo à télécharger ou partager,
 * « Conseil » les conseils du jour. Un rond s'éteint une fois vu ; celui de la vidéo se rallume dès que
 * le lien, une prestation ou un prix change.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { Download, Play, Share2, Sparkles, X } from 'lucide-react';
import { addDaysToKey, dayChipLabelDZ, minutesToTime, toLocalDateKey } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { Button, I } from './ui';
import { BIO_VIDEO_MS, BIO_VIDEO_SIZE, bioVideoTypes, bioVideoVersion, drawBioFrame, loadBioVideo, type BioVideoData } from '@/lib/bioVideo';
import { proProfile, profilePhotos, profileQuestion } from '@/lib/proProfile';
import { proTips, type ProTip } from '@/lib/proTips';
import { saveImage, shareImage } from '@/lib/storyImage';
import { useStoryDefaultDay } from '@/lib/useStorySlots';
import { t } from '@/i18n';

const TIP_MS = 7000;

/** La vidéo faite pendant la session : on ne la refait que si ses données changent. */
const made = new Map<string, Blob>();

const seenKey = (kind: string, salonId: string) => `salondz:story:${kind}:${salonId}`;
function readSeen(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSeen(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* navigation privée : le rond restera allumé */
  }
}

/** Plein écran : la page ne défile plus derrière, Échap referme. */
function useFullScreen(onClose: () => void) {
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
}

function TipsViewer({ tips, photos, onClose }: { tips: ProTip[]; photos: string[]; onClose: () => void }) {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  useFullScreen(onClose);
  useEffect(() => {
    const id = window.setTimeout(() => (i + 1 < tips.length ? setI(i + 1) : onClose()), TIP_MS);
    return () => window.clearTimeout(id);
  }, [i, tips.length, onClose]);
  const tip = tips[i]!;
  const step = (n: number) => (i + n < 0 ? setI(0) : i + n >= tips.length ? onClose() : setI(i + n));

  return createPortal(
    <div className="sv tip" role="dialog" aria-modal="true" aria-label={t('Conseil')}>
      <img className="sv-i" src={photos[i % photos.length]} alt="" />
      <div className="sv-b" aria-hidden>
        {tips.map((x, n) => (
          <i key={x.id}>{n < i ? <b className="full" /> : n === i ? <b key={i} className="run" style={{ animationDuration: `${TIP_MS}ms` }} /> : null}</i>
        ))}
      </div>
      <header className="sv-h">
        <span>{t('Conseil')}</span>
        <button type="button" aria-label={t('Fermer')} onClick={onClose}>
          <I icon={X} size={22} />
        </button>
      </header>
      <button type="button" className="sv-z p" aria-label={t('Précédent')} onClick={() => step(-1)} />
      <button type="button" className="sv-z n" aria-label={t('Suivant')} onClick={() => step(1)} />
      <div className="sv-t">
        <h2>{tip.title}</h2>
        <p>{tip.body}</p>
        {tip.to && (
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(tip.to!);
            }}
          >
            {tip.action}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

function VideoViewer({ load, version, file, onClose }: { load: () => Promise<BioVideoData>; version: string; file: string; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const bar = useRef<HTMLElement | null>(null);
  const [video, setVideo] = useState<Blob | null>(() => made.get(version) ?? null);
  const [noVideo, setNoVideo] = useState(() => !bioVideoTypes().length);
  const [busy, setBusy] = useState(false);
  useFullScreen(onClose);

  // La vidéo se joue, et s'enregistre pendant sa première lecture : à la fin, elle est prête à partager.
  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    let dead = false;
    let data: BioVideoData;
    let raf = 0;
    let recorder: MediaRecorder | null = null;
    const types = bioVideoTypes();
    let record = !made.has(version);
    const play = () => {
      recorder = null;
      const type = record ? types[0] : undefined;
      record = false;
      if (type && c.captureStream) {
        const parts: Blob[] = [];
        recorder = new MediaRecorder(c.captureStream(30), { mimeType: type, videoBitsPerSecond: 2_500_000 });
        recorder.ondataavailable = (e) => {
          if (e.data.size) parts.push(e.data);
        };
        recorder.onstop = () => {
          if (dead) return;
          const blob = new Blob(parts, { type: type.split(';')[0] });
          // Un fichier vide ne se partage jamais : on passe au format suivant à la prochaine lecture.
          if (!blob.size) {
            types.shift();
            record = true;
            if (!types.length) setNoVideo(true);
            return;
          }
          made.set(version, blob);
          setVideo(blob);
        };
        recorder.start();
      }
      const start = performance.now();
      const tick = (now: number) => {
        // Le premier instant peut précéder `start` de quelques millisecondes.
        const ms = Math.min(Math.max(0, now - start), BIO_VIDEO_MS);
        drawBioFrame(g, ms, data);
        if (bar.current) bar.current.style.transform = `scaleX(${ms / BIO_VIDEO_MS})`;
        if (ms < BIO_VIDEO_MS) {
          raf = requestAnimationFrame(tick);
          return;
        }
        if (recorder?.state === 'recording') recorder.stop();
        play();
      };
      raf = requestAnimationFrame(tick);
    };
    // Le tout premier enregistrement d'un navigateur sort vide : un court essai réveille l'encodeur.
    const warmUp = () =>
      new Promise<void>((done) => {
        const type = types[0];
        if (!record || !type || !c.captureStream) return done();
        const probe = new MediaRecorder(c.captureStream(30), { mimeType: type });
        let frame = 0;
        const id = window.setInterval(() => {
          drawBioFrame(g, (frame += 1) * 40, data);
          if (frame < 15) return;
          window.clearInterval(id);
          probe.onstop = () => done();
          probe.stop();
        }, 40);
        probe.start();
      });
    void Promise.all([load(), document.fonts.load('600 60px Outfit').catch(() => undefined)])
      .then(([d]) => {
        data = d;
        return warmUp();
      })
      .then(() => {
        if (!dead) play();
      });
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      if (recorder?.state === 'recording') recorder.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const name = video ? `${file}.${video.type.includes('mp4') ? 'mp4' : 'webm'}` : file;
  const share = async () => {
    if (!video || busy) return;
    setBusy(true);
    try {
      await shareImage(video, name);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="sv vid" role="dialog" aria-modal="true" aria-label={t('Ma vidéo')}>
      <div className="sv-b" aria-hidden>
        <i>
          <b ref={bar} className="live" />
        </i>
      </div>
      <header className="sv-h">
        <span>{t('Ma vidéo')}</span>
        <button type="button" aria-label={t('Fermer')} onClick={onClose}>
          <I icon={X} size={22} />
        </button>
      </header>
      <div className="sv-v">
        <canvas ref={canvas} {...BIO_VIDEO_SIZE} aria-label={t('Ma vidéo')} />
      </div>
      <div className="sv-a">
        {noVideo ? (
          <p>{t('Ce téléphone ne sait pas créer la vidéo.')}</p>
        ) : (
          <>
            <Button sm className="ag9-n" disabled={!video} onClick={() => video && void saveImage(video, name)}>
              <I icon={Download} size={18} /> {video ? t('Télécharger') : t('Création…')}
            </Button>
            <Button sm className="ag9-b" disabled={!video} loading={busy} onClick={() => void share()}>
              <I icon={Share2} size={18} /> {t('Partager')}
            </Button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ProStoryRail({ salon, short, pending }: { salon: SalonOwnerView; short: string; pending: number }) {
  const today = toLocalDateKey();
  const { date, hours } = useStoryDefaultDay(salon);
  const [open, setOpen] = useState<'tips' | 'video' | null>(null);
  const [, refresh] = useState(0);
  const close = useMemo(() => () => setOpen(null), []);

  const dayIndex = Math.floor(Date.parse(`${today}T12:00:00Z`) / 86_400_000);
  const question = profileQuestion(proProfile(salon));
  const tips = useMemo(() => proTips(salon, pending, dayIndex, question), [salon, pending, dayIndex, question]);
  const photos = useMemo(() => profilePhotos(salon), [salon]);
  const loadVideo = () => {
    const label = date === today ? t("Aujourd'hui") : date === addDaysToKey(today, 1) ? t('Demain') : dayChipLabelDZ(date);
    const days = Array.from({ length: 5 }, (_, i) => dayChipLabelDZ(addDaysToKey(date, i)));
    return loadBioVideo(salon, short, label, days, hours.map((h) => minutesToTime(h.start)));
  };
  const version = useMemo(() => bioVideoVersion(salon, short), [salon, short]);
  const tipsKey = seenKey('tips', salon.id);
  const videoKey = seenKey('video', salon.id);
  const see = (kind: 'tips' | 'video') => {
    writeSeen(kind === 'tips' ? tipsKey : videoKey, kind === 'tips' ? today : version);
    refresh((n) => n + 1);
    setOpen(kind);
  };

  return (
    <>
      <div className="h12-rail" role="group" aria-label={t('Stories')}>
        <button type="button" onClick={() => see('video')}>
          <span className={`h12-sv${readSeen(videoKey) === version ? '' : ' on'}`}>
            <img src={photos[0]} alt="" />
            <i>
              <I icon={Play} size={18} />
            </i>
          </span>
          {t('Ma vidéo')}
        </button>
        <button type="button" onClick={() => see('tips')}>
          <span className={`h12-sv${readSeen(tipsKey) === today ? '' : ' on'}`}>
            <I icon={Sparkles} size={22} />
          </span>
          {t('Conseil')}
        </button>
      </div>
      {open === 'tips' && <TipsViewer tips={tips} photos={photos} onClose={close} />}
      {open === 'video' && <VideoViewer load={loadVideo} version={version} file={`salondz-video-${salon.slug}`} onClose={close} />}
    </>
  );
}
