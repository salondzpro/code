/** PRO-F 09 — Étape 7 : photos de la prestation (couverture + jusqu'à 6 exemples de résultats). */
import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Camera, Plus, X } from 'lucide-react';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { uploadSalonPhoto } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { Button, I, InfoBox, SectionLabel } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, stepPath } from './Shared';

const MAX_EXAMPLES = 6;

export function Step7ServicePhotos() {
  const navigate = useNavigate();
  const { serviceId = '' } = useParams();
  const salon = useProSalon().data?.salon ?? null;
  const { setPhotos } = useProServiceMutations();
  const service = salon?.services.find((s) => s.id === serviceId);
  const [urls, setUrls] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const moreInput = useRef<HTMLInputElement | null>(null);

  if (!salon) return <Splash />;
  if (!service) return <Navigate to={stepPath(6)} replace />;
  const photos = urls ?? (service.photos ?? []).map((p) => p.url);
  const cover = photos[0] ?? null;
  const examples = photos.slice(1);

  const add = async (files: FileList | null, asCover: boolean) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const f of Array.from(files).slice(0, MAX_EXAMPLES)) uploaded.push(await uploadSalonPhoto(salon.id, f));
      setUrls(asCover ? [uploaded[0]!, ...photos.slice(1), ...uploaded.slice(1)].slice(0, MAX_EXAMPLES + 1) : [...(cover ? [cover] : [uploaded[0]!]), ...examples, ...(cover ? uploaded : uploaded.slice(1))].slice(0, MAX_EXAMPLES + 1));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = (url: string) => setUrls(photos.filter((u) => u !== url));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setPhotos.mutateAsync({ id: service.id, photos: photos.map((url) => ({ url })) });
      navigate(stepPath(8));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={7} backTo={`${stepPath(6)}/${service.id}`} />
      <div>
        <h1 className="h1">Photos · {service.name}</h1>
        <p className="p mt-2">Une photo de couverture et jusqu'à {MAX_EXAMPLES} exemples de résultats.</p>
      </div>
      <SectionLabel>Couverture</SectionLabel>
      <button type="button" className="relative h-[320px] w-full overflow-hidden rounded-[20px] bg-line" onClick={() => coverInput.current?.click()} aria-label="Choisir la photo de couverture" disabled={busy}>
        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-subtle">
            <I icon={Camera} size={32} />
            <span className="text-[15px]">Ajouter une photo</span>
          </span>
        )}
      </button>
      <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { void add(e.target.files, true); e.target.value = ''; }} />
      <SectionLabel>Exemples de résultats</SectionLabel>
      <div className="g3">
        {examples.map((u) => (
          <div key={u} className="relative aspect-square overflow-hidden rounded-[16px] bg-line">
            <img src={u} alt="" className="h-full w-full object-cover" />
            <button type="button" className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white" aria-label="Retirer" onClick={() => remove(u)}>
              <I icon={X} size={14} />
            </button>
          </div>
        ))}
        {examples.length < MAX_EXAMPLES && (
          <button type="button" className="flex aspect-square items-center justify-center rounded-[16px] border border-dashed border-line bg-fill text-subtle" onClick={() => moreInput.current?.click()} aria-label="Ajouter un exemple" disabled={busy}>
            <I icon={Plus} size={28} />
          </button>
        )}
      </div>
      <input ref={moreInput} type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files, false); e.target.value = ''; }} />
      <InfoBox>Les prestations avec photos sont réservées 3 fois plus souvent.</InfoBox>
      {error && (
        <p className="text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet
        label="Enregistrer la prestation"
        onClick={() => void save()}
        busy={busy || setPhotos.isPending}
        secondary={
          <Button variant="g" onClick={() => void save().then(() => navigate(stepPath(6)))} disabled={busy}>
            Enregistrer et ajouter une autre
          </Button>
        }
      />
    </Screen>
  );
}
