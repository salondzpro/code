/**
 * C-F 04 — Page du salon : couverture (retour, favori), nom, catégories — quartier, note, ouverture,
 * description, onglets Prestations / Réalisations / Infos, feuille « Réserver ».
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useBack } from '@/lib/useBack';
import {
  ChevronLeft,
  Heart,
  Share2,
  Info,
  MapPin,
  Map as MapIcon,
  Navigation,
  Phone,
  Ban,
  Star,
} from 'lucide-react';
import { writeDraft } from '@/lib/bookingDraft';
import { MiniMap } from '@/components/MiniMap';
import { PublicHeader } from '@/components/PublicHeader';
import {
  pagesItems,
  useFavorites,
  useSalon,
  useSalonReviewsInfinite,
  useToggleFavorite,
  type ReviewSort,
  useBookingStanding,
} from '@salondz/api-client';
import { LoadMore } from '@/components/LoadMore';
import {
  DAY_LABELS_FR,
  WEEK_DAYS,
  categoryLabel,
  formatDA,
  wilayaName,
  groupServices,
  formatDateShortDZ,
  ARRIVAL_ADVANCE_MINUTES,
  LATE_TOLERANCE_MINUTES,
  dayOfWeekFromKey,
  toLocalDateKey,
  SHOW_SALON_CONTACT_TO_CLIENTS,
} from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { formatRating } from '@/lib/clientPrefs';
import { formatDuration } from '@/lib/format';
import {
  Accordion,
  Button,
  I,
  IconButton,
  Img,
  LinkButton,
  Pill,
  Skeleton,
  Tabs,
  Avatar,
} from '@/components/ui';
import { SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';
import type { SalonPublic, Service } from '@salondz/types';

type Tab = 'book' | 'reviews' | 'about';

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
    if (h)
      return {
        open: false,
        label: `Fermé · ouvre ${i === 1 ? 'demain' : DAY_LABELS_FR[d as 0].toLowerCase()} ${h.opensAt}`,
      };
  }
  return { open: false, label: 'Fermé' };
}


export function Salon() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const back = useBack('/');
  const { session } = useAuth();
  const salon = useSalon(slug);
  const favs = useFavorites(!!session);
  const standing = useBookingStanding(salon.data?.id ?? '', !!session);
  const cannotBook = !!standing.data && !standing.data.canBook;
  const toggle = useToggleFavorite();
  const [tab, setTab] = useState<Tab>('book');
  // Catégories repliées par défaut : le client voit d'abord le salon, puis ouvre la sienne.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [reviewSort, setReviewSort] = useState<ReviewSort>('best');
  const [aboutOpen, setAboutOpen] = useState(false);
  const reviews = useSalonReviewsInfinite(salon.data?.id ?? '', 5, reviewSort);
  /**
   * UNE prestation par rendez-vous. Deux prestations, c'est deux rendez-vous : le salon
   * garde ainsi la main sur la durée réelle de chaque créneau. « Choisir » écrit donc un
   * brouillon d'un seul élément, en écrasant ce qu'il contenait, et enchaîne sur l'horaire.
   */
  const chooseService = (id: string) => {
    writeDraft(slug, { serviceIds: [id] });
    navigate(`/s/${slug}/reserver/quand`);
  };

  if (salon.isPending) return <Splash />;
  if (salon.isError) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;
  const s = salon.data;
  const isFav = !!favs.data?.items.some((x) => x.id === s.id);
  const status = openingStatus(s);
  const todayDow = dayOfWeekFromKey(toLocalDateKey());
  const todayRows = s.openingHours.filter((h) => h.dayOfWeek === todayDow && !h.isClosed);
  const weekFromToday = WEEK_DAYS.map((_, k) => ((todayDow + k) % 7) as (typeof WEEK_DAYS)[number]);
  const cats = s.categoryIds.map((c) => categoryLabel(c)).join(' · ');
  const place = `${s.zone ?? s.city}, ${wilayaName(s.wilayaCode)}`;
  const works = s.works;
  const groups = groupServices(s.services);
  const prices = s.services.map((x) => x.priceDa).filter((x) => x > 0);
  const priceRange = prices.length
    ? `${formatDA(Math.min(...prices))} – ${formatDA(Math.max(...prices))}`
    : null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.name, s.address, place].filter(Boolean).join(', '))}`;
  const reviewItems = pagesItems(reviews.data);

  return (
    <div className="min-h-dvh pb-6">
      {/* Visiteur arrivé par le lien du professionnel (sans compte) : en-tête complet Salon DZ, façon Planity. */}
      {!session && <PublicHeader />}
      {/* Onglets AVANT la couverture, et collants : on garde la main sur la page pendant
          qu'on descend dans les prestations, sans avoir à remonter tout en haut. */}
      <Tabs
        label="Sections du salon"
        value={tab}
        onChange={setTab}
        className={`sticky z-20 ${session ? 'top-0' : 'top-[3.75rem]'}`}
        options={[
          { value: 'book', label: 'Prendre RDV' },
          { value: 'reviews', label: 'Avis' },
          { value: 'about', label: 'À propos' },
        ]}
      />
      {/* Couverture */}
      <div className="relative h-[14rem] bg-line">
        {s.coverUrl && <img src={s.coverUrl} alt="" className="h-full w-full object-cover" />}
        <div className="absolute left-5 right-5 top-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <IconButton lg aria-label="Retour" onClick={back}>
              <I icon={ChevronLeft} />
            </IconButton>
          </div>
          <div className="flex gap-2.5">
            <IconButton
              lg
              aria-label="Partager"
              onClick={() => {
                const url = window.location.href;
                if (navigator.share)
                  void navigator.share({ title: s.name, url }).catch(() => undefined);
                else void navigator.clipboard.writeText(url);
              }}
            >
              <I icon={Share2} size={20} />
            </IconButton>
            <IconButton
              lg
              aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              aria-pressed={isFav}
              disabled={toggle.isPending}
              onClick={() =>
                session
                  ? toggle.mutate({ salonId: s.id, on: !isFav })
                  : navigate(`/connexion?next=${encodeURIComponent(`/s/${s.slug}`)}`)
              }
            >
              <Heart size={22} strokeWidth={1.6} fill={isFav ? 'currentColor' : 'none'} />
            </IconButton>
          </div>
        </div>
      </div>

      <div className="relative -mt-5 flex flex-col gap-3 rounded-t-[1.5rem] bg-bg px-4 pt-5">
        {/* Identité réservée à l'onglet de réservation : sur « Avis » et « À propos »
            elle répétait nom, adresse, note, prix et horaires alors que chaque onglet
            porte déjà ses propres titres. */}
        {tab === 'book' && (
          <>
          {/* Identité : le nom, où c'est, ce que ça vaut. Trois lignes, rien de plus. */}
          <div className="flex flex-col gap-1.5">
            <h1 className="h1 !text-[1.714rem]">{s.name}</h1>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[1rem] underline decoration-line-soft underline-offset-2"
            >
              <I icon={MapPin} size={16} className="flex-none text-muted" />
              <span className="min-w-0 truncate">{s.address ? `${s.address}, ${place}` : place}</span>
            </a>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[1rem]">
              <button
                type="button"
                className={`flex items-center gap-1${s.ratingCount > 0 ? '' : ' text-muted'}`}
                onClick={() => setTab('reviews')}
                aria-label={
                  s.ratingCount > 0
                    ? `${s.ratingCount} avis, note ${formatRating(s.ratingAvg)} sur 5 : voir les avis`
                    : 'Avis : voir les avis'
                }
              >
                <I icon={Star} size={16} className="flex-none" />
                {s.ratingCount > 0 ? (
                  <>
                    <span className="font-semibold">{formatRating(s.ratingAvg)}</span>
                    <span className="text-muted">({s.ratingCount} avis)</span>
                  </>
                ) : (
                  <span>Pas encore d'avis</span>
                )}
              </button>
              {priceRange && (
                <>
                  <span className="text-disabled" aria-hidden>
                    ·
                  </span>
                  <span className="text-muted">{priceRange}</span>
                </>
              )}
              <span className="text-disabled" aria-hidden>
                ·
              </span>
              <span className={status.open ? 'font-semibold text-ok-fg' : 'text-muted'}>
                {status.label}
              </span>
            </div>
          </div>

          {/* Deux gestes utiles tout de suite : joindre le salon, ou y aller. */}
          <div className="g2">
            {SHOW_SALON_CONTACT_TO_CLIENTS && s.phone ? (
              <a href={`tel:${s.phone}`} className="btn g sm !py-[0.9375rem] !text-[1rem]">
                <I icon={Phone} size={18} /> Appeler
              </a>
            ) : (
              <button
                type="button"
                className="btn g sm !py-[0.9375rem] !text-[1rem]"
                onClick={() => {
                  const url = window.location.href;
                  if (navigator.share)
                    void navigator.share({ title: s.name, url }).catch(() => undefined);
                  else void navigator.clipboard.writeText(url);
                }}
              >
                <I icon={Share2} size={18} /> Partager
              </button>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="btn g sm !py-[0.9375rem] !text-[1rem]"
            >
              <I icon={Navigation} size={18} /> Itinéraire
            </a>
          </div>
          </>
        )}

        {tab === 'book' && (
          <div className="flex flex-col gap-2.5">
            {/* Blocage ou suspension : dit d'emblée, en haut du choix, et non dans une
                feuille en bas d'écran que l'on découvre après avoir tout parcouru. */}
            {cannotBook && standing.data?.message && (
              <div
                className="flex items-start gap-3 rounded-[1rem] border border-danger-line bg-cancel-bg px-4 py-3"
                role="alert"
              >
                <I icon={Ban} size={20} className="mt-0.5 flex-none text-danger" />
                <span className="min-w-0">
                  <span className="block text-[1rem] font-bold text-cancel-fg">
                    Réservation en ligne impossible
                  </span>
                  <span className="block text-[1rem] text-cancel-fg">
                    {standing.data.message}
                  </span>
                  {SHOW_SALON_CONTACT_TO_CLIENTS && s.phone && (
                    <a
                      href={`tel:${s.phone}`}
                      className="mt-1 inline-flex items-center gap-1.5 text-[1rem] font-semibold text-cancel-fg underline"
                    >
                      <I icon={Phone} size={16} /> Appeler le salon
                    </a>
                  )}
                </span>
              </div>
            )}
            <h2 className="h1 !text-[1.429rem]">Choix de la prestation</h2>
            <p className="p !text-[1rem]">
              Une prestation par rendez-vous. Pour en cumuler plusieurs, prenez un
              rendez-vous par prestation.
            </p>
            {groups.map((g) => (
              <Accordion
                key={g.name}
                title={g.name}
                hint={`${g.services.length} prestation${g.services.length > 1 ? 's' : ''}`}
                open={openGroup === g.name}
                onToggle={() => setOpenGroup((cur) => (cur === g.name ? null : g.name))}
              >
                {g.services.map((sv) => (
                  <div key={sv.id} className="li !items-start">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {sv.photos?.[0]?.url && (
                        <Img
                          src={sv.photos[0].url}
                          className="h-[3rem] w-[3rem] flex-none !rounded-[0.75rem]"
                        />
                      )}
                      <div className="min-w-0">
                        <span className="block text-[1.143rem] font-bold tracking-[-0.3px]">
                          {sv.name}
                        </span>
                        {sv.description && (
                          <span className="mt-0.5 block text-[1rem] text-muted">
                            {sv.description}
                          </span>
                        )}
                        <span className="mt-1 block text-[1rem] font-semibold">
                          {formatDA(sv.priceDa)}
                          <span className="font-normal text-muted">
                            {' '}
                            · {formatDuration(sv.durationMinutes)}
                          </span>
                        </span>
                      </div>
                    </div>
                    <Button
                      sm
                      auto
                      className="mt-0.5 flex-none !rounded-full !px-5"
                      onClick={() => chooseService(sv.id)}
                      disabled={cannotBook}
                    >
                      Choisir
                    </Button>
                  </div>
                ))}
              </Accordion>
            ))}
            {s.services.length === 0 && <p className="p py-3">Aucune prestation pour le moment.</p>}
          </div>
        )}

        {tab === 'reviews' && (
          <div className="flex flex-col gap-2.5">
            <h2 className="h1 !text-[1.429rem]">Avis</h2>
            {s.ratingCount > 0 ? (
              <div className="crd !flex-row !items-center !gap-3.5">
                <span className="text-[2.286rem] font-semibold leading-none tracking-[-1px]">
                  {formatRating(s.ratingAvg)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[1.143rem] font-semibold">
                    {'★'.repeat(Math.round(s.ratingAvg))}
                    <span className="text-disabled">
                      {'★'.repeat(5 - Math.round(s.ratingAvg))}
                    </span>
                  </span>
                  <span className="block text-[1rem] text-muted">
                    {s.ratingCount} avis vérifié{s.ratingCount > 1 ? 's' : ''} · après rendez-vous
                  </span>
                </span>
              </div>
            ) : (
              <p className="p py-2">Pas encore d'avis : soyez le premier après votre rendez-vous.</p>
            )}
            {s.ratingCount > 0 && (
              <div className="pills -mx-4 px-4" role="group" aria-label="Trier les avis">
                <Pill lg on={reviewSort === 'best'} onClick={() => setReviewSort('best')}>
                  Mieux notés
                </Pill>
                <Pill lg on={reviewSort === 'recent'} onClick={() => setReviewSort('recent')}>
                  Plus récents
                </Pill>
              </div>
            )}
            {reviews.isPending && s.ratingCount > 0 && (
              <Skeleton className="h-[5rem] w-full !rounded-[1.25rem]" />
            )}
            {reviewItems.map((r) => (
              <div key={r.id} className="crd !gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[1rem] font-semibold">
                    {'★'.repeat(r.rating)}
                    <span className="text-disabled">{'★'.repeat(5 - r.rating)}</span>
                  </span>
                  <span className="text-[0.857rem] text-muted">
                    {formatDateShortDZ(r.createdAt)}
                  </span>
                </div>
                {r.comment && <p className="p">{r.comment}</p>}
              </div>
            ))}
            {reviewItems.length > 0 && (
              <LinkButton to={`/s/${s.slug}/avis`} variant="g">
                Tous les avis
              </LinkButton>
            )}
          </div>
        )}

        {tab === 'about' && (
          <div className="flex flex-col gap-2.5">
            {/* 1. Où. L'adresse n'est PAS répétée ici : le bloc d'identité, juste au-dessus,
                reste visible sur tous les onglets et la porte déjà, cliquable. Cette section
                n'ajoute que ce qu'il n'a pas, la carte. */}
            <h2 className="h1 !text-[1.429rem]">Où se situe le salon&nbsp;?</h2>
            <div className="relative">
              {s.lat != null && s.lng != null ? (
                <MiniMap lat={s.lat} lng={s.lng} radiusKm={0.4} className="h-[11rem]" />
              ) : (
                <div className="flex h-[11rem] items-center justify-center rounded-[1.25rem] border border-line bg-fill">
                  <span className="p">Position non renseignée</span>
                </div>
              )}
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="btn auto absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2 !rounded-full !px-5 !py-3 !text-[1rem]"
              >
                <I icon={MapIcon} size={18} /> Afficher la carte
              </a>
            </div>

            {/* 2. Quand. Aujourd'hui en tête, puis la semaine à partir d'aujourd'hui. */}
            <h2 className="h1 !text-[1.429rem]">Horaires d'ouverture</h2>
            <div className="crd !gap-0 !py-1">
              {weekFromToday.map((d, idx) => {
                const rows = s.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed);
                return (
                  <div key={d} className="li">
                    <span className={`text-[1rem] ${idx === 0 ? 'font-bold' : ''}`}>
                      {idx === 0 ? "Aujourd'hui" : idx === 1 ? 'Demain' : DAY_LABELS_FR[d]}
                      {idx <= 1 && (
                        <span className="ml-1.5 text-[1rem] font-normal text-muted">
                          {DAY_LABELS_FR[d]}
                        </span>
                      )}
                    </span>
                    <span
                      className={`mono text-[1rem] ${rows.length ? 'font-semibold' : 'text-muted'}`}
                    >
                      {rows.length
                        ? rows.map((h) => `${h.opensAt} – ${h.closesAt}`).join(', ')
                        : 'Fermé'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 3. Qui. Un prénom et un visage : on choisit aussi une personne. */}
            {s.staff.length > 0 && (
              <>
                <h2 className="h1 !text-[1.429rem]">
                  {s.staff.length > 1 ? 'Collaborateurs' : 'Collaborateur'}
                </h2>
                <div className="crd !gap-0 !py-1">
                  {s.staff.map((m) => (
                    <div key={m.id} className="li">
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar src={m.avatarUrl} name={m.displayName} size={44} />
                        <span className="truncate text-[1.143rem] font-semibold">
                          {m.displayName}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 4. Ce qu'il faut savoir : replié, on ne le lit que si on le cherche. */}
            {(s.description || cats) && (
              <>
                <h2 className="h1 !text-[1.429rem]">Informations</h2>
                <Accordion
                  title="À propos du salon"
                  open={aboutOpen}
                  onToggle={() => setAboutOpen((v) => !v)}
                >
                  <div className="flex flex-col gap-1.5 py-3">
                    {s.description && <p className="p">{s.description}</p>}
                    {cats && <p className="text-[1rem] text-muted">{cats}</p>}
                  </div>
                </Accordion>
              </>
            )}

            {/* 5. Réalisations : la vitrine du travail, propre à Salon DZ. */}
            {works.length > 0 && (
              <>
                <h2 className="h1 !text-[1.429rem]">Réalisations</h2>
                <div className="g2">
                  {works.slice(0, 6).map((ph) => (
                    <Img key={ph.id} src={ph.url} className="aspect-square w-full" />
                  ))}
                </div>
                {works.length > 6 && (
                  <LinkButton to={`/s/${s.slug}/realisations`} variant="g">
                    Voir toutes les réalisations
                  </LinkButton>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
