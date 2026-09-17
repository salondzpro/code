/**
 * PRO-F 05 — Étape 3 : identité visuelle. L'écran EST l'aperçu de la future page (couverture, logo
 * qui déborde, nom du salon) : le pro voit ce que verront ses clients et touche ce qu'il veut changer.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Camera, Image as ImageIcon, UserCircle2 } from 'lucide-react';
import { draftFiles, readProDraft } from '@/lib/proDraft';
import { I, ListRow } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { StepBar, StepSheet, StepTitle, stepPath } from './Shared';
import { COVER_ASPECT, ImageCropper } from '@/components/ImageCropper';
import { t } from '@/i18n';

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
  const name = readProDraft().name ?? t('Votre salon');
  const [cover, setCover] = useState<File | undefined>(draftFiles.get().cover);
  const [logo, setLogo] = useState<File | undefined>(draftFiles.get().logo);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const logoInput = useRef<HTMLInputElement | null>(null);
  const coverUrl = usePreview(cover);
  const logoUrl = usePreview(logo);
  const [crop, setCrop] = useState<{ kind: 'cover' | 'logo'; file: File } | null>(null);

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={3} backTo={stepPath(2)} />
      <StepTitle sub={t("Une couverture et un logo : c'est la première chose que voient vos clients.")}>
        {t("Votre identité visuelle")}
      </StepTitle>

      {/* Aperçu de la page publique : couverture, logo, nom. */}
      <div className="crd overflow-hidden !p-0 !gap-0">
        <button
          type="button"
          className="relative h-[11rem] w-full bg-fill text-start"
          onClick={() => coverInput.current?.click()}
          aria-label={t("Choisir la photo de couverture")}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-2 text-subtle">
              <I icon={ImageIcon} size={30} />
              <span className="text-[0.857rem]">{t("Ajouter une photo de couverture")}</span>
            </span>
          )}
          <span className="absolute bottom-3 end-3 flex items-center gap-1.5 rounded-[var(--radius-btn)] bg-surface px-3 py-1.5 text-[0.857rem] font-semibold shadow-card">
            <I icon={Camera} size={16} /> {coverUrl ? t('Changer') : t('Ajouter')}
          </span>
        </button>
        {/* `relative` : peint au-dessus de la couverture (elle-même positionnée), sinon le nom passe dessous. */}
        <div className="relative -mt-8 flex items-end gap-3 px-4 pb-4">
          {/* La pastille appareil photo est hors du cercle (`.av` rogne son contenu). */}
          <span className="relative flex-none">
            <button
              type="button"
              className="av h-[4.5rem] w-[4.5rem] border-4 border-surface bg-fill"
              onClick={() => logoInput.current?.click()}
              aria-label={t("Choisir le logo")}
            >
              {logoUrl ? <img src={logoUrl} alt="" /> : <I icon={UserCircle2} size={30} className="text-subtle" />}
            </button>
            <span className="pointer-events-none absolute bottom-0 end-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-ink text-white">
              <I icon={Camera} size={12} />
            </span>
          </span>
          <span className="min-w-0 pb-1">
            <span className="block truncate text-[1.143rem] font-bold tracking-[-0.3px]">{name}</span>
            <span className="p block text-[0.857rem]">{t("Aperçu de votre page")}</span>
          </span>
        </div>
      </div>

      <div className="crd !gap-0 !py-1">
        <ListRow onClick={() => coverInput.current?.click()}>
          <span className="block text-[1rem] font-semibold">{t("Photo de couverture")}</span>
          <span className="p block text-[0.857rem]">{t("Votre salon, votre vitrine · format paysage")}</span>
        </ListRow>
        <ListRow onClick={() => logoInput.current?.click()}>
          <span className="block text-[1rem] font-semibold">{t("Logo ou portrait")}</span>
          <span className="p block text-[0.857rem]">{t("Format carré, visage ou logo centré")}</span>
        </ListRow>
      </div>

      <input
        ref={coverInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setCrop({ kind: 'cover', file: f });
          e.target.value = '';
        }}
      />
      <input
        ref={logoInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setCrop({ kind: 'logo', file: f });
          e.target.value = '';
        }}
      />
      {crop && (
        <ImageCropper
          file={crop.file}
          aspect={crop.kind === 'logo' ? 1 : COVER_ASPECT}
          round={crop.kind === 'logo'}
          title={crop.kind === 'logo' ? t('Recadrer le logo') : t('Recadrer la couverture')}
          onCancel={() => setCrop(null)}
          onDone={(f) => {
            if (crop.kind === 'cover') {
              setCover(f);
              draftFiles.set({ cover: f });
            } else {
              setLogo(f);
              draftFiles.set({ logo: f });
            }
            setCrop(null);
          }}
        />
      )}
      <StepSheet
        label={cover || logo ? t('Continuer') : t('Continuer sans photo')}
        hint={t("Modifiable ensuite depuis Mon salon.")}
        onClick={() => navigate(stepPath(4))}
      />
    </Screen>
  );
}
