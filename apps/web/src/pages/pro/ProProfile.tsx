/** Espace pro — Profil : page publique, identité, adresse, horaires, disponibilités, règles, fermetures, équipe, compte. */
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Camera, ChevronRight, Share2 } from 'lucide-react';
import { useMe, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { MARKET_LABELS_FR, SALON_MAX_PHOTOS, wilayaName } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { uploadSalonPhoto } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { Avatar, Badge, Button, I, ListRow, SectionLabel, Textarea, Toggle } from '@/components/ui';
import { BrandFooter } from '@/components/BrandFooter';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { ShareSheet, usePublicUrl } from './Link';

export function ProProfile() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const me = useMe();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon, setPhotos } = useProSalonMutations();
  const [sheet, setSheet] = useState(false);
  const [desc, setDesc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'cover' | 'logo' | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const logoInput = useRef<HTMLInputElement | null>(null);
  const { url, short } = usePublicUrl(salon?.slug ?? '');
  if (!salon) return <Splash />;
  const market = salon.genderTarget === 'men' ? 'men' : 'women';

  const upload = async (kind: 'cover' | 'logo', file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(kind);
    try {
      const u = await uploadSalonPhoto(salon.id, file);
      if (kind === 'logo') await updateSalon.mutateAsync({ logoUrl: u });
      // Nouvelle couverture = première photo ; les anciennes couvertures restent dans la galerie.
      else await setPhotos.mutateAsync([{ url: u }, ...salon.photos.map((p) => ({ url: p.url }))].slice(0, SALON_MAX_PHOTOS));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <h1 className="h1">Profil</h1>

      {/* Page publique */}
      <div className="crd !gap-4">
        <div className="flex items-center gap-3.5">
          <button type="button" className="relative flex-none" onClick={() => logoInput.current?.click()} aria-label="Changer la photo de profil" disabled={busy !== null}>
            <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={72} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-ink text-white">
              <I icon={Camera} size={14} />
            </span>
          </button>
          <span className="min-w-0 flex-1">
            <span className="block text-[1.125rem] font-bold tracking-[-0.4px]">{salon.name}</span>
            <span className="block truncate text-[0.8125rem] text-muted">{short}</span>
          </span>
          <Badge tone={salon.isPublished ? 'ok' : 'pd'} md>
            {salon.isPublished ? 'En ligne' : 'Non publiée'}
          </Badge>
        </div>
        <button type="button" className="relative h-[8.75rem] w-full overflow-hidden rounded-[1rem] bg-line" onClick={() => coverInput.current?.click()} aria-label="Changer la photo de couverture" disabled={busy !== null}>
          {salon.coverUrl ? <img src={salon.coverUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-subtle"><I icon={Camera} size={28} /></span>}
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-[0.75rem] font-semibold shadow-sm">
            <I icon={Camera} size={14} /> {busy === 'cover' ? 'Envoi…' : 'Changer la couverture'}
          </span>
        </button>
        <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { void upload('cover', e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => { void upload('logo', e.target.files?.[0]); e.target.value = ''; }} />
        <div className="g2">
          <Button variant="g" sm onClick={() => navigate(`/s/${salon.slug}`)}>
            Aperçu
          </Button>
          <Button sm onClick={() => setSheet(true)}>
            <I icon={Share2} size={18} /> Partager
          </Button>
        </div>
      </div>

      <SectionLabel>Établissement</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <ListRow to="/pro/photos">
          <span className="block text-[0.9375rem]">Photos du salon</span>
          <span className="p block text-[0.9375rem]">
            {salon.logoUrl ? 'Logo' : 'Sans logo'} · {salon.photos.length} photo{salon.photos.length > 1 ? 's' : ''} de couverture
          </span>
        </ListRow>
        <ListRow to="/pro/salon">
          <span className="block text-[0.9375rem]">Adresse et zone</span>
          <span className="p block text-[0.9375rem]">{[salon.address, salon.zone ?? salon.city, wilayaName(salon.wilayaCode)].filter(Boolean).join(', ')}</span>
        </ListRow>
        <ListRow to="/pro/onboarding/5">
          <span className="block text-[0.9375rem]">Catalogue</span>
          <span className="p block text-[0.9375rem]">
            {MARKET_LABELS_FR[market]} · {salon.categoryIds.length} catégorie{salon.categoryIds.length > 1 ? 's' : ''}
          </span>
        </ListRow>
        <div className="li !py-4">
          <span>
            <span className="block text-[0.9375rem]">Description du salon</span>
            {desc === null ? <span className="p block text-[0.9375rem]">{salon.description || 'Recommandé — améliore votre visibilité'}</span> : null}
          </span>
          {desc === null && (
            <button type="button" className="text-[0.9375rem] text-muted underline" onClick={() => setDesc(salon.description ?? '')}>
              Modifier
            </button>
          )}
        </div>
        {desc !== null && (
          <div className="flex flex-col gap-2 pb-3">
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={1500} placeholder="Salon calme, produits sans parabène…" />
            <div className="g2">
              <Button variant="g" sm onClick={() => setDesc(null)}>
                Annuler
              </Button>
              <Button
                sm
                disabled={updateSalon.isPending}
                onClick={async () => {
                  await updateSalon.mutateAsync({ description: desc.trim() || undefined });
                  setDesc(null);
                }}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </div>

      <SectionLabel>Planning</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <ListRow to="/pro/profil/horaires">
          <span className="text-[0.9375rem]">Horaires</span>
        </ListRow>
        <ListRow to="/pro/profil/regles">
          <span className="text-[0.9375rem]">Créneaux et règles de réservation</span>
        </ListRow>
        <ListRow to="/pro/blocages">
          <span className="text-[0.9375rem]">Fermetures et exceptions</span>
        </ListRow>
        <ListRow to="/pro/equipe">
          <span className="text-[0.9375rem]">Équipe</span>
        </ListRow>
        <ListRow to="/pro/lien">
          <span className="text-[0.9375rem]">Lien, QR code et partage</span>
        </ListRow>
      </div>

      <SectionLabel>Réservation en ligne</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <span>
            <span className="block text-[0.9375rem]">Page publiée</span>
            <span className="p block text-[0.9375rem]">Visible dans la marketplace</span>
          </span>
          <Toggle on={salon.isPublished} onChange={(v) => updateSalon.mutate({ isPublished: v }, { onError: (e) => setError(errorText(e)) })} label="Page publiée" />
        </div>
        <div className="li !py-4">
          <span>
            <span className="block text-[0.9375rem]">Validation manuelle</span>
            <span className="p block text-[0.9375rem]">Vous confirmez chaque demande</span>
          </span>
          <Toggle on={!salon.autoConfirm} onChange={(v) => updateSalon.mutate({ autoConfirm: !v })} label="Validation manuelle" />
        </div>
      </div>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}

      <SectionLabel>Compte</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <span>
            <span className="block text-[0.9375rem]">{me.data?.profile.fullName ?? 'Vous'}</span>
            <span className="p block text-[0.9375rem]">{me.data?.profile.phone ?? ''}</span>
          </span>
          <Badge tone="ok" md>
            Active
          </Badge>
        </div>
        <Link to="/" className="li !py-4">
          <span className="text-[0.9375rem]">Espace client</span>
          <I icon={ChevronRight} size={18} className="text-disabled" />
        </Link>
        <button
          type="button"
          className="li w-full text-left text-[0.9375rem] text-danger"
          onClick={async () => {
            await signOut();
            navigate('/intro', { replace: true });
          }}
        >
          Se déconnecter
        </button>
      </div>
      <BrandFooter />
      {sheet && <ShareSheet name={salon.name} url={url} short={short} logo={salon.logoUrl} onClose={() => setSheet(false)} />}
    </Screen>
  );
}
