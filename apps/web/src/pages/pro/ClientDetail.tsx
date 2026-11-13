/**
 * Espace pro — Fiche client, sur le modèle des outils du métier (Planity Pro) : l'identité
 * en tête avec trois gestes (appeler, WhatsApp, prendre rendez-vous), quatre chiffres qui
 * comptent (visites, dépensé, annulations, absences — en rouge dès qu'il y en a), puis les
 * faits en lignes (prochain rendez-vous, dernière visite, e-mail), les notes privées, et
 * l'historique sous des onglets. Bloquer est un geste rare : il vit tout en bas, seul.
 *
 * Un rendez-vous passé encore « Confirmé » se règle sur place : Terminé ou Client absent.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Ban,
  CalendarClock,
  CalendarX2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { ICONE } from '@/lib/actionIcons';
import {
  useProBookingMutations,
  useProClient,
  useProClientHistoryPage,
  useProClientMutations,
  useProSalon,
} from '@salondz/api-client';
import {
  formatDA,
  formatDZPhone,
  formatDateShortDZ,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
  untilLabelFR, formatLocale } from '@salondz/constants';
import type { ProClientHistoryItem } from '@salondz/types';
import type { ClientHistoryStatus } from '@salondz/validation';
import { ErrorMessage, errorText } from '@/components/ErrorMessage';
import { FactRow } from '@/components/BookingFacts';
import {
  Avatar,
  Badge,
  Button,
  I,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
  TopBar,
} from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { PageLoading } from '@/components/PageLoading';
import { t } from '@/i18n';

/** « Annulé par le client », « Annulé par le salon », « Expiré » (demande jamais validée). */
export function historyStatusLabel(
  h: Pick<ProClientHistoryItem, 'status' | 'cancelledBy'>,
): string | null {
  if (h.status !== 'cancelled') return null;
  if (h.cancelledBy === 'client') return 'Annulé par le client';
  if (h.cancelledBy === 'salon') return 'Annulé par le salon';
  return 'Demande expirée';
}

const DZ = 'Africa/Algiers';
const dayNum = (iso: string) =>
  new Intl.DateTimeFormat(formatLocale(), { day: 'numeric', timeZone: DZ }).format(new Date(iso));
const monthShort = (iso: string) =>
  new Intl.DateTimeFormat(formatLocale(), { month: 'short', timeZone: DZ })
    .format(new Date(iso))
    .replace('.', '');
const yearOf = (iso: string) =>
  new Intl.DateTimeFormat(formatLocale(), { year: 'numeric', timeZone: DZ }).format(new Date(iso));

/** Pavé date de l'historique : jour en grand, mois — et l'année quand ce n'est pas celle-ci. */
function DateBlock({ iso, muted }: { iso: string; muted?: boolean }) {
  const thisYear = yearOf(new Date().toISOString());
  return (
    <span
      className={`flex w-[3.25rem] flex-none flex-col items-center rounded-[var(--radius-card-sm)] bg-fill py-1.5 ${muted ? 'text-muted' : ''}`}
    >
      <span className="text-[1.429rem] font-semibold leading-none tracking-[-0.5px]">
        {dayNum(iso)}
      </span>
      <span className="text-[0.857rem] text-muted">
        {monthShort(iso)}
        {yearOf(iso) !== thisYear ? ` ${yearOf(iso).slice(2)}` : ''}
      </span>
    </span>
  );
}

type Filter = 'all' | 'done' | 'cancelled' | 'noshow';
const FILTER_STATUS: Record<Filter, ClientHistoryStatus | undefined> = {
  all: undefined,
  done: 'completed',
  cancelled: 'cancelled',
  noshow: 'no_show',
};
/** Dix rendez-vous par page : une page tient à l'écran, on feuillette le reste. */
const HISTORY_PAGE_SIZE = 10;

/** Pied de liste : « Page 2 sur 5 », précédent / suivant. Ne s'affiche que s'il y a plusieurs pages. */
function Pager({
  page,
  pages,
  onPage,
  loading,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
  loading?: boolean;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 py-2" aria-label={t("Pages de l'historique")}>
      <Button variant="g" sm auto disabled={page === 0 || loading} onClick={() => onPage(page - 1)}>
        <I icon={ChevronLeft} size={16} /> {t("Précédent")}
      </Button>
      <span className="text-[0.857rem] text-muted" aria-live="polite">
        {t("Page")}{' '}{page + 1} {t("sur")}{' '}{pages}
      </span>
      <Button variant="g" sm auto disabled={page >= pages - 1 || loading} onClick={() => onPage(page + 1)}>
        {t("Suivant")}{' '}<I icon={ChevronRight} size={16} />
      </Button>
    </nav>
  );
}

