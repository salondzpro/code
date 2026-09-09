/**
 * Espace pro — Clients : fiche simple par client (compte, sinon numéro, sinon nom), calculée en base :
 * nombre de rendez-vous, dernier, prochain, annulés, absences, bloqué/actif. ⋮ → Bloquer / Débloquer :
 * le blocage ne vaut que pour ce salon (le client ne peut plus y réserver en ligne).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Ban, CalendarPlus, ChevronRight, MoreVertical, Phone, Search, ShieldCheck } from 'lucide-react';
import { useProClientMutations, useProClients, useProSalon } from '@salondz/api-client';
import { formatDZPhone, formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import type { ProClient } from '@salondz/types';
import { errorText } from '@/components/ErrorMessage';
import { Avatar, Badge, BottomSheet, Button, I, Skeleton } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

function ClientSheet({ c, onClose }: { c: ProClient; onClose: () => void }) {
  const navigate = useNavigate();
  const { block, unblock } = useProClientMutations();
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ident = { clientId: c.clientId ?? undefined, phone: c.phone ?? undefined };
  const canBlock = !!(c.clientId || c.phone);
  const stat = (v: number | string, l: string) => (
    <span className="flex flex-col rounded-[0.75rem] bg-fill px-3 py-2.5">
      <span className="text-[1.125rem] font-bold tracking-[-0.4px]">{v}</span>
      <span className="text-[0.75rem] text-muted">{l}</span>
    </span>
  );
  const toggleBlock = async () => {
    setError(null);
    setMenu(false);
    try {
      if (c.blocked) await unblock.mutateAsync(ident);
      else await block.mutateAsync(ident);
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <>
      <div className="dim" onClick={onClose} />
      <BottomSheet className="max-h-[88vh] !z-50 overflow-y-auto">
        <div role="dialog" aria-label={`Client ${c.name}`} className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3.5">
            <Avatar name={c.name} size={56} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[1.125rem] font-bold tracking-[-0.4px]">{c.name}</span>
              <span className="p block text-[0.9375rem]">{c.phone ? formatDZPhone(c.phone) : 'Sans numéro'}</span>
            </span>
            {c.blocked ? (
              <Badge tone="cn" dot={false}>
                Bloqué
              </Badge>
            ) : (
              <Badge tone="ok" dot={false}>
                Actif
              </Badge>
            )}
            {canBlock && (
              <div className="relative">
                <button type="button" className="ib" aria-label="Actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                  <I icon={MoreVertical} size={18} />
                </button>
                {menu && (
                  <div role="menu" className="absolute right-0 top-11 z-10 min-w-[11rem] rounded-[0.875rem] border border-line bg-surface p-1 shadow-card">
                    <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-[0.625rem] px-3 py-2.5 text-left text-[0.9375rem] hover:bg-fill" onClick={() => void toggleBlock()}>
                      <I icon={c.blocked ? ShieldCheck : Ban} size={16} className={c.blocked ? 'text-ok-fg' : 'text-danger'} />
                      {c.blocked ? 'Débloquer' : 'Bloquer'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {c.blocked && <p className="text-[0.875rem] text-danger">Ce client ne peut plus prendre de rendez-vous chez vous{c.blockedReason ? ` · ${c.blockedReason}` : ''}. Le blocage ne concerne que votre salon.</p>}
          <div className="grid grid-cols-3 gap-2">
            {stat(c.bookingsCount, 'rendez-vous')}
            {stat(c.cancelledCount, 'annulés')}
            {stat(c.noShowCount, 'absences')}
          </div>
          <div className="crd !gap-0 !py-1">
            <div className="li !py-3">
              <span className="text-[0.9375rem]">Dernier rendez-vous</span>
              <span className="text-[0.9375rem] text-muted">{c.lastAt ? `${formatDateShortDZ(c.lastAt)} · ${formatTimeDZ(c.lastAt)}` : '—'}</span>
            </div>
            <div className="li !py-3">
              <span className="text-[0.9375rem]">Prochain rendez-vous</span>
              <span className="text-[0.9375rem] text-muted">{c.nextAt ? `${formatDateShortDZ(c.nextAt)} · ${formatTimeDZ(c.nextAt)}` : 'Aucun'}</span>
            </div>
            <div className="li !py-3">
              <span className="text-[0.9375rem]">Terminés</span>
              <span className="text-[0.9375rem] text-muted">{c.completedCount}</span>
            </div>
          </div>
          {error && (
            <p className="text-[0.875rem] text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="g2">
            {c.phone && (
              <a className="btn g" href={`tel:${c.phone}`}>
                <I icon={Phone} size={18} /> Appeler
              </a>
            )}
            <Button onClick={() => navigate(`/pro/rendez-vous/nouveau?name=${encodeURIComponent(c.name)}${c.phone ? `&phone=${encodeURIComponent(c.phone)}` : ''}`)} disabled={c.blocked}>
              <I icon={CalendarPlus} size={18} /> Rendez-vous
            </Button>
          </div>
          {c.lastBookingId && (
            <button type="button" className="py-1 text-[0.875rem] text-muted underline" onClick={() => navigate(`/pro/rendez-vous/${c.lastBookingId}`)}>
              Voir le dernier rendez-vous
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

export function Clients() {
  const salon = useProSalon().data?.salon ?? null;
  const clients = useProClients();
  const [q, setQ] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = clients.data?.items ?? [];
    const needle = q.trim().toLowerCase();
    return needle ? list.filter((c) => c.name.toLowerCase().includes(needle) || (c.phone ?? '').includes(needle.replace(/\s/g, ''))) : list;
  }, [clients.data, q]);
  const current = rows.find((c) => c.clientKey === openKey) ?? (clients.data?.items ?? []).find((c) => c.clientKey === openKey) ?? null;

  if (!salon) return <Splash />;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <h1 className="h1">Clients</h1>
      <label className="search">
        <I icon={Search} size={22} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou téléphone" aria-label="Rechercher un client" />
      </label>
      <p className="text-[0.8125rem] text-muted">
        {rows.length} client{rows.length > 1 ? 's' : ''}
        {(clients.data?.items ?? []).some((c) => c.blocked) ? ` · ${(clients.data?.items ?? []).filter((c) => c.blocked).length} bloqué${(clients.data?.items ?? []).filter((c) => c.blocked).length > 1 ? 's' : ''}` : ''}
      </p>
      {clients.isPending ? (
        <Skeleton className="h-[12.5rem] w-full !rounded-[1.25rem]" />
      ) : rows.length === 0 ? (
        <p className="p">Vos clients apparaîtront ici après leur premier rendez-vous.</p>
      ) : (
        <div className="crd !gap-0 !py-1">
          {rows.map((c) => (
            <button key={c.clientKey} type="button" className="li w-full !py-4 text-left" onClick={() => setOpenKey(c.clientKey)}>
              <span className="flex min-w-0 items-center gap-3.5">
                <Avatar name={c.name} size={52} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[1rem] font-bold tracking-[-0.3px]">
                    <span className="truncate">{c.name}</span>
                    {c.blocked && (
                      <Badge tone="cn" dot={false}>
                        Bloqué
                      </Badge>
                    )}
                  </span>
                  <span className="block text-[0.9375rem] text-muted">
                    {c.phone ? `${formatDZPhone(c.phone)} · ` : ''}
                    {c.bookingsCount} rendez-vous
                    {c.noShowCount ? ` · ${c.noShowCount} absence${c.noShowCount > 1 ? 's' : ''}` : ''}
                    {c.nextAt ? ` · prochain ${formatDateShortDZ(c.nextAt)}` : c.lastAt ? ` · dernier ${formatDateShortDZ(c.lastAt)}` : ''}
                  </span>
                </span>
              </span>
              <I icon={ChevronRight} size={18} className="shrink-0 text-disabled" />
            </button>
          ))}
        </div>
      )}
      {current && <ClientSheet c={current} onClose={() => setOpenKey(null)} />}
    </Screen>
  );
}
