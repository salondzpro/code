/**
 * Aperçu ANIMÉ d'une story : la même fonction de dessin que la vidéo partagée (`drawStoryFrame`), jouée
 * en boucle sur un canevas réduit. Immobile (image finale) quand `play` est faux ou que la personne a
 * demandé moins d'animations.
 */
import { useEffect, useRef, useState } from 'react';
import { STORY_H, STORY_MS, STORY_STILL, STORY_W, drawStoryFrame, type StoryArt } from '@/lib/storyArt';
import { storyArtOf, type StoryInput } from '@/lib/storyImage';
import { t } from '@/i18n';

/** Après la fin de l'animation, la story reste lisible un moment avant de reprendre. */
const LOOP_MS = STORY_MS + 1200;
const SCALE = 0.5;

export function StoryLive({ input, play, className }: { input: StoryInput | null; play: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [art, setArt] = useState<StoryArt | null>(null);
  // Hors de l'écran, l'animation s'arrête : rien ne tourne pour rien.
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    const c = canvas.current;
    if (!c || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setSeen(!!e?.isIntersecting));
    io.observe(c);
    return () => io.disconnect();
  }, []);
  const key = input ? JSON.stringify(input) : '';

  useEffect(() => {
    if (!input) return setArt(null);
    let dead = false;
    void storyArtOf(input).then((a) => !dead && setArt(a));
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g || !art) return;
    const draw = (ms: number) => {
      g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      drawStoryFrame(g, art, ms);
    };
    const still = !play || !seen || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      draw(STORY_STILL);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      draw((now - t0) % LOOP_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [art, play, seen]);

  return <canvas ref={canvas} className={className} width={STORY_W * SCALE} height={STORY_H * SCALE} role="img" aria-label={t('Aperçu de la story')} />;
}
