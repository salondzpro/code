/**
 * Le fichier à partager, préparé D'AVANCE : la vidéo se fabrique pendant qu'on regarde l'aperçu, pour
 * qu'un toucher sur « Partager » ouvre aussitôt la feuille du téléphone (sur le site, le navigateur
 * refuse d'ouvrir le partage plusieurs secondes après le geste). Sans encodeur vidéo, l'image fixe.
 */
import { useEffect, useState } from 'react';
import { drawStory, makeStoryVideo, type StoryInput } from './storyImage';

const made = new Map<string, Blob>();
function keep(key: string, blob: Blob) {
  made.set(key, blob);
  if (made.size > 8) made.delete(made.keys().next().value!);
}

export type StoryFile = { blob: Blob | null; progress: number; video: boolean };

export function useStoryFile(input: StoryInput | null, video: boolean): StoryFile {
  const key = input ? `${video ? 'v' : 'i'}|${JSON.stringify(input)}` : '';
  const [state, setState] = useState<{ key: string; blob: Blob | null; progress: number }>({ key: '', blob: null, progress: 0 });

  useEffect(() => {
    if (!input) return;
    const hit = made.get(key);
    if (hit) return setState({ key, blob: hit, progress: 1 });
    let dead = false;
    setState({ key, blob: null, progress: 0 });
    // On attend que la personne ait fini de cocher ses heures avant de lancer l'encodage.
    const timer = window.setTimeout(
      async () => {
        let shown = 0;
        let blob = video
          ? await makeStoryVideo(
              input,
              (r) => {
                const pct = Math.floor(r * 100);
                if (!dead && pct !== shown) {
                  shown = pct;
                  setState({ key, blob: null, progress: r });
                }
              },
              () => dead,
            )
          : null;
        if (dead) return;
        if (!blob) blob = await drawStory(input);
        if (dead || !blob) return;
        keep(key, blob);
        setState({ key, blob, progress: 1 });
      },
      video ? 700 : 150,
    );
    return () => {
      dead = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const mine = state.key === key ? state : { blob: null, progress: 0 };
  return { blob: mine.blob, progress: mine.progress, video: mine.blob?.type === 'video/mp4' };
}

export const storyFileName = (slug: string, blob: Blob) => `salondz-story-${slug}.${blob.type === 'video/mp4' ? 'mp4' : 'png'}`;
