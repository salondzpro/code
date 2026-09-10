/**
 * C-F 04 — Page du salon : couverture (retour, favori), nom, catégories — quartier, note, ouverture,
 * description, onglets Prestations / Réalisations / Infos, feuille « Réserver ».
 */
import { useEffect, useState } from 'react';
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
  BottomSheet,
  Button,
  I,
  IconButton,
  Img,
  LinkButton,
  Segmented,
  Pill,
  Skeleton,
  Avatar,
} from '@/components/ui';
import { SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';
import type { SalonPublic, Service } from '@salondz/types';

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
  const [tab, setTab] = useState<Tab>('services');
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
  const chosen = selected
    .map((id) => s.services.find((x) => x.id === id))
    .filter((x): x is Service => !!x);
  const total = chosen.reduce((a, x) => a + x.priceDa, 0);
  const minutes = chosen.reduce((a, x) => a + x.durationMinutes, 0);

  return (
    <div className="min-h-dvh" style={{ paddingBottom: SHEET_PAD }}>
      {/* Visiteur arrivé par le lien du professionnel (sans compte) : en-tête complet Salon DZ, façon Planity. */}
      {!session && <PublicHeader />}
      {/* Couverture */}
      <div className="relative h-[18.75rem] bg-line">
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

      <div className="relative -mt-5 flex flex-col gap-4 rounded-t-[1.5rem] bg-bg px-5 pt-6">
        <div>
          <h1 className="h1 !text-[1.625rem]">{s.name}</h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {cats} — {place}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {/* Toujours cliquable : la liste des avis est fraîche même quand la fiche (cache 60 s) ne compte pas encore le dernier. */}
          <button
            type="button"
            className={`pill soft !text-[0.9375rem] !font-semibold${s.ratingCount > 0 ? '' : ' !text-muted'}`}
            onClick={() => navigate(`/s/${s.slug}/avis`)}
            aria-label={
              s.ratingCount > 0
                ? `${s.ratingCount} avis, note ${formatRating(s.ratingAvg)} sur 5 : voir les avis`
                : 'Avis : voir les avis'
            }
          >
            {s.ratingCount > 0
              ? `★ ${formatRating(s.ratingAvg)} · ${s.ratingCount} avis`
              : '★ Avis'}
          </button>
          <span className={`badge md !text-[0.9375rem] ${status.open ? 'b-ok' : 'b-nu'}`}>
            <span className="dot" />
            {status.label}
          </span>
        </div>
        {s.description && <p className="p text-[0.8125rem]">{s.description}</p>}

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
          <div className="flex flex-col gap-3">
            {groupServices(s.services).map((g) => (
              <div key={g.name} className="flex flex-col gap-2">
                <span className="h3">{g.name}</span>
                <div className="crd !gap-0 !py-1">
                  {g.services.map((sv) => {
                    const on = selected.includes(sv.id);
                    return (
                      <button
                        key={sv.id}
                        type="button"
                        className="li w-full !py-4 text-left"
                        onClick={() => toggleService(sv.id)}
                        aria-pressed={on}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-3.5">
                          {sv.photos?.[0]?.url && (
                            <Img
                              src={sv.photos[0].url}
                              className="h-[3.75rem] w-[3.75rem] flex-none !rounded-[0.875rem]"
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
                </div>
              </div>
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
      <BottomSheet grab={false}>
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
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[1.5rem] font-bold tracking-[-0.6px]">{formatDA(total)}</div>
              <div className="p truncate">
                {chosen.length} prestation{chosen.length > 1 ? 's' : ''} · {formatDuration(minutes)}{' '}
                au total
              </div>
            </div>
            <Button
              auto
              className="!rounded-full !px-6 !py-4"
              onClick={() => navigate(`/s/${s.slug}/reserver/quand`)}
            >
              Choisir un créneau
            </Button>
          </div>
        ) : (
          <>
            {hint && (
              <p className="p text-center text-danger" role="alert">
                Cochez une ou plusieurs prestations ci-dessus.
              </p>
            )}
            <Button
              onClick={() => {
                setTab('services');
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
