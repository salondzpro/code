/**
 * C-F 04 — Page du salon : couverture (retour, favori), nom, catégories — quartier, note, ouverture,
 * description, onglets Prestations / Réalisations / Infos, feuille « Réserver ».
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useBack } from '@/lib/useBack';
import {
  Check,
  ChevronLeft,
  Heart,
  Share2,
  Clock,
  Info,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Users,
  Ban,
  Star,
} from 'lucide-react';
import { readDraft, writeDraft } from '@/lib/bookingDraft';
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
  formatDZPhone,
  wilayaName,
  groupServices,
  formatDateShortDZ,
  ARRIVAL_ADVANCE_MINUTES,
  LATE_TOLERANCE_MINUTES,
  dayOfWeekFromKey,
  toLocalDateKey,
} from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { formatRating } from '@/lib/clientPrefs';
import { formatDuration } from '@/lib/format';
import {
  Accordion,
  BottomSheet,
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

/** Hauteur réelle de la feuille du bas (bandeau, résumé, bouton) → espace inférieur du contenu, rien n'est masqué. */
function useSheetHeight(): [(el: HTMLDivElement | null) => void, number] {
  const [h, setH] = useState(SHEET_PAD);
  const ro = useRef<ResizeObserver | null>(null);
  // Ref de rappel : la feuille n'existe qu'une fois le salon chargé, l'observateur s'attache à ce moment-là.
  const ref = useCallback((el: HTMLDivElement | null) => {
    ro.current?.disconnect();
    ro.current = null;
    if (!el) return;
    const update = () => setH(Math.ceil(el.getBoundingClientRect().height) + 24);
    update();
    if (typeof ResizeObserver !== 'undefined') {
      ro.current = new ResizeObserver(update);
      ro.current.observe(el);
    }
  }, []);
  return [ref, h];
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
  const [sheetRef, sheetH] = useSheetHeight();
  const reviews = useSalonReviewsInfinite(salon.data?.id ?? '', 5, reviewSort);
  // Sélection directe des prestations sur la page (brouillon partagé avec « Quand ? » et le récapitulatif).
  const [selected, setSelected] = useState<string[]>(() => readDraft(slug).serviceIds);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    writeDraft(slug, { serviceIds: selected });
  }, [slug, selected]);
  const toggleService = (id: string) => {
    setHint(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
  const chosen = selected
    .map((id) => s.services.find((x) => x.id === id))
    .filter((x): x is Service => !!x);
  const total = chosen.reduce((a, x) => a + x.priceDa, 0);
  const minutes = chosen.reduce((a, x) => a + x.durationMinutes, 0);

  return (
    <div className="min-h-dvh" style={{ paddingBottom: sheetH }}>
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
        {/* Identité : le nom, où c'est, ce que ça vaut. Trois lignes, rien de plus. */}
        <div className="flex flex-col gap-1.5">
          <h1 className="h1 !text-[1.625rem]">{s.name}</h1>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[0.9375rem] underline decoration-line-soft underline-offset-2"
          >
            <I icon={MapPin} size={16} className="flex-none text-muted" />
            <span className="min-w-0 truncate">{s.address ? `${s.address}, ${place}` : place}</span>
          </a>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem]">
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
          {s.phone ? (
            <a href={`tel:${s.phone}`} className="btn g sm !py-[0.9375rem] !text-[0.9375rem]">
              <I icon={Phone} size={17} /> Appeler
            </a>
          ) : (
            <button
              type="button"
              className="btn g sm !py-[0.9375rem] !text-[0.9375rem]"
              onClick={() => {
                const url = window.location.href;
                if (navigator.share)
                  void navigator.share({ title: s.name, url }).catch(() => undefined);
                else void navigator.clipboard.writeText(url);
              }}
            >
              <I icon={Share2} size={17} /> Partager
            </button>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="btn g sm !py-[0.9375rem] !text-[0.9375rem]"
          >
            <I icon={Navigation} size={17} /> Itinéraire
          </a>
        </div>

        {tab === 'book' && (
          <div className="flex flex-col gap-2.5">
            <h2 className="h1 !text-[1.375rem]">Choix de la prestation</h2>
            {groups.map((g) => (
              <Accordion
                key={g.name}
                title={g.name}
                hint={`${g.services.length} prestation${g.services.length > 1 ? 's' : ''}`}
                open={openGroup === g.name}
                onToggle={() => setOpenGroup((cur) => (cur === g.name ? null : g.name))}
              >
                {g.services.map((sv) => {
                  const on = selected.includes(sv.id);
                  return (
                    <button
                      key={sv.id}
                      type="button"
                      className="li w-full text-left"
                      onClick={() => toggleService(sv.id)}
                      aria-pressed={on}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        {sv.photos?.[0]?.url && (
                          <Img
                            src={sv.photos[0].url}
                            className="h-[3rem] w-[3rem] flex-none !rounded-[0.75rem]"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block text-[1.0625rem] font-bold tracking-[-0.3px]">
                            {sv.name}
                          </span>
                          <span className="block text-[0.9375rem] text-muted">
                            {formatDuration(sv.durationMinutes)} · {formatDA(sv.priceDa)}
                          </span>
                        </span>
                      </span>
                      <span className={`chk${on ? ' on' : ''}`} aria-hidden>
                        {on && <I icon={Check} size={16} />}
                      </span>
                    </button>
                  );
                })}
              </Accordion>
            ))}
            {s.services.length === 0 && <p className="p py-3">Aucune prestation pour le moment.</p>}
          </div>
        )}

        {tab === 'reviews' && (
          <div className="flex flex-col gap-2.5">
            <h2 className="h1 !text-[1.375rem]">Avis</h2>
            {s.ratingCount > 0 ? (
              <div className="crd !flex-row !items-center !gap-3.5">
                <span className="text-[2.25rem] font-bold leading-none tracking-[-1px]">
                  {formatRating(s.ratingAvg)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[1.0625rem] font-semibold">
                    {'★'.repeat(Math.round(s.ratingAvg))}
                    <span className="text-disabled">
                      {'★'.repeat(5 - Math.round(s.ratingAvg))}
                    </span>
                  </span>
                  <span className="block text-[0.875rem] text-muted">
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
                  <span className="text-[0.8125rem] text-muted">
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
          <>
            {/* La description a quitté le haut de page : elle appartient à « À propos »,
                pas au premier écran où le client cherche d'abord une prestation. */}
            {s.description && <p className="p">{s.description}</p>}
            {cats && <p className="text-[0.9375rem] text-muted">{cats}</p>}
            <h2 className="h1 !text-[1.375rem]">Réalisations</h2>
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

        {tab === 'about' && (
          <div className="flex flex-col gap-2.5">
            <h2 className="h1 !text-[1.375rem]">Informations</h2>
            {/* Aujourd'hui en premier et en grand, puis la semaine à partir d'aujourd'hui. */}
            <div className={`crd !gap-2 ${status.open ? '!border-ok-fg !bg-ok-bg' : ''}`}>
              <span className="flex items-center gap-2 text-[0.8125rem] font-bold uppercase tracking-[0.08em] text-muted">
                <I icon={Clock} size={15} /> Aujourd'hui · {DAY_LABELS_FR[todayDow]}
              </span>
              <span className="mono text-[1.75rem] font-bold leading-none tracking-[-0.8px]">
                {todayRows.length
                  ? todayRows.map((h) => `${h.opensAt} – ${h.closesAt}`).join(' · ')
                  : 'Fermé aujourd’hui'}
              </span>
              <span
                className={`text-[1rem] font-semibold ${status.open ? 'text-ok-fg' : 'text-muted'}`}
              >
                {status.label}
              </span>
            </div>
            <div className="crd !gap-0 !py-1">
              {weekFromToday.map((d, idx) => {
                const rows = s.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed);
                return (
                  <div key={d} className="li !py-3">
                    <span className={`text-[1rem] ${idx === 0 ? 'font-bold' : ''}`}>
                      {idx === 0 ? "Aujourd'hui" : idx === 1 ? 'Demain' : DAY_LABELS_FR[d]}
                      {idx <= 1 && (
                        <span className="ml-1.5 text-[0.875rem] font-normal text-muted">
                          {DAY_LABELS_FR[d]}
                        </span>
                      )}
                    </span>
                    <span className={`mono text-[1rem] ${rows.length ? '' : 'text-danger'}`}>
                      {rows.length
                        ? rows.map((h) => `${h.opensAt} – ${h.closesAt}`).join(', ')
                        : 'Fermé'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="crd !gap-3">
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-fill">
                  <I icon={MapPin} size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[1.0625rem] font-bold">{s.address || place}</span>
                  {s.address && <span className="block text-[0.9375rem] text-muted">{place}</span>}
                </span>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.name, s.address, place].filter(Boolean).join(', '))}`}
                target="_blank"
                rel="noreferrer"
                className="btn g sm !py-[1.125rem] !text-[1rem]"
              >
                <I icon={Navigation} size={18} /> Itinéraire
              </a>
            </div>

            {s.phone && (
              <div className="crd !gap-3">
                <div className="flex items-center gap-3.5">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-fill">
                    <I icon={Phone} size={20} />
                  </span>
                  <span className="mono text-[1.25rem] font-bold">{formatDZPhone(s.phone)}</span>
                </div>
                <div className="g2">
                  <a href={`tel:${s.phone}`} className="btn g sm !py-[1.125rem] !text-[1rem]">
                    <I icon={Phone} size={18} /> Appeler
                  </a>
                  <a
                    href={`https://wa.me/${s.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn g sm !py-[1.125rem] !text-[1rem]"
                  >
                    <I icon={MessageCircle} size={18} /> WhatsApp
                  </a>
                </div>
              </div>
            )}

            {s.staff.length > 0 && (
              <div className="crd !gap-3">
                <span className="flex items-center gap-2 text-[0.8125rem] font-bold uppercase tracking-[0.08em] text-muted">
                  <I icon={Users} size={15} /> Équipe · {s.staff.length}
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {s.staff.map((m) => (
                    <span
                      key={m.id}
                      className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3.5 text-[1rem] font-semibold"
                    >
                      <Avatar src={m.avatarUrl} name={m.displayName} size={32} /> {m.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="crd !gap-2">
              <span className="flex items-center gap-2 text-[0.8125rem] font-bold uppercase tracking-[0.08em] text-muted">
                <I icon={Info} size={15} /> Bon à savoir
              </span>
              <ul className="ml-1 flex list-disc flex-col gap-1.5 pl-4 text-[1rem]">
                <li>Réservation en ligne, paiement sur place.</li>
                <li>
                  Annulation ou report en ligne jusqu'à {s.cancelMinHours} h avant le rendez-vous.
                </li>
                <li>
                  Arrivez {ARRIVAL_ADVANCE_MINUTES} min avant l'heure : retard toléré{' '}
                  {LATE_TOLERANCE_MINUTES} min.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Un seul parcours : cocher ici → créneau → récapitulatif. Blocage / suspension : dit d'emblée, bouton grisé. */}
      <BottomSheet grab={false} sheetRef={sheetRef}>
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
              <span className="block text-[0.9375rem] text-cancel-fg">{standing.data.message}</span>
              {s.phone && (
                <a
                  href={`tel:${s.phone}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-cancel-fg underline"
                >
                  <I icon={Phone} size={14} /> Appeler le salon
                </a>
              )}
            </span>
          </div>
        )}
        {chosen.length > 0 ? (
          <>
            {/* Prix et résumé à gauche (tronqués si besoin), bouton à droite qui ne se déforme jamais. */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[1.5rem] font-bold tracking-[-0.6px]">{formatDA(total)}</div>
                <div className="truncate text-[0.9375rem] text-muted">
                  {chosen.length} prestation{chosen.length > 1 ? 's' : ''} ·{' '}
                  {formatDuration(minutes)} au total
                </div>
              </div>
              <Button
                auto
                className="flex-none whitespace-nowrap !rounded-full !px-6 !py-4"
                onClick={() => navigate(`/s/${s.slug}/reserver/quand`)}
                disabled={cannotBook}
              >
                Choisir un créneau
              </Button>
            </div>
          </>
        ) : (
          <>
            {hint && (
              <p className="p text-center text-danger" role="alert">
                Cochez une ou plusieurs prestations ci-dessus.
              </p>
            )}
            <Button
              onClick={() => {
                setTab('book');
                setHint(true);
              }}
              disabled={cannotBook}
            >
              Réserver
            </Button>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
