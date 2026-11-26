/**
 * CHOIX DU CRÉNEAU — FAÇON PLANITY (19 nov. 2026, demande du propriétaire : « 100 % comme Planity »).
 *
 * Nom du salon, puis deux sections numérotées :
 *  1. Prestation sélectionnée : carte blanche (nom, durée • prix, « Supprimer »), « Choisir avec qui ? »
 *     (équipe ≥ 2), bouton noir « Ajouter une prestation à la suite » (plusieurs prestations = UN
 *     rendez-vous, `create_booking_multi`).
 *  2. Choix de la date & heure : une carte par jour ouvert qui se (plus de bouton « Choisir une date »,
 *     retiré le 21 nov. 2026 : il ressemblait à une action principale)
 *     déplie (la première ouverte) : grille de 3 heures, neuf visibles puis « Voir plus » ; en bas,
 *     « Afficher plus de disponibilités ». TOUCHER UNE HEURE = continuer vers la confirmation.
 * Les créneaux viennent toujours de `GET /salons/:id/availability` (jamais calculés au front).
 */
import { OAuthButtons } from '@/components/GoogleButton';
import { ICONE } from '@/lib/actionIcons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { ChevronDown } from 'lucide-react';
import { useAvailability, useSalon, useSalonBookingLimits } from '@salondz/api-client';
import {
  TIMEZONE,
  addDaysToKey,
  dayOfWeekFromKey,
  formatDA,
  formatLocale,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
} from '@salondz/constants';
import type { SalonPublic } from '@salondz/types';
import { readDraft, writeDraft } from '@/lib/bookingDraft';
import { setGuestMarket } from '@/lib/useClientMarket';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import { Button, I, Skeleton } from '@/components/ui';
import { ErrorMessage } from '@/components/ErrorMessage';
import { PageLoading } from '@/components/PageLoading';
import { t } from '@/i18n';

/** Jours affichés par paquet (« Afficher plus de disponibilités » en ajoute autant). */
const PAQUET = 7;
/** Heures visibles dans un jour avant « Voir plus ». */
const VISIBLES = 9;

