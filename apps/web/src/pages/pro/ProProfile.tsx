/**
 * Espace pro — Profil = porte d'entrée de la gestion, en six rubriques métier (une sous-page dédiée chacune) :
 * Mon salon · Catalogue · Équipe · Clients · Rendez-vous · Compte. En tête, la page publique (logo, couverture,
 * en ligne / non publiée, Aperçu, Partager). La navigation basse ne garde que Accueil / Agenda / Réservations / Profil.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  CalendarCog,
  Camera,
  ContactRound,
  Eye,
  Share2,
  Store,
  Tag,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { SALON_MAX_PHOTOS } from '@salondz/constants';
import { uploadSalonPhoto } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { Avatar, Badge, Button, I, SectionLabel } from '@/components/ui';
import { BrandFooter } from '@/components/BrandFooter';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { ShareSheet, usePublicUrl } from './Link';
import { COVER_ASPECT, ImageCropper } from '@/components/ImageCropper';

/** Tuile de rubrique (2 par ligne) : icône, titre, ce qu'on y trouve. */
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
    <Link to={to} className="crd !gap-3 !p-4" aria-label={title}>
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink text-white">
        <I icon={icon} size={20} />
      </span>
      <span>
        <span className="block text-[1.0625rem] font-bold tracking-[-0.3px]">{title}</span>
        <span className="block text-[0.8125rem] leading-snug text-muted">{sub}</span>
      </span>
    </Link>
  );
}

export function ProProfile() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon, setPhotos } = useProSalonMutations();
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'cover' | 'logo' | null>(null);
  const [crop, setCrop] = useState<{ kind: 'cover' | 'logo'; file: File } | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const logoInput = useRef<HTMLInputElement | null>(null);
  const { url, short } = usePublicUrl(salon?.slug ?? '');
  if (!salon) return <Splash />;
  const active = salon.staff.filter((m) => m.isActive).length;
  const services = salon.services.filter((s) => s.isActive).length;

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

      {/* Page publique */}
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
        {error && (
          <p className="text-[0.875rem] text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Six rubriques métier */}
      <SectionLabel>Gérer mon activité</SectionLabel>
      <div className="g2">
        <Tile
          to="/pro/mon-salon"
          icon={Store}
          title="Mon salon"
          sub="Photos, réalisations, adresse, horaires"
        />
        <Tile
          to="/pro/catalogue"
          icon={Tag}
          title="Catalogue"
          sub={`${services} prestation${services > 1 ? 's' : ''} · catégories, prix, durée`}
        />
        <Tile
          to="/pro/equipe"
          icon={Users}
          title="Équipe"
          sub={`${active} membre${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''} · horaires, absences`}
        />
        <Tile
          to="/pro/clients"
          icon={ContactRound}
          title="Clients"
          sub="Fiches, historique, bloqués"
        />
        <Tile
          to="/pro/reglages/rendez-vous"
          icon={CalendarCog}
          title="Rendez-vous"
          sub="Règles de réservation, annulation, retard"
        />
        <Tile
          to="/pro/compte"
          icon={UserCircle}
          title="Compte"
          sub="Profil, notifications, paramètres"
        />
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
