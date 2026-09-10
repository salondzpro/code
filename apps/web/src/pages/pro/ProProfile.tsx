/**
 * Espace pro — Profil, ordonné par ce qui sert tous les jours :
 *   1. la page publique (logo, couverture, en ligne / non publiée, Aperçu, Partager) ;
 *   2. quatre raccourcis du quotidien en tuiles : Fermetures, Horaires, Équipe, QR code & lien ;
 *   3. la réservation en ligne (page publiée, validation manuelle) ;
 *   4. l'établissement (photos, adresse, catalogue, description, règles de réservation) ;
 *   5. le compte. Une icône par ligne, une page dédiée par sujet.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowLeftRight,
  CalendarOff,
  Camera,
  Clock,
  Eye,
  FileText,
  Globe,
  Images,
  LogOut,
  MapPin,
  Pencil,
  QrCode,
  Save,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useMe, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { MARKET_LABELS_FR, SALON_MAX_PHOTOS, formatDZPhone, wilayaName } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { uploadSalonPhoto } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { Avatar, Badge, Button, I, ListRow, SectionLabel, Textarea, Toggle } from '@/components/ui';
import { BrandFooter } from '@/components/BrandFooter';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { ShareSheet, usePublicUrl } from './Link';
import { COVER_ASPECT, ImageCropper } from '@/components/ImageCropper';

/** Icône dans une pastille, à gauche d'une ligne ou d'une tuile. */
function Ic({ icon, ink }: { icon: LucideIcon; ink?: boolean }) {
  return (
    <span
      className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${ink ? 'bg-ink text-white' : 'bg-fill'}`}
    >
      <I icon={icon} size={18} />
    </span>
  );
}

/** Ligne de réglage : icône, titre, sous-titre. */
function RowText({ icon, title, sub }: { icon: LucideIcon; title: string; sub?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-3.5">
      <Ic icon={icon} />
      <span className="min-w-0">
        <span className="block text-[1rem] font-semibold">{title}</span>
        {sub && <span className="block truncate text-[0.875rem] text-muted">{sub}</span>}
      </span>
    </span>
  );
}

/** Tuile de raccourci (2 par ligne) pour les gestes du quotidien. */
function Tile({
  to,
  icon,
  title,
  sub,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  sub: string;
}) {
  return (
    <Link to={to} className="crd !gap-3 !p-4">
      <Ic icon={icon} ink />
      <span>
        <span className="block text-[1rem] font-bold tracking-[-0.2px]">{title}</span>
        <span className="block text-[0.8125rem] text-muted">{sub}</span>
      </span>
    </Link>
  );
}

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
  const [crop, setCrop] = useState<{ kind: 'cover' | 'logo'; file: File } | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const logoInput = useRef<HTMLInputElement | null>(null);
  const { url, short } = usePublicUrl(salon?.slug ?? '');
  if (!salon) return <Splash />;
  const market = salon.genderTarget === 'men' ? 'men' : 'women';
  const active = salon.staff.filter((m) => m.isActive).length;

  const upload = async (kind: 'cover' | 'logo', file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(kind);
    try {
      const u = await uploadSalonPhoto(salon.id, file);
      if (kind === 'logo') await updateSalon.mutateAsync({ logoUrl: u });
      // Nouvelle couverture = première photo ; les anciennes couvertures restent dans la galerie.
      else
        await setPhotos.mutateAsync(
          [{ url: u }, ...salon.photos.map((p) => ({ url: p.url }))].slice(0, SALON_MAX_PHOTOS),
        );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <h1 className="h1">Profil</h1>

      {/* 1. Page publique */}
      <div className="crd !gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            className="relative flex-none"
            onClick={() => logoInput.current?.click()}
            aria-label="Changer la photo de profil"
            disabled={busy !== null}
          >
            <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={72} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-ink text-white">
              <I icon={Camera} size={14} />
            </span>
          </button>
          <span className="min-w-0 flex-1">
            <span className="block text-[1.25rem] font-bold tracking-[-0.4px]">{salon.name}</span>
            <span className="block truncate text-[0.875rem] text-muted">{short}</span>
          </span>
          <Badge tone={salon.isPublished ? 'ok' : 'pd'} md>
            {salon.isPublished ? 'En ligne' : 'Non publiée'}
          </Badge>
        </div>
        <button
          type="button"
          className="relative h-[8.75rem] w-full overflow-hidden rounded-[1rem] bg-line"
          onClick={() => coverInput.current?.click()}
          aria-label="Changer la photo de couverture"
          disabled={busy !== null}
        >
          {salon.coverUrl ? (
            <img src={salon.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-subtle">
              <I icon={Camera} size={28} />
            </span>
          )}
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-[0.75rem] font-semibold shadow-sm">
            <I icon={Camera} size={14} /> {busy === 'cover' ? 'Envoi…' : 'Changer la couverture'}
          </span>
        </button>
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
        <div className="g2">
          <Button variant="g" sm onClick={() => navigate(`/s/${salon.slug}`)}>
            <I icon={Eye} size={18} /> Aperçu
          </Button>
          <Button sm onClick={() => setSheet(true)}>
            <I icon={Share2} size={18} /> Partager
          </Button>
        </div>
      </div>

      {/* 2. Les gestes du quotidien */}
      <SectionLabel>Au quotidien</SectionLabel>
      <div className="g2">
        <Tile
          to="/pro/blocages"
          icon={CalendarOff}
          title="Fermetures"
          sub="Congés, pauses, exceptions"
        />
        <Tile
          to="/pro/profil/horaires"
          icon={Clock}
          title="Horaires"
          sub="Jours et heures d'ouverture"
        />
        <Tile
          to="/pro/equipe"
          icon={Users}
          title="Équipe"
          sub={`${active} membre${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''}`}
        />
        <Tile to="/pro/lien" icon={QrCode} title="QR code & lien" sub="Affiche, partage, copie" />
      </div>

      {/* 3. Réservation en ligne */}
      <SectionLabel>Réservation en ligne</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <RowText icon={Globe} title="Page publiée" sub="Visible dans la marketplace" />
          <Toggle
            on={salon.isPublished}
            onChange={(v) =>
              updateSalon.mutate({ isPublished: v }, { onError: (e) => setError(errorText(e)) })
            }
            label="Page publiée"
          />
        </div>
        <div className="li !py-4">
          <RowText
            icon={ShieldCheck}
            title="Validation manuelle"
            sub="Vous confirmez chaque demande"
          />
          <Toggle
            on={!salon.autoConfirm}
            onChange={(v) => updateSalon.mutate({ autoConfirm: !v })}
            label="Validation manuelle"
          />
        </div>
        <ListRow to="/pro/profil/regles">
          <RowText
            icon={SlidersHorizontal}
            title="Créneaux et règles"
            sub="Délai minimum, annulation, report"
          />
        </ListRow>
      </div>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}

      {/* 4. Établissement */}
      <SectionLabel>Établissement</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <ListRow to="/pro/photos">
          <RowText
            icon={Images}
            title="Photos du salon"
            sub={`${salon.logoUrl ? 'Logo' : 'Sans logo'} · ${salon.photos.length} photo${salon.photos.length > 1 ? 's' : ''} de couverture`}
          />
        </ListRow>
        <ListRow to="/pro/salon">
          <RowText
            icon={MapPin}
            title="Adresse et zone"
            sub={[salon.address, salon.zone ?? salon.city, wilayaName(salon.wilayaCode)]
              .filter(Boolean)
              .join(', ')}
          />
        </ListRow>
        <ListRow to="/pro/onboarding/5">
          <RowText
            icon={Tag}
            title="Catalogue"
            sub={`${MARKET_LABELS_FR[market]} · ${salon.categoryIds.length} catégorie${salon.categoryIds.length > 1 ? 's' : ''}`}
          />
        </ListRow>
        <div className="li !py-4">
          <RowText
            icon={FileText}
            title="Description du salon"
            sub={
              desc === null
                ? salon.description || 'Recommandé — améliore votre visibilité'
                : undefined
            }
          />
          {desc === null && (
            <button
              type="button"
              className="ib flex-none"
              aria-label="Modifier la description"
              onClick={() => setDesc(salon.description ?? '')}
            >
              <I icon={Pencil} size={16} />
            </button>
          )}
        </div>
        {desc !== null && (
          <div className="flex flex-col gap-2 pb-3">
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={1500}
              placeholder="Salon calme, produits sans parabène…"
              aria-label="Description du salon"
            />
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
                <I icon={Save} size={16} /> Enregistrer
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Compte */}
      <SectionLabel>Compte</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <RowText
            icon={User}
            title={me.data?.profile.fullName ?? 'Vous'}
            sub={me.data?.profile.phone ? formatDZPhone(me.data.profile.phone) : ''}
          />
          <Badge tone="ok" md>
            Actif
          </Badge>
        </div>
        <ListRow to="/">
          <RowText icon={ArrowLeftRight} title="Espace client" sub="Réserver comme un client" />
        </ListRow>
        <button
          type="button"
          className="li w-full text-left"
          onClick={async () => {
            await signOut();
            navigate('/intro', { replace: true });
          }}
        >
          <span className="flex items-center gap-3.5 text-danger">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-cancel-bg">
              <I icon={LogOut} size={18} />
            </span>
            <span className="text-[1rem] font-semibold">Se déconnecter</span>
          </span>
        </button>
      </div>
      <BrandFooter />
      {crop && (
        <ImageCropper
          file={crop.file}
          aspect={crop.kind === 'logo' ? 1 : COVER_ASPECT}
          round={crop.kind === 'logo'}
          title={crop.kind === 'logo' ? 'Recadrer le logo' : 'Recadrer la couverture'}
          onCancel={() => setCrop(null)}
          onDone={(f) => {
            const kind = crop.kind;
            setCrop(null);
            void upload(kind, f);
          }}
        />
      )}
      {sheet && (
        <ShareSheet
          name={salon.name}
          url={url}
          short={short}
          logo={salon.logoUrl}
          onClose={() => setSheet(false)}
        />
      )}
    </Screen>
  );
}
