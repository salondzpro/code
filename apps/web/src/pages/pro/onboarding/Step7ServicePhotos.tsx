/**
 * PRO-F 09 — Étape 7 : LA photo de la prestation (une seule image représentative, recadrée en carré).
 * Les photos du travail réel (plusieurs) vont dans « Réalisations » (étape 8 / Mon salon).
 */
import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Camera, Trash2 } from 'lucide-react';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { uploadSalonPhoto } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { Button, I, InfoBox } from '@/components/ui';
import { ImageCropper } from '@/components/ImageCropper';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, stepPath } from './Shared';

export function Step7ServicePhotos() {
  const navigate = useNavigate();
  const { serviceId = '' } = useParams();
  const salon = useProSalon().data?.salon ?? null;
  const { setPhotos } = useProServiceMutations();
  const service = salon?.services.find((s) => s.id === serviceId);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [crop, setCrop] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  if (!salon) return <Splash />;
  if (!service) return <Navigate to={stepPath(6)} replace />;
  const photo = url === undefined ? (service.photos?.[0]?.url ?? null) : url;
  // Salon déjà publié = on vient du catalogue (retour au catalogue) ; sinon on est dans l'inscription (étape 8).
  const fromCatalog = salon.isPublished;

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      setUrl(await uploadSalonPhoto(salon.id, file));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await setPhotos.mutateAsync({ id: service.id, photos: photo ? [{ url: photo }] : [] });
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar
        step={7}
        backTo={`${stepPath(6)}/${service.id}`}
        right={fromCatalog ? 'Catalogue' : undefined}
      />
      <div>
        <h1 className="h1">Photo · {service.name}</h1>
        <p className="p mt-2">Une seule image, celle qui représente le mieux cette prestation.</p>
      </div>
      <button
        type="button"
        className="relative aspect-square w-full overflow-hidden rounded-[1.25rem] bg-line"
        onClick={() => input.current?.click()}
        aria-label={photo ? 'Changer la photo' : 'Ajouter une photo'}
        disabled={busy}
      >
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-subtle">
            <I icon={Camera} size={32} />
            <span className="text-[0.9375rem]">Ajouter une photo</span>
          </span>
        )}
        {photo && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-[0.75rem] font-semibold shadow-sm">
            <I icon={Camera} size={14} /> {busy ? 'Envoi…' : 'Changer'}
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setCrop(f);
          e.target.value = '';
        }}
      />
      {photo && (
        <Button variant="g" sm onClick={() => setUrl(null)} disabled={busy}>
          <I icon={Trash2} size={16} /> Retirer la photo
        </Button>
      )}
      <InfoBox>
        Les prestations avec photo sont réservées 3 fois plus souvent. Vos autres photos ont leur
        place dans « Réalisations ».
      </InfoBox>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet
        label="Enregistrer la prestation"
        onClick={() =>
          void save().then((ok) => ok && navigate(fromCatalog ? '/pro/catalogue' : stepPath(8)))
        }
        busy={busy || setPhotos.isPending}
        secondary={
          <Button
            variant="g"
            onClick={() => void save().then((ok) => ok && navigate(stepPath(6)))}
            disabled={busy}
          >
            Enregistrer et ajouter une autre
          </Button>
        }
      />
      {crop && (
        <ImageCropper
          file={crop}
          aspect={1}
          title="Recadrer la photo"
          onCancel={() => setCrop(null)}
          onDone={(f) => {
            setCrop(null);
            void upload(f);
          }}
        />
      )}
    </Screen>
  );
}
