/**
 * PRO-F 10 — Étape 8 / Mon salon → « Réalisations » : les photos du travail réel (coupes, coiffures, barbes,
 * colorations, ongles…), plusieurs à la fois, sans lien avec une prestation. Section séparée des couvertures
 * (Photos du salon) et de l'image unique de chaque prestation. Réutilisé en réglage (`settings`).
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, X } from 'lucide-react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { SALON_MAX_WORKS } from '@salondz/constants';
import { uploadSalonPhoto } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { I, InfoBox } from '@/components/ui';
import { Screen, SHEET_PAD, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, stepPath } from './Shared';

export function Step8Works({ settings }: { settings?: boolean }) {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { setWorks } = useProSalonMutations();
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!salon) return <Splash />;
  const works = salon.works;
  const room = Math.max(0, SALON_MAX_WORKS - works.length);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, room))
        urls.push(await uploadSalonPhoto(salon.id, f));
      await setWorks.mutateAsync([
        ...works.map((p) => ({ url: p.url })),
        ...urls.map((url) => ({ url })),
      ]);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (url: string) => {
    setError(null);
    try {
      await setWorks.mutateAsync(works.filter((p) => p.url !== url).map((p) => ({ url: p.url })));
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={settings ? NAV_PAD : SHEET_PAD} gap={16}>
      <StepBar
        step={8}
        backTo={settings ? '/pro/mon-salon' : stepPath(6)}
        right={settings ? 'Mon salon' : undefined}
      />
      <div>
        <h1 className="h1">{settings ? 'Réalisations' : 'Vos réalisations'}</h1>
        <p className="p mt-2">Vos photos de travail, visibles dans l'onglet « Réalisations ».</p>
      </div>
      <div className="g3">
        {works.map((w) => (
          <div key={w.id} className="relative aspect-square overflow-hidden rounded-[1rem] bg-line">
            <img src={w.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label="Retirer"
              onClick={() => void remove(w.url)}
              disabled={setWorks.isPending}
            >
              <I icon={X} size={14} />
            </button>
          </div>
        ))}
        {room > 0 && (
          <button
            type="button"
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[1rem] border border-dashed border-line bg-fill text-subtle"
            onClick={() => input.current?.click()}
            disabled={busy}
            aria-label="Ajouter des réalisations"
          >
            <I icon={Plus} size={26} />
            <span className="text-[0.875rem]">{busy ? 'Envoi…' : 'Ajouter'}</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = '';
        }}
      />
      <InfoBox>
        {works.length}/{SALON_MAX_WORKS} photos. Chaque prestation garde une seule image
        représentative : ici, c'est votre vitrine.
      </InfoBox>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      {!settings && <StepSheet onClick={() => navigate(stepPath(9))} busy={busy} />}
    </Screen>
  );
}
