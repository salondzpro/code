/**
 * Espace pro — Fiche client, pensée pour le quotidien : le nom et le téléphone en grand avec Appeler / WhatsApp,
 * le prochain rendez-vous en avant (« dans 2 h », heure, prestation), trois chiffres qui comptent (visites,
 * dépensé, dernière visite) et les signaux d'alerte (annulations, absences), les notes privées, puis l'historique
 * (pavé date, prestation, heure · prix · membre, statut). Un rendez-vous passé encore « Confirmé » se règle sur
 * place : Terminé ou Client absent. Une icône sur chaque action.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Ban,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronRight,
  Mail,
  MessageCircle,
  Phone,
  Save,
  ShieldCheck,
  StickyNote,
  UserX,
} from 'lucide-react';
import {
  pagesItems,
  useProBookingMutations,
  useProClient,
  useProClientHistoryInfinite,
  useProClientMutations,
} from '@salondz/api-client';
import { LoadMore } from '@/components/LoadMore';
import {
  formatDA,
  formatDZPhone,
  formatDateShortDZ,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
  untilLabelFR,
} from '@salondz/constants';
import type { ProClientHistoryItem } from '@salondz/types';
import { errorText } from '@/components/ErrorMessage';
import { Avatar, Badge, Button, I, Skeleton, StatusBadge, Textarea, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

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
  new Intl.DateTimeFormat('fr-DZ', { day: 'numeric', timeZone: DZ }).format(new Date(iso));
const monthShort = (iso: string) =>
  new Intl.DateTimeFormat('fr-DZ', { month: 'short', timeZone: DZ })
    .format(new Date(iso))
    .replace('.', '');

/** Pavé date de l'historique : jour en grand, mois. */
function DateBlock({ iso, muted }: { iso: string; muted?: boolean }) {
  return (
    <span
      className={`flex w-[3.25rem] flex-none flex-col items-center rounded-[0.75rem] bg-fill py-1.5 ${muted ? 'text-muted' : ''}`}
    >
      <span className="text-[1.375rem] font-bold leading-none tracking-[-0.5px]">
        {dayNum(iso)}
      </span>
      <span className="text-[0.75rem] text-muted">{monthShort(iso)}</span>
    </span>
  );
}

