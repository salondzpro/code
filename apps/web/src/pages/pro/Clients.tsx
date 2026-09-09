/**
 * Espace pro — Clients : liste (compte, sinon numéro, sinon nom) calculée en base ; chaque ligne ouvre la fiche
 * client complète (/pro/clients/:key) : compteurs, notes privées, historique, blocage.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, Search } from 'lucide-react';
import { useProClients, useProSalon } from '@salondz/api-client';
import { formatDZPhone, formatDateShortDZ } from '@salondz/constants';
import { Avatar, Badge, I, Skeleton } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

export function Clients() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const clients = useProClients();
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const list = clients.data?.items ?? [];
    const needle = q.trim().toLowerCase();
    return needle ? list.filter((c) => c.name.toLowerCase().includes(needle) || (c.phone ?? '').includes(needle.replace(/\s/g, ''))) : list;
  }, [clients.data, q]);

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
            <button key={c.clientKey} type="button" className="li w-full !py-4 text-left" onClick={() => navigate(`/pro/clients/${encodeURIComponent(c.clientKey)}`)}>
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
    </Screen>
  );
}
