/** C-F 07 — Détail de la prestation : photo plein cadre, nom + prix, durée · catégorie, description, réalisations, salon, « Réserver · 2 500 DA ». */
import { useNavigate, useParams } from 'react-router';
import { ChevronLeft, Heart } from 'lucide-react';
import { useFavorites, useSalon, useToggleFavorite } from '@salondz/api-client';
import { categoryLabel, formatDA } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { formatRating } from '@/lib/clientPrefs';
import { formatDuration } from '@/lib/format';
import { Avatar, BottomSheet, Button, I, IconButton, Img } from '@/components/ui';
import { SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';
import { openingStatus } from './Salon';

export function ServiceDetail() {
  const { slug = '', serviceId = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const salon = useSalon(slug);
  const favs = useFavorites(!!session);
  const toggle = useToggleFavorite();
  if (salon.isPending) return <Splash />;
  if (salon.isError) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;
  const s = salon.data;
  const sv = s.services.find((x) => x.id === serviceId);
  if (!sv) return <ErrorMessage error={new Error('Prestation introuvable')} />;
  const photos = sv.photos ?? [];
  const isFav = !!favs.data?.items.some((x) => x.id === s.id);
  const status = openingStatus(s);

  return (
    <div className="min-h-dvh" style={{ paddingBottom: SHEET_PAD }}>
      <div className="relative h-[330px] bg-line">
        {(photos[0]?.url ?? s.coverUrl) && <img src={photos[0]?.url ?? s.coverUrl ?? ''} alt="" className="h-full w-full object-cover" />}
        <div className="absolute left-5 right-5 top-4 flex items-center justify-between">
          <IconButton lg aria-label="Retour" onClick={() => navigate(-1)}>
            <I icon={ChevronLeft} />
          </IconButton>
          <IconButton lg aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={isFav} onClick={() => (session ? toggle.mutate({ salonId: s.id, on: !isFav }) : navigate(`/connexion?next=${encodeURIComponent(`/s/${s.slug}/prestation/${sv.id}`)}`))}>
            <Heart size={22} strokeWidth={1.6} fill={isFav ? 'currentColor' : 'none'} />
          </IconButton>
        </div>
      </div>
      <div className="relative -mt-5 flex flex-col gap-4 rounded-t-[24px] bg-bg px-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="h1 !text-[30px]">{sv.name}</h1>
            <p className="mt-1 text-[17px] text-muted">
              {formatDuration(sv.durationMinutes)}
              {sv.categoryId ? ` · ${categoryLabel(sv.categoryId)}` : ''}
            </p>
          </div>
          <span className="text-[26px] font-bold tracking-[-0.5px]">{formatDA(sv.priceDa)}</span>
        </div>
        {sv.description && <p className="p text-[17px]">{sv.description}</p>}
        {photos.length > 1 && (
          <>
            <span className="h3">Réalisations</span>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {photos.slice(1).map((p) => (
                <Img key={p.id} src={p.url} className="h-[200px] w-[220px] flex-none" />
              ))}
            </div>
          </>
        )}
        <div className="crd !flex-row items-center gap-3.5">
          <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={64} />
          <span className="min-w-0 flex-1">
            <span className="block text-[20px] font-bold tracking-[-0.3px]">{s.name}</span>
            <span className="text-[16px] text-muted">
              {s.zone ?? s.city}
              {s.ratingCount > 0 ? ` · ★ ${formatRating(s.ratingAvg)}` : ''}
            </span>
          </span>
          <span className={`badge md !text-[15px] ${status.open ? 'b-ok' : 'b-nu'}`}>
            <span className="dot" />
            {status.open ? 'Ouvert' : 'Fermé'}
          </span>
        </div>
      </div>
      <BottomSheet grab={false}>
        <Button onClick={() => navigate(`/s/${s.slug}/prestations?services=${sv.id}`)}>Réserver · {formatDA(sv.priceDa)}</Button>
      </BottomSheet>
    </div>
  );
}
