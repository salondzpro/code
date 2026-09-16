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
import { Button, I } from '@/components/ui';
import { ImageCropper } from '@/components/ImageCropper';
import { Screen, SHEET_PAD_2 } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, StepTitle, stepPath } from './Shared';
import { t } from '@/i18n';

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
    <Screen bottom={SHEET_PAD_2} gap={16}>
      <StepBar
        step={7}
        backTo={`${stepPath(6)}/${service.id}`}
        right={fromCatalog ? 'Catalogue' : undefined}
      />
      <StepTitle sub={t("Une seule image, celle qui représente le mieux cette prestation. Les photos avec cette prestation sont réservées 3 fois plus souvent.")}>
        {t('Une photo pour « {service} »', { service: service.name })}
      </StepTitle>
      <button
        type="button"
        className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-card)] bg-line"
        onClick={() => input.current?.click()}
        aria-label={photo ? 'Changer la photo' : 'Ajouter une photo'}
        disabled={busy}
      >
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-subtle">
            <I icon={Camera} size={32} />
            <span className="text-[1rem]">{t("Ajouter une photo")}</span>
          </span>
        )}
        {photo && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-[0.857rem] font-semibold shadow-sm">
            <I icon={Camera} size={16} /> {busy ? 'Envoi…' : 'Changer'}
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
          <I icon={Trash2} size={16} /> {t("Retirer la photo")}
        </Button>
      )}
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet
        label={photo ? t("Enregistrer la prestation") : t("Enregistrer sans photo")}
        hint={fromCatalog ? undefined : t("Vos autres photos ont leur place dans « Réalisations », l'étape suivante.")}
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
            {t("Enregistrer et ajouter une autre")}
          </Button>
        }
      />
      {crop && (
        <ImageCropper
          file={crop}
          aspect={1}
          title={t("Recadrer la photo")}
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
