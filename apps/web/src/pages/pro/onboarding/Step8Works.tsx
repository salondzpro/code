/** PRO-F 10 — Étape 8 : « Vos réalisations » — photos associées à une prestation (visibles sur sa fiche). */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, X } from 'lucide-react';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { uploadSalonPhoto } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { I } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, stepPath } from './Shared';

export function Step8Works() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { setPhotos } = useProServiceMutations();
  const input = useRef<HTMLInputElement | null>(null);
  const [target, setTarget] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!salon) return <Splash />;
  const services = salon.services.filter((s) => s.isActive);
  const works = services.flatMap((s) => (s.photos ?? []).map((p) => ({ ...p, service: s })));

  const add = async (files: FileList | null) => {
    const svc = services.find((s) => s.id === target) ?? services[0];
    if (!files?.length || !svc) return;
    setBusy(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 6)) urls.push(await uploadSalonPhoto(salon.id, f));
      await setPhotos.mutateAsync({ id: svc.id, photos: [...(svc.photos ?? []).map((p) => ({ url: p.url })), ...urls.map((url) => ({ url }))] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (serviceId: string, url: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    await setPhotos.mutateAsync({ id: svc.id, photos: (svc.photos ?? []).filter((p) => p.url !== url).map((p) => ({ url: p.url })) });
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={8} backTo={stepPath(6)} />
      <div>
        <h1 className="h1">Vos réalisations</h1>
        <p className="p mt-2">Associez chaque photo à une prestation : elle apparaîtra sur sa fiche.</p>
      </div>
      {services.length > 1 && (
        <select className="inp" value={target || services[0]?.id} onChange={(e) => setTarget(e.target.value)} aria-label="Prestation associée aux nouvelles photos">
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <div className="g3">
        {works.map((w) => (
          <div key={w.id} className="flex flex-col gap-1.5">
            <div className="relative aspect-square overflow-hidden rounded-[16px] bg-line">
              <img src={w.url} alt="" className="h-full w-full object-cover" />
              <button type="button" className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white" aria-label="Retirer" onClick={() => void remove(w.service.id, w.url)}>
                <I icon={X} size={14} />
              </button>
            </div>
            <span className="truncate text-center text-[14px] text-muted">{w.service.name}</span>
          </div>
        ))}
        <button type="button" className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[16px] border border-dashed border-line bg-fill text-subtle" onClick={() => input.current?.click()} disabled={busy || services.length === 0} aria-label="Ajouter des réalisations">
          <I icon={Plus} size={26} />
          <span className="text-[14px]">Ajouter</span>
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
      {error && (
        <p className="text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet onClick={() => navigate(stepPath(9))} busy={busy} />
    </Screen>
  );
}
