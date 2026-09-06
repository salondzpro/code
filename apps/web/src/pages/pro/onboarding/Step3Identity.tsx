/** PRO-F 05 — Étape 3 : identité visuelle (photo de couverture, logo ou portrait). */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Camera } from 'lucide-react';
import { draftFiles } from '@/lib/proDraft';
import { Button, I, SectionLabel } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { StepBar, StepSheet, stepPath } from './Shared';

function usePreview(file: File | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

export function Step3Identity() {
  const navigate = useNavigate();
  const [cover, setCover] = useState<File | undefined>(draftFiles.get().cover);
  const [logo, setLogo] = useState<File | undefined>(draftFiles.get().logo);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const logoInput = useRef<HTMLInputElement | null>(null);
  const coverUrl = usePreview(cover);
  const logoUrl = usePreview(logo);

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={3} backTo={stepPath(2)} />
      <h1 className="h1">Votre identité visuelle</h1>
      <SectionLabel>Photo de couverture</SectionLabel>
      <button type="button" className="relative h-[220px] w-full overflow-hidden rounded-[20px] bg-line" onClick={() => coverInput.current?.click()} aria-label="Choisir la photo de couverture">
        {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-subtle">
            <I icon={Camera} size={32} />
            <span className="text-[15px]">Ajouter une photo</span>
          </span>
        )}
      </button>
      <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCover(f); draftFiles.set({ cover: f }); } e.target.value = ''; }} />
      <SectionLabel>Logo ou portrait</SectionLabel>
      <div className="flex items-center gap-5">
        <button type="button" className="av h-[128px] w-[128px] flex-none" onClick={() => logoInput.current?.click()} aria-label="Choisir le logo">
          {logoUrl ? <img src={logoUrl} alt="" /> : <I icon={Camera} size={28} />}
        </button>
        <div>
          <div className="text-[17px]">Format carré, visage ou logo centré</div>
          <div className="p">JPG ou PNG · 2 Mo max</div>
        </div>
      </div>
      <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogo(f); draftFiles.set({ logo: f }); } e.target.value = ''; }} />
      <Button variant="g" onClick={() => (cover ? logoInput.current?.click() : coverInput.current?.click())}>
        {cover || logo ? 'Remplacer les images' : 'Choisir les images'}
      </Button>
      <StepSheet onClick={() => navigate(stepPath(4))} />
    </Screen>
  );
}
