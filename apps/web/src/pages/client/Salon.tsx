/**
 * C-F 04 — Page du salon : couverture (retour, favori), nom, catégories — quartier, note, ouverture,
 * description, onglets Prestations / Réalisations / Infos, feuille « Réserver ».
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChevronLeft, Heart, Share2 } from 'lucide-react';
import { useFavorites, useSalon, useSalonReviews, useToggleFavorite } from '@salondz/api-client';
import { DAY_LABELS_FR, WEEK_DAYS, categoryLabel, formatDA, formatDZPhone, wilayaName } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { formatRating } from '@/lib/clientPrefs';
import { formatDuration } from '@/lib/format';
import { BottomSheet, Button, I, IconButton, Img, LinkButton, Segmented } from '@/components/ui';
import { SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';
import type { SalonPublic } from '@salondz/types';

type Tab = 'services' | 'works' | 'infos';

/** « Ouvert · ferme à 19:00 » / « Fermé · ouvre demain 09:00 ». */
export function openingStatus(s: SalonPublic): { open: boolean; label: string } {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Algiers' }));
  const dow = local.getDay();
  const hm = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;
  const today = s.openingHours.filter((h) => h.dayOfWeek === dow && !h.isClosed);
  const current = today.find((h) => h.opensAt <= hm && hm < h.closesAt);
  if (current) return { open: true, label: `Ouvert · ferme à ${current.closesAt}` };
  const later = today.find((h) => h.opensAt > hm);
  if (later) return { open: false, label: `Fermé · ouvre à ${later.opensAt}` };
  for (let i = 1; i <= 7; i++) {
    const d = (dow + i) % 7;
    const h = s.openingHours.find((x) => x.dayOfWeek === d && !x.isClosed);
    if (h) return { open: false, label: `Fermé · ouvre ${i === 1 ? 'demain' : DAY_LABELS_FR[d as 0].toLowerCase()} ${h.opensAt}` };
  }
  return { open: false, label: 'Fermé' };
}