export function ClientDetail() {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const client = useProClient(key);
  const history = useProClientHistoryInfinite(key, !!key);
  const historyItems = pagesItems(history.data);
  const { block, unblock, setNotes } = useProClientMutations();
  const { setStatus } = useProBookingMutations();
  const c = client.data ?? null;
  const [notes, setNotesDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (c) setNotesDraft(c.notes ?? '');
  }, [c?.notes, c]);

  if (client.isPending) return <Splash />;
  if (!c)
    return (
      <Screen bottom={NAV_PAD} gap={16}>
        <TopBar backTo="/pro/clients" />
        <p className="p">Client introuvable.</p>
      </Screen>
    );
  const ident = { clientId: c.clientId ?? undefined, phone: c.phone ?? undefined };
  const canBlock = !!(c.clientId || c.phone);
  const now = Date.now();
  const toggleBlock = async () => {
    setError(null);
    try {
      if (c.blocked) await unblock.mutateAsync(ident);
      else await block.mutateAsync(ident);
    } catch (err) {
      setError(errorText(err));
    }
  };
  const saveNotes = async () => {
    setError(null);
    try {
      await setNotes.mutateAsync({ key, notes: notes.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(errorText(err));
    }
  };
  const newBookingUrl = `/pro/rendez-vous/nouveau?name=${encodeURIComponent(c.name)}${c.phone ? `&phone=${encodeURIComponent(c.phone)}` : ''}`;
  const nextKey = c.nextAt ? toLocalDateKey(new Date(c.nextAt)) : null;
  const warn = c.cancelledCount + c.noShowCount > 0;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar
        backTo="/pro/clients"
        right={
          c.blocked ? (
            <Badge tone="cn" md>
              Client bloqué
            </Badge>
          ) : (
            <Badge tone="ok" md>
              Client actif
            </Badge>
          )
        }
      />

      {/* Identité en grand + contact direct */}
      <div className="crd !gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={c.name} size={72} />
          <span className="min-w-0 flex-1">
            <h1 className="h1 truncate !text-[1.5rem]">{c.name}</h1>
            {c.phone ? (
              <a href={`tel:${c.phone}`} className="mono block text-[1.125rem] font-semibold">
                {formatDZPhone(c.phone)}
              </a>
            ) : (
              <span className="p block">Sans numéro de téléphone</span>
            )}
            {c.email && (
              <a
                href={`mailto:${c.email}`}
                className="flex items-center gap-1.5 text-[0.875rem] text-muted"
              >
                <I icon={Mail} size={14} /> <span className="truncate">{c.email}</span>
              </a>
            )}
          </span>
        </div>
        {c.phone && (
          <div className="g2">
            <a href={`tel:${c.phone}`} className="btn g sm !py-[1.125rem] !text-[0.9375rem]">
              <I icon={Phone} size={16} /> Appeler
            </a>
            <a
              href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="btn g sm !py-[1.125rem] !text-[0.9375rem]"
            >
              <I icon={MessageCircle} size={16} /> WhatsApp
            </a>
          </div>
        )}
      </div>

      {/* Prochain rendez-vous en avant */}
      {c.nextAt && nextKey ? (
        <button
          type="button"
          className="crd !gap-1 !border-ink text-left"
          onClick={() => c.lastBookingId && navigate(`/pro/rendez-vous/${c.lastBookingId}`)}
        >
          <span className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-muted">
            Prochain rendez-vous · {untilLabelFR(c.nextAt, now)}
          </span>
          <span className="flex items-end justify-between gap-3">
            <span className="mono text-[2rem] font-bold leading-none tracking-[-0.9px]">
              {formatTimeDZ(c.nextAt)}
            </span>
            <span className="text-[1.125rem] font-bold">{relativeDayLabelDZ(nextKey)}</span>
          </span>
        </button>
      ) : (
        <div className="crd !flex-row !items-center !justify-between !gap-3">
          <span className="flex items-center gap-2 text-[0.9375rem] text-muted">
            <I icon={CalendarClock} size={16} /> Aucun rendez-vous prévu
          </span>
          <Button auto sm onClick={() => navigate(newBookingUrl)} disabled={c.blocked}>
            <I icon={CalendarPlus} size={16} /> Ajouter
          </Button>
        </div>
      )}

      {/* Trois chiffres qui comptent, puis les signaux d'alerte */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: String(c.completedCount), l: c.completedCount > 1 ? 'visites' : 'visite' },
          { v: formatDA(c.spentDa), l: 'dépensés' },
          { v: c.lastAt ? formatDateShortDZ(c.lastAt) : '—', l: 'dernière visite' },
        ].map((x) => (
          <span key={x.l} className="flex flex-col rounded-[0.875rem] bg-fill px-3 py-3">
            <span className="text-[1.375rem] font-bold leading-tight tracking-[-0.5px]">{x.v}</span>
            <span className="text-[0.8125rem] text-muted">{x.l}</span>
          </span>
        ))}
      </div>
      <p className={`-mt-2 text-[0.9375rem] ${warn ? 'text-danger' : 'text-muted'}`}>
        {c.bookingsCount} rendez-vous au total · {c.cancelledCount} annulé
        {c.cancelledCount > 1 ? 's' : ''} · {c.noShowCount} absence{c.noShowCount > 1 ? 's' : ''}
      </p>

      {/* Notes privées */}
      <div className="crd !gap-3">
        <span className="flex items-center gap-2 text-[1rem] font-bold">
          <I icon={StickyNote} size={18} /> Notes privées
        </span>
        <Textarea
          value={notes}
          onChange={(e) => setNotesDraft(e.target.value)}
          maxLength={2000}
          placeholder="Préférences, allergies, remarques… visibles uniquement par vous."
          aria-label="Notes privées"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="s">{saved ? 'Enregistré' : 'Jamais visibles du client'}</span>
          <Button
            auto
            sm
            onClick={() => void saveNotes()}
            disabled={setNotes.isPending || notes.trim() === (c.notes ?? '')}
          >
            <I icon={Save} size={16} /> Enregistrer
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="g2">
        <Button onClick={() => navigate(newBookingUrl)} disabled={c.blocked}>
          <I icon={CalendarPlus} size={18} /> Rendez-vous
        </Button>
        {canBlock && (
          <Button
            variant={c.blocked ? 'g' : 'd'}
            onClick={() => void toggleBlock()}
            disabled={block.isPending || unblock.isPending}
          >
            <I icon={c.blocked ? ShieldCheck : Ban} size={18} />{' '}
            {c.blocked ? 'Débloquer' : 'Bloquer'}
          </Button>
        )}
      </div>
      {c.blocked && (
        <p className="text-[0.875rem] text-danger">
          Ce client ne peut plus prendre de rendez-vous chez vous. Le blocage ne concerne que votre
          salon.
        </p>
      )}
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}

      {/* Historique */}
      <span className="h3">Historique</span>
      {history.isPending ? (
        <Skeleton className="h-[10rem] w-full !rounded-[1.25rem]" />
      ) : (
        <div className="crd !gap-0 !py-1">
          {historyItems.map((h) => {
            const past = new Date(h.startsAt).getTime() < now;
            const pendingOutcome = h.status === 'confirmed' && past;
            const cancelled = h.status === 'cancelled';
            return (
              <div
                key={h.id}
                className="flex flex-col gap-2.5 border-b border-line-soft py-3 last:border-b-0"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => navigate(`/pro/rendez-vous/${h.id}`)}
                >
                  <DateBlock iso={h.startsAt} muted={cancelled} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[1.0625rem] font-bold tracking-[-0.3px] ${cancelled ? 'text-muted' : ''}`}
                    >
                      {h.serviceName}
                    </span>
                    <span className="block text-[0.9375rem] text-muted">
                      <span className="mono">{formatTimeDZ(h.startsAt)}</span> ·{' '}
                      {formatDA(h.priceDa)}
                      {h.staffName ? ` · ${h.staffName}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-none items-center gap-2">
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
                      <I icon={Check} size={16} /> Terminé
                    </Button>
                    <Button
                      sm
                      variant="g"
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: h.id, status: 'no_show' })}
                    >
                      <I icon={UserX} size={16} /> Client absent
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {historyItems.length === 0 && <p className="p py-3">Aucun rendez-vous pour l'instant.</p>}
          <LoadMore
            hasMore={history.hasNextPage}
            loading={history.isFetchingNextPage}
            onMore={() => void history.fetchNextPage()}
            label="Voir plus de rendez-vous"
          />
        </div>
      )}
    </Screen>
  );
}