/**
 * Une ligne d'historique. Un rendez-vous passé encore « Confirmé » se règle sur place :
 * Terminé ou Client absent.
 */
function LigneHistorique({ h, now, team }: { h: ProClientHistoryItem; now: number; team: boolean }) {
  const navigate = useNavigate();
  const { setStatus } = useProBookingMutations();
  const past = new Date(h.startsAt).getTime() < now;
  const pendingOutcome = h.status === 'confirmed' && past;
  const cancelled = h.status === 'cancelled';
  return (
    <div className="flex flex-col gap-2.5 border-b border-line-soft py-2.5 last:border-b-0">
      <button type="button" className="flex w-full items-center gap-3 text-start" onClick={() => navigate(`/pro/rendez-vous/${h.id}`)}>
        <DateBlock iso={h.startsAt} muted={cancelled} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[1rem] font-semibold ${cancelled ? 'text-muted' : ''}`}>{h.serviceName}</span>
          <span className="block truncate text-[0.857rem] text-muted">
            <span className="mono">{formatTimeDZ(h.startsAt)}</span> · {formatDA(h.priceDa)}
            {team && h.staffName ? ` · ${h.staffName}` : ''}
          </span>
        </span>
        <span className="flex flex-none items-center gap-1.5">
          {cancelled ? <Badge tone="cn">{historyStatusLabel(h)}</Badge> : <StatusBadge status={h.status} />}
          <I icon={ChevronRight} size={16} className="text-disabled rtl:-scale-x-100" />
        </span>
      </button>
      {pendingOutcome && (
        <div className="g2">
          <Button sm icon={ICONE.terminer} disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: h.id, status: 'completed' })}>
            {t('Terminé')}
          </Button>
          <Button sm variant="g" icon={ICONE.absent} disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: h.id, status: 'no_show' })}>
            {t('Client absent')}
          </Button>
        </div>
      )}
      {pendingOutcome && setStatus.error && <ErrorMessage error={setStatus.error} className="mt-2" />}
    </div>
  );
}

export function ClientDetail() {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const client = useProClient(key);
  const salon = useProSalon().data?.salon ?? null;
  /** Tri du fichier client : on vient y chercher une catégorie, rarement la liste entière. */
  const [filter, setFilter] = useState<Filter>('all');
  /**
   * Historique PAGINÉ (dix par page) plutôt que déroulé sans fin : un habitué a des dizaines
   * de rendez-vous, et un fichier client se feuillette — « page 3 sur 8 » dit où l'on en est,
   * un « voir plus » infini ne le dit jamais. Le filtre est appliqué par le serveur.
   */
  const [page, setPage] = useState(0);
  const status = FILTER_STATUS[filter];
  const history = useProClientHistoryPage(key, page, HISTORY_PAGE_SIZE, status, !!key);
  const shown = history.data?.items ?? [];
  const { block, unblock, setNotes } = useProClientMutations();
  const c = client.data ?? null;
  const [notes, setNotesDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /** Note : le champ ne s'affiche que si une note existe, ou sur demande. */
  const [ouvrirNote, setOuvrirNote] = useState(false);
  /** Historique complet (onglets, pages) : sur demande ; sinon les trois derniers. */
  const [toutHistorique, setToutHistorique] = useState(false);
  const historyTop = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (c) setNotesDraft(c.notes ?? '');
  }, [c?.notes, c]);

  if (client.isPending) return <PageLoading />;
  if (!c)
    return (
      <Screen bottom={NAV_PAD} gap={16}>
        <TopBar backTo="/pro/clients" />
        <p className="p">{t("Client introuvable.")}</p>
      </Screen>
    );
  // Un blocage n'empêche vraiment quelque chose que si la personne peut réserver en ligne,
  // c'est-à-dire si elle a un compte ou un numéro. Sinon c'est un repère dans la clientèle.
  const blocageOpposable = !!(c.clientId || c.phone);
  const now = Date.now();
  // Le membre n'est nommé dans l'historique que si le salon a une équipe : seul, c'est du bruit.
  const team = (salon?.staff.filter((m) => m.isActive).length ?? 0) > 1;
  const toggleBlock = async () => {
    setError(null);
    try {
      if (c.blocked) await unblock.mutateAsync({ clientKey: key });
      else await block.mutateAsync({ clientKey: key });
    } catch (err) {
      setError(errorText(err));
    }
  };
  /** Les notes s'enregistrent en quittant le champ : pas de bouton à chercher. */
  const saveNotes = async () => {
    if (notes.trim() === (c.notes ?? '')) return;
    setError(null);
    try {
      await setNotes.mutateAsync({ key, notes: notes.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(errorText(err));
    }
  };
  // Le total pour ce filtre vient avec la page (fenêtre SQL) : exact, sans requête de plus.
  const total = history.data?.total ?? 0;
  const newBookingUrl = `/pro/rendez-vous/nouveau?name=${encodeURIComponent(c.name)}${c.phone ? `&phone=${encodeURIComponent(c.phone)}` : ''}`;
  const nextKey = c.nextAt ? toLocalDateKey(new Date(c.nextAt)) : null;
  const wa = c.phone ? `https://wa.me/${c.phone.replace(/\D/g, '')}` : null;

  /** Le signal qui compte : annulations et absences, seulement s'il y en a. */
  const alertes = [
    c.cancelledCount > 0 ? t(c.cancelledCount > 1 ? '{n} annulations' : '{n} annulation', { n: c.cancelledCount }) : null,
    c.noShowCount > 0 ? t(c.noShowCount > 1 ? '{n} absences' : '{n} absence', { n: c.noShowCount }) : null,
  ].filter(Boolean);
  const resume = [
    c.completedCount > 0 ? t(c.completedCount > 1 ? '{n} visites' : '{n} visite', { n: c.completedCount }) : t('Nouvelle cliente'),
    c.spentDa > 0 ? formatDA(c.spentDa) : null,
  ].filter(Boolean);

  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <TopBar backTo="/pro/clients" title={t('Fiche client')} />

      {/* L'ESSENTIEL DU MOMENT (13 nov. 2026, demande du propriétaire : « que ce qu'on a besoin de
          savoir sur le moment, le reste en plus ») : qui, comment la joindre, son résumé en une
          ligne, l'alerte s'il y en a une, et prendre rendez-vous. */}
      <div className="crd !gap-3">
        <div className="flex items-center gap-3.5">
          <Avatar name={c.name} size={52} />
          <span className="min-w-0 flex-1">
            <h1 className="h1 truncate !text-[1.429rem]">{c.name}</h1>
            <span className="block truncate text-[0.929rem] text-muted">{resume.join(' · ')}</span>
          </span>
          {c.phone && (
            <a href={`tel:${c.phone}`} className="ib lg" aria-label={`${t('Appeler')} ${c.name}`}>
              <I icon={Phone} size={20} />
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="ib lg" aria-label={`WhatsApp ${c.name}`}>
              <I icon={MessageCircle} size={20} />
            </a>
          )}
        </div>
        {(c.blocked || alertes.length > 0) && (
          <p className="cd-alerte" role="note">
            <I icon={c.blocked ? Ban : TriangleAlert} size={15} />
            {c.blocked ? t('Bloqué : ne peut plus réserver chez vous') : alertes.join(' · ')}
          </p>
        )}
        <Button icon={ICONE.reserver} onClick={() => navigate(newBookingUrl)} disabled={c.blocked}>
          {t('Prendre rendez-vous')}
        </Button>
      </div>

      {/* Le prochain rendez-vous, s'il y en a un : c'est la question du moment. */}
      {c.nextAt && nextKey && (
        <button
          type="button"
          className="crd !py-1 w-full text-start"
          onClick={() => c.lastBookingId && navigate(`/pro/rendez-vous/${c.lastBookingId}`)}
        >
          <FactRow
            icon={CalendarClock}
            title={`${t('Prochain rendez-vous')} · ${relativeDayLabelDZ(nextKey)}`}
            sub={`${formatTimeDZ(c.nextAt)} · ${untilLabelFR(c.nextAt, now)}`}
            right={<I icon={ChevronRight} size={18} className="text-disabled rtl:-scale-x-100" />}
          />
        </button>
      )}

      {/* Note privée : montrée seulement si elle existe ; sinon un lien pour en ajouter une.
          Enregistrée en quittant le champ. */}
      {notes || ouvrirNote ? (
        <div className="crd !gap-2">
          <div className="flex items-center justify-between">
            <span className="h3">{t('Note privée')}</span>
            <span className="text-[0.857rem] text-muted">
              {saved ? t('Enregistré') : setNotes.isPending ? t('Enregistrement…') : t('Jamais visible du client')}
            </span>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => void saveNotes()}
            maxLength={2000}
            rows={2}
            placeholder={t('Préférences, allergies, remarques…')}
            aria-label={t('Note privée')}
          />
        </div>
      ) : (
        <button type="button" className="cd-ajout" onClick={() => setOuvrirNote(true)}>
          <I icon={NotebookPen} size={16} /> {t('Ajouter une note privée')}
        </button>
      )}
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}

      {/* Historique : les trois derniers rendez-vous ; le détail (onglets, pages) sur demande. */}
      <span className="h3 scroll-mt-[9rem]" ref={historyTop}>
        {t('Derniers rendez-vous')}
      </span>
      {!toutHistorique ? (
        <>
          {history.isPending ? (
            <Skeleton className="h-[8rem] w-full !rounded-[var(--radius-card)]" />
          ) : (
            <div className="crd !gap-0 !py-1">
              {shown.slice(0, 3).map((h) => (
                <LigneHistorique key={h.id} h={h} now={now} team={team} />
              ))}
              {shown.length === 0 && <p className="p py-3">{t("Aucun rendez-vous pour l'instant.")}</p>}
            </div>
          )}
          {total > 3 && (
            <button type="button" className="cd-ajout" onClick={() => setToutHistorique(true)}>
              <I icon={History} size={16} /> {t('Voir tout l’historique ({n})', { n: total })}
            </button>
          )}
        </>
      ) : (
      <>
      <Tabs
        label={t("Filtrer l'historique")}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setPage(0);
        }}
        className="-mx-4 !px-2"
        options={[
          { value: 'all', label: t("Tout") },
          { value: 'done', label: t("Terminés") },
          { value: 'cancelled', label: t("Annulés") },
          { value: 'noshow', label: t("Absences") },
        ]}
      />
      {history.isPending ? (
        <Skeleton className="h-[10rem] w-full !rounded-[var(--radius-card)]" />
      ) : (
        <div className="crd !gap-0 !py-1">
          {shown.map((h) => (
            <LigneHistorique key={h.id} h={h} now={now} team={team} />
          ))}
          {shown.length === 0 && (
            <p className="p py-3">
              {filter === 'all' ? "Aucun rendez-vous pour l'instant." : 'Rien dans cette catégorie.'}
            </p>
          )}
        </div>
      )}
      <Pager
        page={page}
        pages={Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE))}
        onPage={(p) => {
          setPage(p);
          historyTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }}
        loading={history.isFetching}
      />
      </>
      )}

      {/* LE RESTE, SUR DEMANDE : coordonnées, chiffres détaillés, blocage (geste rare et lourd). */}
      <details className="cd-plus">
        <summary>
          <I icon={ChevronDown} size={16} className="cd-plus-c" /> {t('Plus d’informations')}
        </summary>
        <div className="crd !gap-0 !py-1">
          <FactRow
            icon={Phone}
            title={c.phone ? formatDZPhone(c.phone) : t('Sans numéro de téléphone')}
          />
          {c.email && (
            <a href={`mailto:${c.email}`} className="block">
              <FactRow icon={Mail} title={c.email} />
            </a>
          )}
          <FactRow
            icon={History}
            title={c.lastAt ? `${t('Dernière visite le')} ${formatDateShortDZ(c.lastAt)}` : t('Aucune visite pour l’instant')}
            sub={c.bookingsCount ? t('{n} rendez-vous au total', { n: c.bookingsCount }) : undefined}
          />
          <FactRow
            icon={CalendarX2}
            title={t('{a} annulation(s) · {b} absence(s)', { a: c.cancelledCount, b: c.noShowCount })}
          />
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant={c.blocked ? 'g' : 'd'}
            icon={c.blocked ? ShieldCheck : Ban}
            onClick={() => void toggleBlock()}
            disabled={block.isPending || unblock.isPending}
          >
            {c.blocked ? t('Débloquer ce client') : t('Bloquer ce client')}
          </Button>
          <p className="t3 text-center">
            {blocageOpposable
              ? c.blocked
                ? t('Ce client ne peut plus prendre de rendez-vous chez vous. Le blocage ne concerne que votre salon.')
                : t('Un client bloqué ne peut plus réserver chez vous en ligne. Cela ne concerne que votre salon.')
              : t("Ce client de passage n'a ni compte ni numéro : le blocage le signale dans votre clientèle, il n'y a rien à empêcher en ligne.")}
          </p>
        </div>
      </details>
    </Screen>
  );
}
