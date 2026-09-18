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
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  History,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserX,
} from 'lucide-react';
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
import { errorText } from '@/components/ErrorMessage';
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
import { Splash } from '@/pages/auth/Splash';
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

/** Chiffre clé : la valeur en grand, le libellé dessous ; rouge quand c'est un signal. */
function Stat({ value, label, alert }: { value: string; label: string; alert?: boolean }) {
  return (
    <span
      className={`flex min-w-0 flex-col rounded-[var(--radius-card-sm)] px-2.5 py-2.5 ${alert ? 'bg-cancel-bg text-cancel-fg' : 'bg-fill'}`}
    >
      <span className="truncate text-[1.429rem] font-semibold leading-tight tracking-[-0.5px]">
        {value}
      </span>
      <span className={`truncate text-[0.857rem] ${alert ? 'text-cancel-fg/80' : 'text-muted'}`}>
        {label}
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
  const { setStatus } = useProBookingMutations();
  const c = client.data ?? null;
  const [notes, setNotesDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const historyTop = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (c) setNotesDraft(c.notes ?? '');
  }, [c?.notes, c]);

  if (client.isPending) return <Splash />;
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

  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <TopBar backTo="/pro/clients" right="Fiche client" />

      {/* Qui, et les trois gestes du quotidien : appeler, écrire, prendre rendez-vous. */}
      <div className="crd !gap-3">
        <div className="flex items-center gap-3.5">
          <Avatar name={c.name} size={56} />
          <span className="min-w-0 flex-1">
            <h1 className="h1 truncate !text-[1.429rem]">{c.name}</h1>
            {c.phone ? (
              <a href={`tel:${c.phone}`} className="mono block text-[1rem] text-muted">
                {formatDZPhone(c.phone)}
              </a>
            ) : (
              <span className="block text-[0.857rem] text-muted">{t("Sans numéro de téléphone")}</span>
            )}
          </span>
          {c.blocked && (
            <Badge tone="cn" md>
              {t("Bloqué")}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {c.phone && (
            <a href={`tel:${c.phone}`} className="ib lg" aria-label={`Appeler ${c.name}`} title={t("Appeler")}>
              <I icon={Phone} size={20} />
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="ib lg"
              aria-label={`WhatsApp ${c.name}`}
              title={t("WhatsApp")}
            >
              <I icon={MessageCircle} size={20} />
            </a>
          )}
          <Button
            className="!h-[2.75rem] !py-0"
            onClick={() => navigate(newBookingUrl)}
            disabled={c.blocked}
          >
            <I icon={CalendarPlus} size={18} /> {t("Prendre rendez-vous")}
          </Button>
        </div>
      </div>

      {/* Quatre chiffres qui comptent ; annulations et absences en rouge dès qu'il y en a. */}
      <div className="grid grid-cols-4 gap-1.5">
        <Stat value={String(c.completedCount)} label={c.completedCount > 1 ? 'visites' : 'visite'} />
        <Stat value={formatDA(c.spentDa).replace(/\s?DA$/, '')} label={t("DA dépensés")} />
        <Stat
          value={String(c.cancelledCount)}
          label={c.cancelledCount > 1 ? 'annulations' : 'annulation'}
          alert={c.cancelledCount > 0}
        />
        <Stat
          value={String(c.noShowCount)}
          label={c.noShowCount > 1 ? 'absences' : 'absence'}
          alert={c.noShowCount > 0}
        />
      </div>

      {/* Les faits : prochain rendez-vous, dernière visite, e-mail. */}
      <div className="crd !gap-0 !py-1">
        {c.nextAt && nextKey ? (
          <button
            type="button"
            className="w-full text-start"
            onClick={() => c.lastBookingId && navigate(`/pro/rendez-vous/${c.lastBookingId}`)}
          >
            <FactRow
              icon={CalendarClock}
              title={`Prochain rendez-vous · ${relativeDayLabelDZ(nextKey)}`}
              sub={`${formatTimeDZ(c.nextAt)} · ${untilLabelFR(c.nextAt, now)}`}
              right={<I icon={ChevronRight} size={18} className="text-disabled" />}
            />
          </button>
        ) : (
          <FactRow icon={CalendarClock} title={t("Aucun rendez-vous prévu")} />
        )}
        <FactRow
          icon={History}
          title={c.lastAt ? `Dernière visite le ${formatDateShortDZ(c.lastAt)}` : 'Aucune visite pour l’instant'}
          sub={c.bookingsCount ? `${c.bookingsCount} rendez-vous au total` : undefined}
        />
        {c.email && (
          <a href={`mailto:${c.email}`} className="block">
            <FactRow icon={Mail} title={c.email} />
          </a>
        )}
      </div>

      {/* Notes privées : enregistrées en quittant le champ. */}
      <div className="crd !gap-2">
        <div className="flex items-center justify-between">
          <span className="h3">{t("Notes privées")}</span>
          <span className="text-[0.857rem] text-muted">
            {saved ? 'Enregistré' : setNotes.isPending ? 'Enregistrement…' : 'Jamais visibles du client'}
          </span>
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => void saveNotes()}
          maxLength={2000}
          placeholder={t("Préférences, allergies, remarques…")}
          aria-label={t("Notes privées")}
        />
      </div>
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}

      {/* Historique sous onglets : « qu'est-ce qu'il a annulé ? » est la question la plus posée. */}
      <span className="h3 scroll-mt-[9rem]" ref={historyTop}>
        {t("Historique")}
        {total > HISTORY_PAGE_SIZE ? ` · ${total}` : ''}
      </span>
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
          {shown.map((h) => {
            const past = new Date(h.startsAt).getTime() < now;
            const pendingOutcome = h.status === 'confirmed' && past;
            const cancelled = h.status === 'cancelled';
            return (
              <div
                key={h.id}
                className="flex flex-col gap-2.5 border-b border-line-soft py-2.5 last:border-b-0"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-start"
                  onClick={() => navigate(`/pro/rendez-vous/${h.id}`)}
                >
                  <DateBlock iso={h.startsAt} muted={cancelled} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[1rem] font-semibold ${cancelled ? 'text-muted' : ''}`}
                    >
                      {h.serviceName}
                    </span>
                    <span className="block truncate text-[0.857rem] text-muted">
                      <span className="mono">{formatTimeDZ(h.startsAt)}</span> ·{' '}
                      {formatDA(h.priceDa)}
                      {team && h.staffName ? ` · ${h.staffName}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-none items-center gap-1.5">
                    {cancelled ? (
                      <Badge tone="cn">{historyStatusLabel(h)}</Badge>
                    ) : (
                      <StatusBadge status={h.status} />
                    )}
                    <I icon={ChevronRight} size={16} className="text-disabled" />
                  </span>
                </button>
                {pendingOutcome && (
                  <div className="g2">
                    <Button
                      sm
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: h.id, status: 'completed' })}
                    >
                      <I icon={Check} size={16} /> {t("Terminé")}
                    </Button>
                    <Button
                      sm
                      variant="g"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: h.id, status: 'no_show' })}
                    >
                      <I icon={UserX} size={16} /> {t("Client absent")}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
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

      {/* Bloquer : un geste rare et lourd, à l'écart des gestes du quotidien. */}
      <div className="flex flex-col gap-2 pt-2">
        <Button
          variant={c.blocked ? 'g' : 'd'}
          onClick={() => void toggleBlock()}
          disabled={block.isPending || unblock.isPending}
        >
          <I icon={c.blocked ? ShieldCheck : Ban} size={18} />{' '}
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
    </Screen>
  );
}