/** « Jeudi 19 novembre » pour une clé « AAAA-MM-JJ ». */
function jourLong(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const txt = new Intl.DateTimeFormat(formatLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TIMEZONE,
  }).format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function BookingWhen() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const salon = useSalon(slug);
  const limites = useSalonBookingLimits(salon.data?.id);
  const [draft, setDraft] = useState(() => readDraft(slug));
  const today = toLocalDateKey();
  // Jamais dans le passé : un vieux brouillon garde parfois un jour déjà écoulé.
  const [debut, setDebut] = useState(draft.date && draft.date > today ? draft.date : today);
  const [nbJours, setNbJours] = useState(PAQUET);
  const [ouverts, setOuverts] = useState<Set<string> | null>(null);
  const [staffId, setStaffId] = useState<string | null>(draft.staffId ?? null);
  const [ajout, setAjout] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  // Jours dépliés d'office quand le précédent est complet (voir `jourVide`). Déclaré AVANT tout retour
  // anticipé : un hook placé après faisait planter l'écran (erreur React #310) au rechargement.
  const [autoOuverts, setAutoOuverts] = useState<string[]>([]);
  const { session } = useAuth();
  const serviceIds = draft.serviceIds;
  const s = salon.data;

  const chosen = useMemo(
    () => (s ? serviceIds.map((id) => s.services.find((x) => x.id === id)).filter((x) => !!x) : []),
    [s, serviceIds],
  );

  if (serviceIds.length === 0) return <Navigate to={`/s/${slug}`} replace />;
  if (salon.isPending) return <PageLoading />;
  if (salon.isError || !s) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;

  const team = s.staff ?? [];
  const maxDate = addDaysToKey(today, s.bookingHorizonDays);
  const ouvert = (k: string) => s.openingHours.some((h) => h.dayOfWeek === dayOfWeekFromKey(k) && !h.isClosed);
  // Les jours OUVERTS à partir du début choisi, dans l'horizon de réservation du salon.
  const jours: string[] = [];
  for (let k = debut; jours.length < nbJours && k <= maxDate; k = addDaysToKey(k, 1)) if (ouvert(k)) jours.push(k);
  const encore = jours.length === nbJours && addDaysToKey(jours[jours.length - 1]!, 1) <= maxDate;
  // JOUR COMPLET DÉPLIÉ D'OFFICE (21 nov. 2026, audit) : la page déplie le jour suivant, et ainsi de
  // suite (7 jours au plus), jusqu'au premier qui a des créneaux — tant que la personne n'a rien plié.
  const estOuvert = (k: string) => (ouverts ? ouverts.has(k) : k === jours[0] || autoOuverts.includes(k));
  const jourVide = (k: string) => {
    if (ouverts) return;
    const i = jours.indexOf(k);
    const suivant = jours[i + 1];
    if (i < 0 || !suivant || autoOuverts.length >= 7) return;
    setAutoOuverts((cur) => (cur.includes(suivant) ? cur : [...cur, suivant]));
  };
  const basculer = (k: string) =>
    setOuverts((cur) => {
      const n = new Set(cur ?? [...(jours[0] ? [jours[0]] : []), ...autoOuverts]);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const majServices = (ids: string[]) => {
    setDraft(writeDraft(slug, { serviceIds: ids, startsAt: undefined }));
    if (ids.length === 0) navigate(`/s/${slug}`);
  };

  /** Un créneau choisi = on passe tout de suite à la confirmation. */
  const go = (d: string, iso: string) => {
    setDraft(writeDraft(slug, { date: d, startsAt: iso, staffId }));
    if (session) return navigate(`/s/${s.slug}/reserver/recap`);
    // Sans compte, comme Planity : la page se replie sur « 2. Date et heure sélectionnées » et
    // « 3. Identification » ; la connexion ramène sur la confirmation.
    if (s.genderTarget === 'men' || s.genderTarget === 'women') setGuestMarket(s.genderTarget);
    setPicked(iso);
    window.scrollTo({ top: 0 });
  };

  const autres = s.services.filter((x) => !serviceIds.includes(x.id));
  // Limite du salon (bouclier, 26 nov. 2026) : 1 prestation par rendez-vous par défaut, réglable par le pro.
  const peutAjouter = serviceIds.length < (limites.data?.maxServices ?? 1);

  if (picked && !session) {
    const suite = encodeURIComponent(`/s/${s.slug}/reserver/recap`);
    const jour = new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TIMEZONE }).format(new Date(picked));
    return (
      <div className="rd pl-bk h-app">
        <h1 className="pl-bk-t">{s.name}</h1>
        <h2 className="pl-h2 pl-bk-h">
          <span className="pl-num">1.</span> {t('Prestation sélectionnée')}
        </h2>
        <div className="pl-card pl-bk-sel">
          {chosen.map((sv) => (
            <div key={sv.id} className="pl-bk-sv">
              <div className="min-w-0">
                <span className="pl-bk-svn">{sv.name}</span>
                <span className="pl-bk-svm" dir="ltr">
                  {formatDuration(sv.durationMinutes)}
                  <span className="pl-dot" aria-hidden>•</span>
                  <b>{formatDA(sv.priceDa)}</b>
                </span>
              </div>
              <button
                type="button"
                className="pl-link"
                onClick={() => {
                  setPicked(null);
                  majServices(serviceIds.filter((x) => x !== sv.id));
                }}
              >
                {t('Supprimer')}
              </button>
            </div>
          ))}
        </div>
        <h2 className="pl-h2 pl-bk-h">
          <span className="pl-num">2.</span> {t('Date et heure sélectionnées')}
        </h2>
        <div className="pl-card pl-bk-sel">
          <div className="pl-bk-sv">
            <div className="min-w-0">
              <span className="pl-bk-svn">{jour}</span>
              <span className="pl-bk-svm">{t('à {heure}', { heure: formatTimeDZ(picked) })}</span>
            </div>
            <button type="button" className="pl-link" onClick={() => setPicked(null)}>
              {t('Modifier')}
            </button>
          </div>
        </div>
        <h2 className="pl-h2 pl-bk-h">
          <span className="pl-num">3.</span> {t('Identification')}
        </h2>
        <div className="pl-card pl-id-box">
          {/* Google d'abord : un toucher, sans mot de passe, puis retour sur la confirmation. */}
          <OAuthButtons role="client" next={`/s/${s.slug}/reserver/recap`} />
          <p>{t('Nouveau sur Salon DZ ?')}</p>
          {/* Directement sur le formulaire d'inscription : plus d'écran de connexion intermédiaire. */}
          <Link to={`/acces/creer?next=${suite}`} className="pl-btn pl-btn-out">
            {t('Créer mon compte')}
          </Link>
          <span className="pl-ou">{t('OU')}</span>
          <p>{t('Vous avez déjà utilisé Salon DZ ?')}</p>
          <Link to={`/acces?next=${suite}`} className="pl-btn pl-btn-ink">
            {t('Se connecter')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rd pl-bk h-app">
      <h1 className="pl-bk-t">{s.name}</h1>

      <h2 className="pl-h2 pl-bk-h">
        <span className="pl-num">1.</span> {t('Prestation sélectionnée')}
      </h2>
      <div className="pl-card pl-bk-sel">
        {chosen.map((sv) => (
          <div key={sv.id} className="pl-bk-sv">
            <div className="min-w-0">
              <span className="pl-bk-svn">{sv.name}</span>
              <span className="pl-bk-svm" dir="ltr">
                {formatDuration(sv.durationMinutes)}
                <span className="pl-dot" aria-hidden>•</span>
                <b>{formatDA(sv.priceDa)}</b>
              </span>
            </div>
            <button type="button" className="pl-link" onClick={() => majServices(serviceIds.filter((x) => x !== sv.id))}>
              {t('Supprimer')}
            </button>
          </div>
        ))}
        {team.length >= 2 && (
          <label className="pl-select">
            <select value={staffId ?? ''} onChange={(e) => setStaffId(e.target.value || null)} aria-label={t('Choisir avec qui ?')}>
              <option value="">{t('Choisir avec qui ?')}</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
            <I icon={ChevronDown} size={16} strokeWidth={2} className="pointer-events-none" />
          </label>
        )}
      </div>

      {autres.length > 0 && peutAjouter && (
        <div className="pl-bk-add">
          <button type="button" className="pl-btn pl-btn-ink pl-btn-sm" onClick={() => setAjout((v) => !v)} aria-expanded={ajout}>
            {t('Ajouter une prestation à la suite')}
          </button>
          {ajout && (
            <div className="pl-card">
              {autres.map((sv) => (
                <div key={sv.id} className="pl-sv">
                  <span className="pl-sv-n">{sv.name}</span>
                  <div className="pl-sv-r">
                    <span dir="ltr">
                      <b>{formatDA(sv.priceDa)}</b>
                      <span className="pl-dot" aria-hidden>•</span>
                      {formatDuration(sv.durationMinutes)}
                    </span>
                    <button
                      type="button"
                      className="pl-choisir"
                      onClick={() => {
                        majServices([...serviceIds, sv.id]);
                        setAjout(false);
                      }}
                    >
                      {t('Choisir')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <h2 className="pl-h2 pl-bk-h">
        <span className="pl-num">2.</span> {t('Choix de la date & heure')}
      </h2>
      <div className="pl-days">
        {jours.map((k) => (
          <Jour
            key={k}
            salon={s}
            dateKey={k}
            serviceIds={serviceIds}
            staffId={staffId}
            open={estOuvert(k)}
            onToggle={() => basculer(k)}
            onVide={() => jourVide(k)}
            choisi={draft.startsAt ?? null}
            onPick={(iso) => go(k, iso)}
          />
        ))}
        {jours.length === 0 && <p className="p px-4">{t('Aucune disponibilité.')}</p>}
        {encore && (
          <button type="button" className="pl-card pl-more" onClick={() => setNbJours((n) => n + PAQUET)}>
            {t('Afficher plus de disponibilités')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Une carte de jour : en-tête qui se déplie, puis les heures libres (chargées à l'ouverture). */
function Jour({
  salon,
  dateKey,
  serviceIds,
  staffId,
  open,
  onToggle,
  onVide,
  choisi,
  onPick,
}: {
  salon: SalonPublic;
  dateKey: string;
  serviceIds: string[];
  staffId: string | null;
  open: boolean;
  onToggle: () => void;
  /** Jour ouvert sans aucun créneau : le parent déplie le suivant. */
  onVide?: () => void;
  choisi: string | null;
  onPick: (iso: string) => void;
}) {
  const [tout, setTout] = useState(false);
  const q = { serviceIds: serviceIds.join(','), date: dateKey, ...(staffId ? { staffId } : {}) };
  // Requête seulement pour un jour OUVERT à l'écran : un identifiant vide la met en attente.
  const dispo = useAvailability(open ? salon.id : '', q);
  const libres = useMemo(
    () =>
      (dispo.data?.slots ?? [])
        .filter((x) => new Date(x.startsAt).getTime() > Date.now())
        .map((x) => ({ iso: x.startsAt, time: formatTimeDZ(x.startsAt) })),
    [dispo.data],
  );
  const montres = tout ? libres : libres.slice(0, VISIBLES);
  const vide = open && dispo.isSuccess && libres.length === 0;
  useEffect(() => {
    if (vide) onVide?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vide]);

  return (
    <div className="pl-card pl-day">
      <button type="button" className="pl-day-h" aria-expanded={open} onClick={onToggle}>
        <span>{jourLong(dateKey)}</span>
        <I icon={ChevronDown} size={18} strokeWidth={2} className={`flex-none transition-transform duration-150${open ? ' rotate-180' : ''}`} />
      </button>
      {open &&
        (dispo.isPending ? (
          <div className="pl-slots">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 !rounded-[var(--radius-slot)]" />
            ))}
          </div>
        ) : dispo.isError ? (
          <div className="px-4 pb-4">
            <ErrorMessage error={dispo.error} retry={() => dispo.refetch()} />
          </div>
        ) : libres.length === 0 ? (
          <Complet salon={salon} dateKey={dateKey} serviceId={serviceIds[0]} />
        ) : (
          <>
            <div className="pl-slots">
              {montres.map((g) => (
                <button key={g.iso} type="button" className={`pl-slot${choisi === g.iso ? ' on' : ''}`} onClick={() => onPick(g.iso)}>
                  {g.time}
                </button>
              ))}
            </div>
            {libres.length > VISIBLES && !tout && (
              <button type="button" className="pl-voir" onClick={() => setTout(true)}>
                {t('Voir plus')}
              </button>
            )}
          </>
        ))}
    </div>
  );
}

/** Jour complet : la phrase, puis « M'alerter si un créneau se libère » (liste d'attente). */
function Complet({ salon, dateKey, serviceId }: { salon: SalonPublic; dateKey: string; serviceId?: string }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [alertId, setAlertId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    api.me
      .slotAlerts(salon.id)
      .then((r) => alive && setAlertId(r.items.find((a) => a.day === dateKey)?.id ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [session, salon.id, dateKey]);
  const add = async () => setAlertId((await api.me.addSlotAlert({ salonId: salon.id, day: dateKey, serviceId })).id);
  // Visiteur sans compte (19 nov. 2026) : on retient le jour et l'intention ; de retour connecté,
  // l'alerte se crée toute seule sur ce jour, sans avoir à retoucher le bouton.
  const [params, setParams] = useSearchParams();
  const voulue = params.get('alerte') === dateKey;
  useEffect(() => {
    if (!session || !voulue) return;
    setParams((p) => {
      p.delete('alerte');
      return p;
    }, { replace: true });
    void add().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, voulue]);
  const toggle = async () => {
    if (!session) {
      writeDraft(salon.slug, { date: dateKey });
      return navigate(`/acces?next=${encodeURIComponent(`/s/${salon.slug}/reserver/quand?alerte=${dateKey}`)}`);
    }
    setBusy(true);
    try {
      if (alertId) {
        await api.me.removeSlotAlert(alertId);
        setAlertId(null);
      } else await add();
    } catch {
      /* l'état reste tel quel */
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-start gap-3 px-4 pb-4">
      <span className="text-[1rem] text-muted">
        {t('Complet')} · {relativeDayLabelDZ(dateKey)}
      </span>
      <Button icon={ICONE.alerter} variant="g" sm auto onClick={() => void toggle()} disabled={busy}>
        {alertId ? t('Alerte activée · retirer') : t("M'alerter si un créneau se libère")}
      </Button>
    </div>
  );
}
