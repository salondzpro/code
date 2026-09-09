/**
 * Profil pro → « Photos du salon » : photo de profil (logo rond, affichée sur les cartes, la page publique et les
 * rendez-vous) et photos de couverture (la première est la couverture ; jusqu'à SALON_MAX_PHOTOS). Tout ce qui est
 * changé ici se répercute partout : cartes marketplace, page publique, favoris, fiches de rendez-vous.
 */
import { useRef, useState } from 'react';
import { Camera, Plus, Star, Trash2, X } from 'lucide-react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { SALON_MAX_PHOTOS } from '@salondz/constants';
import { uploadSalonPhoto } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { Avatar, Button, I, InfoBox, SectionLabel, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { COVER_ASPECT, ImageCropper } from '@/components/ImageCropper';

export function ProPhotos() {
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon, setPhotos } = useProSalonMutations();
  const [busy, setBusy] = useState<'logo' | 'photos' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropLogo, setCropLogo] = useState<File | null>(null);
  // Photos de couverture à recadrer une par une avant l'envoi groupé.
  const [queue, setQueue] = useState<File[]>([]);
  const [ready, setReady] = useState<File[]>([]);
  const logoInput = useRef<HTMLInputElement | null>(null);
  const photosInput = useRef<HTMLInputElement | null>(null);
  if (!salon) return <Splash />;
  const photos = salon.photos;
  const room = Math.max(0, SALON_MAX_PHOTOS - photos.length);

  const changeLogo = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy('logo');
    try {
      const url = await uploadSalonPhoto(salon.id, file);
      await updateSalon.mutateAsync({ logoUrl: url });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };
  const addPhotos = async (list: File[]) => {
    if (list.length === 0) return;
    setError(null);
    setBusy('photos');
    try {
      const urls: string[] = [];
      for (const f of list) urls.push(await uploadSalonPhoto(salon.id, f));
      await setPhotos.mutateAsync([
        ...photos.map((p) => ({ url: p.url })),
        ...urls.map((url) => ({ url })),
      ]);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };
  const save = async (next: { url: string }[]) => {
    setError(null);
    try {
      await setPhotos.mutateAsync(next);
    } catch (err) {
      setError(errorText(err));
    }
  };
  const makeCover = (url: string) =>
    void save([{ url }, ...photos.filter((p) => p.url !== url).map((p) => ({ url: p.url }))]);
  const remove = (url: string) =>
    void save(photos.filter((p) => p.url !== url).map((p) => ({ url: p.url })));

  return (
    <Screen gap={16}>
      <TopBar backTo="/pro/profil" />
      <h1 className="h1">Photos du salon</h1>
      <p className="p text-[0.9375rem]">
        Elles s'affichent sur vos cartes dans la marketplace, sur votre page publique et sur les
        rendez-vous de vos clients.
      </p>

      <SectionLabel>Photo de profil</SectionLabel>
      <div className="crd !flex-row items-center gap-4">
        <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={80} />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold">
            {salon.logoUrl ? 'Votre logo' : 'Aucun logo : la couverture est utilisée'}
          </span>
          <span className="p block text-[0.8125rem]">Format carré conseillé.</span>
        </span>
        <div className="flex flex-col items-end gap-1.5">
          <Button
            auto
            sm
            variant="g"
            onClick={() => logoInput.current?.click()}
            disabled={busy !== null}
          >
            <I icon={Camera} size={16} /> {busy === 'logo' ? 'Envoi…' : 'Changer'}
          </Button>
          {salon.logoUrl && (
            <button
              type="button"
              className="flex items-center gap-1 text-[0.75rem] font-semibold text-danger"
              disabled={updateSalon.isPending}
              onClick={() =>
                void updateSalon
                  .mutateAsync({ logoUrl: null })
                  .catch((err) => setError(errorText(err)))
              }
            >
              <I icon={Trash2} size={12} /> Retirer
            </button>
          )}
        </div>
        <input
          ref={logoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setCropLogo(f);
            e.target.value = '';
          }}
        />
      </div>

      <SectionLabel>Photos de couverture</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((p, i) => (
          <div
            key={p.id}
            className="relative overflow-hidden rounded-[1rem] bg-line"
            style={{ aspectRatio: '4 / 3' }}
          >
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            {i === 0 ? (
              <span className="absolute left-2 top-2 rounded-full bg-ink px-2.5 py-1 text-[0.6875rem] font-semibold text-white">
                Couverture
              </span>
            ) : (
              <button
                type="button"
                className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-[0.6875rem] font-semibold"
                onClick={() => makeCover(p.url)}
                disabled={setPhotos.isPending}
              >
                <I icon={Star} size={12} /> Couverture
              </button>
            )}
            <button
              type="button"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-surface/95"
              aria-label="Supprimer la photo"
              onClick={() => remove(p.url)}
              disabled={setPhotos.isPending}
            >
              <I icon={X} size={14} />
            </button>
          </div>
        ))}
        {room > 0 && (
          <button
            type="button"
            className="flex flex-col items-center justify-center gap-1 rounded-[1rem] border border-dashed border-line bg-surface text-muted"
            style={{ aspectRatio: '4 / 3' }}
            onClick={() => photosInput.current?.click()}
            disabled={busy !== null}
          >
            <I icon={Plus} size={22} />
            <span className="text-[0.8125rem] font-semibold">
              {busy === 'photos' ? 'Envoi…' : 'Ajouter'}
            </span>
          </button>
        )}
        <input
          ref={photosInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            setQueue(Array.from(e.target.files ?? []).slice(0, room));
            setReady([]);
            e.target.value = '';
          }}
        />
      </div>
      <InfoBox>
        La première photo est votre couverture. {photos.length}/{SALON_MAX_PHOTOS} photo
        {photos.length > 1 ? 's' : ''}. Les photos de vos réalisations se gèrent depuis chaque
        prestation.
      </InfoBox>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      {cropLogo && (
        <ImageCropper
          file={cropLogo}
          aspect={1}
          round
          title="Recadrer le logo"
          onCancel={() => setCropLogo(null)}
          onDone={(f) => {
            setCropLogo(null);
            void changeLogo(f);
          }}
        />
      )}
      {queue[0] && (
        <ImageCropper
          file={queue[0]}
          aspect={COVER_ASPECT}
          title={
            queue.length > 1
              ? `Recadrer la photo (${ready.length + 1}/${ready.length + queue.length})`
              : 'Recadrer la couverture'
          }
          onCancel={() => {
            const rest = queue.slice(1);
            setQueue(rest);
            if (rest.length === 0 && ready.length > 0) {
              const all = ready;
              setReady([]);
              void addPhotos(all);
            }
          }}
          onDone={(f) => {
            const rest = queue.slice(1);
            const all = [...ready, f];
            setQueue(rest);
            if (rest.length === 0) {
              setReady([]);
              void addPhotos(all);
            } else setReady(all);
          }}
        />
      )}
    </Screen>
  );
}