export function Salon() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const salon = useSalon(slug);
  const favs = useFavorites(!!session);
  const toggle = useToggleFavorite();
  const reviews = useSalonReviews(salon.data?.id ?? '');
  const [tab, setTab] = useState<Tab>('services');

  if (salon.isPending) return <Splash />;
  if (salon.isError) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;
  const s = salon.data;
  const isFav = !!favs.data?.items.some((x) => x.id === s.id);
  const status = openingStatus(s);
  const cats = s.categoryIds.map((c) => categoryLabel(c)).join(' · ');
  const place = `${s.zone ?? s.city}, ${wilayaName(s.wilayaCode)}`;
  const works = [...s.photos, ...s.services.flatMap((sv) => sv.photos ?? [])];

  return (
    <div className="min-h-dvh" style={{ paddingBottom: SHEET_PAD }}>
      {/* Couverture */}
      <div className="relative h-[300px] bg-line">
        {s.coverUrl && <img src={s.coverUrl} alt="" className="h-full w-full object-cover" />}
        <div className="absolute left-5 right-5 top-4 flex items-center justify-between">
          <IconButton lg aria-label="Retour" onClick={() => navigate(-1)}>
            <I icon={ChevronLeft} />
          </IconButton>
          <div className="flex gap-2.5">
            <IconButton
              lg
              aria-label="Partager"
              onClick={() => {
                const url = window.location.href;
                if (navigator.share) void navigator.share({ title: s.name, url }).catch(() => undefined);
                else void navigator.clipboard.writeText(url);
              }}
            >
              <I icon={Share2} size={20} />
            </IconButton>
            <IconButton lg aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={isFav} disabled={toggle.isPending} onClick={() => (session ? toggle.mutate({ salonId: s.id, on: !isFav }) : navigate(`/connexion?next=${encodeURIComponent(`/s/${s.slug}`)}`))}>
              <Heart size={22} strokeWidth={1.6} fill={isFav ? 'currentColor' : 'none'} />
            </IconButton>
          </div>
        </div>
      </div>

      <div className="relative -mt-5 flex flex-col gap-4 rounded-t-[24px] bg-bg px-5 pt-6">
        <div>
          <h1 className="h1 !text-[30px]">{s.name}</h1>
          <p className="mt-1 text-[17px] text-muted">
            {cats} — {place}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {s.ratingCount > 0 && (
            <span className="pill soft !text-[15px] !font-semibold">
              ★ {formatRating(s.ratingAvg)} · {s.ratingCount} avis
            </span>
          )}
          <span className={`badge md !text-[15px] ${status.open ? 'b-ok' : 'b-nu'}`}>
            <span className="dot" />
            {status.label}
          </span>
        </div>
        {s.description && <p className="p text-[17px]">{s.description}</p>}

        <Segmented
          label="Sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'services', label: 'Prestations' },
            { value: 'works', label: 'Réalisations' },
            { value: 'infos', label: 'Infos' },
          ]}
        />

        {tab === 'services' && (
          <div className="crd !gap-0 !py-1">
            {s.services.map((sv) => (
              <Link key={sv.id} to={`/s/${s.slug}/prestation/${sv.id}`} className="li !py-5">
                <span>
                  <span className="block text-[20px] font-semibold">{sv.name}</span>
                  <span className="s block text-[15px]">{formatDuration(sv.durationMinutes)}</span>
                </span>
                <span className="text-[20px] font-semibold">{formatDA(sv.priceDa)}</span>
              </Link>
            ))}
            {s.services.length === 0 && <p className="p py-3">Aucune prestation pour le moment.</p>}
          </div>
        )}

        {tab === 'works' && (
          <>
            {works.length === 0 ? (
              <p className="p">Pas encore de réalisations.</p>
            ) : (
              <div className="g2">
                {works.slice(0, 8).map((p) => (
                  <Img key={p.id} src={p.url} className="aspect-square w-full" />
                ))}
              </div>
            )}
            {works.length > 8 && (
              <LinkButton to={`/s/${s.slug}/realisations`} variant="g">
                Voir toutes les réalisations
              </LinkButton>
            )}
          </>
        )}

        {tab === 'infos' && (
          <div className="flex flex-col gap-4">
            <div className="crd !gap-0 !py-1">
              {WEEK_DAYS.map((d) => {
                const rows = s.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed);
                return (
                  <div key={d} className="li !py-3">
                    <span className="text-[16px]">{DAY_LABELS_FR[d]}</span>
                    <span className={`mono text-[16px] ${rows.length ? 'text-muted' : 'text-danger'}`}>{rows.length ? rows.map((h) => `${h.opensAt} – ${h.closesAt}`).join(', ') : 'Fermé'}</span>
                  </div>
                );
              })}
            </div>
            <div className="crd !gap-0 !py-1">
              <div className="li !py-3">
                <span className="text-muted">Adresse</span>
                <span className="text-right">{[s.address, place].filter(Boolean).join(', ')}</span>
              </div>
              {s.phone && (
                <a href={`tel:${s.phone}`} className="li !py-3">
                  <span className="text-muted">Téléphone</span>
                  <span>{formatDZPhone(s.phone)}</span>
                </a>
              )}
              {s.staff.length > 0 && (
                <div className="li !py-3">
                  <span className="text-muted">Équipe</span>
                  <span className="text-right">{s.staff.map((m) => m.displayName).join(' · ')}</span>
                </div>
              )}
            </div>
            {reviews.data && reviews.data.items.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <span className="h3">Avis</span>
                {reviews.data.items.slice(0, 5).map((r) => (
                  <div key={r.id} className="crd sm !gap-1">
                    <span className="text-[15px] font-semibold">
                      {'★'.repeat(r.rating)}
                      <span className="text-disabled">{'★'.repeat(5 - r.rating)}</span> · {r.authorName}
                    </span>
                    {r.comment && <span className="p text-[15px]">{r.comment}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomSheet grab={false}>
        <Button onClick={() => navigate(`/s/${s.slug}/prestations`)}>Réserver</Button>
      </BottomSheet>
    </div>
  );
}
