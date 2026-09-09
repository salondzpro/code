/**
 * Espace pro — Fiche client complète : identité (téléphone, e-mail), compteurs (rendez-vous, terminés, annulés,
 * absences, montant dépensé), dernière visite, prochain rendez-vous, notes privées, statut Actif / Bloqué,
 * et l'historique détaillé (date, prestation, heure, statut). Depuis l'historique, un rendez-vous passé encore
 * « Confirmé » se marque Terminé ou Client absent.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Ban, CalendarPlus, ChevronRight, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useProBookingMutations, useProClientHistory, useProClientMutations, useProClients } from '@salondz/api-client';
import { formatDA, formatDZPhone, formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import type { ProClientHistoryItem } from '@salondz/types';
import { errorText } from '@/components/ErrorMessage';
import { Avatar, Badge, Button, I, Skeleton, StatusBadge, Textarea, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

/** « Annulé par le client », « Annulé par le salon », « Expiré » (demande jamais validée). */
export function historyStatusLabel(h: Pick<ProClientHistoryItem, 'status' | 'cancelledBy'>): string | null {
  if (h.status !== 'cancelled') return null;
  if (h.cancelledBy === 'client') return 'Annulé par le client';
  if (h.cancelledBy === 'salon') return 'Annulé par le salon';
  return 'Demande expirée';
}

export function ClientDetail() {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const clients = useProClients();
  const history = useProClientHistory(key, !!key);
  const { block, unblock, setNotes } = useProClientMutations();
  const { setStatus } = useProBookingMutations();
  const c = (clients.data?.items ?? []).find((x) => x.clientKey === key) ?? null;
  const [notes, setNotesDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (c) setNotesDraft(c.notes ?? '');
  }, [c?.notes, c]);

  if (clients.isPending) return <Splash />;
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
  const stat = (v: string | number, l: string) => (
    <span className="flex flex-col rounded-[0.75rem] bg-fill px-3 py-2.5">
      <span className="text-[1.125rem] font-bold tracking-[-0.4px]">{v}</span>
      <span className="text-[0.75rem] text-muted">{l}</span>
    </span>
  );

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/clients" right={c.blocked ? <Badge tone="cn">Client bloqué</Badge> : <Badge tone="ok">Client actif</Badge>} />
      <div className="flex items-center gap-3.5">
        <Avatar name={c.name} size={64} />
        <span className="min-w-0 flex-1">
          <h1 className="h1 truncate !text-[1.375rem]">{c.name}</h1>
          {c.phone && (
            <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-[0.9375rem] text-muted">
              <I icon={Phone} size={14} /> {formatDZPhone(c.phone)}
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-[0.9375rem] text-muted">
              <I icon={Mail} size={14} /> {c.email}
            </a>
          )}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stat(c.bookingsCount, 'rendez-vous')}
        {stat(c.completedCount, 'terminés')}
        {stat(c.cancelledCount, 'annulés')}
        {stat(c.noShowCount, 'absences')}
        {stat(formatDA(c.spentDa), 'dépensés')}
        {stat(c.lastAt ? formatDateShortDZ(c.lastAt) : '—', 'dernière visite')}
      </div>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-3">
          <span className="text-[0.9375rem]">Prochain rendez-vous</span>
          <span className="text-[0.9375rem] text-muted">{c.nextAt ? `${formatDateShortDZ(c.nextAt)} · ${formatTimeDZ(c.nextAt)}` : 'Aucun'}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="h3">Notes privées</span>
        <Textarea value={notes} onChange={(e) => setNotesDraft(e.target.value)} maxLength={2000} placeholder="Préférences, allergies, remarques… visibles uniquement par vous." aria-label="Notes privées" />
        <div className="flex items-center justify-between">
          <span className="s">{saved ? 'Enregistré' : 'Jamais visibles du client'}</span>
          <Button auto sm onClick={() => void saveNotes()} disabled={setNotes.isPending || notes.trim() === (c.notes ?? '')}>
            Enregistrer les notes
          </Button>
        </div>
      </div>

      <div className="g2">
        <Button onClick={() => navigate(`/pro/rendez-vous/nouveau?name=${encodeURIComponent(c.name)}${c.phone ? `&phone=${encodeURIComponent(c.phone)}` : ''}`)} disabled={c.blocked}>
          <I icon={CalendarPlus} size={18} /> Rendez-vous
        </Button>
        {canBlock && (
          <Button variant={c.blocked ? 'g' : 'd'} onClick={() => void toggleBlock()} disabled={block.isPending || unblock.isPending}>
            <I icon={c.blocked ? ShieldCheck : Ban} size={18} /> {c.blocked ? 'Débloquer' : 'Bloquer le client'}
          </Button>
        )}
      </div>
      {c.blocked && <p className="text-[0.875rem] text-danger">Ce client ne peut plus prendre de rendez-vous chez vous. Le blocage ne concerne que votre salon.</p>}
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}

      <span className="h3">Historique</span>
      {history.isPending ? (
        <Skeleton className="h-[10rem] w-full !rounded-[1.25rem]" />
      ) : (
        <div className="crd !gap-0 !py-1">
          {(history.data?.items ?? []).map((h) => {
            const past = new Date(h.startsAt).getTime() < now;
            const pendingOutcome = h.status === 'confirmed' && past;
            return (
              <div key={h.id} className="flex flex-col gap-2 border-b border-line-soft py-3 last:border-b-0">
                <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => navigate(`/pro/rendez-vous/${h.id}`)}>
                  <span className="min-w-0">
                    <span className="block text-[0.8125rem] text-muted">{formatDateShortDZ(h.startsAt)}</span>
                    <span className="block text-[1rem] font-semibold">{h.serviceName}</span>
                    <span className="block text-[0.875rem] text-muted">
                      {formatTimeDZ(h.startsAt)} · {formatDA(h.priceDa)}
                      {h.staffName ? ` · ${h.staffName}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-none items-center gap-2">
                    {h.status === 'cancelled' ? <Badge tone="cn">{historyStatusLabel(h)}</Badge> : <StatusBadge status={h.status} />}
                    <I icon={ChevronRight} size={16} className="text-disabled" />
                  </span>
                </button>
                {pendingOutcome && (
                  <div className="g2">
                    <Button sm disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: h.id, status: 'completed' })}>
                      Terminé
                    </Button>
                    <Button sm variant="g" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: h.id, status: 'no_show' })}>
                      Client absent
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {(history.data?.items ?? []).length === 0 && <p className="p py-3">Aucun rendez-vous pour l'instant.</p>}
        </div>
      )}
    </Screen>
  );
}
