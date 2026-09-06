/** Espace pro — Clients : liste déduite des rendez-vous (nom, téléphone, nombre de visites, dernière visite). */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, Search } from 'lucide-react';
import { useProBookings, useProSalon } from '@salondz/api-client';
import { addDaysToKey, formatDZPhone, formatDateShortDZ, toLocalDateKey } from '@salondz/constants';
import { formatIntlDZ } from '@/lib/authFlow';
import { Avatar, I, Skeleton } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

interface ClientRow {
  key: string;
  name: string;
  phone: string | null;
  count: number;
  last: string;
  next: string | null;
  lastBookingId: string;
}

export function Clients() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const bookings = useProBookings({ from: addDaysToKey(today, -365), to: addDaysToKey(today, 90), limit: 200 }, !!salon);
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const m = new Map<string, ClientRow>();
    const now = new Date().toISOString();
    for (const b of bookings.data?.items ?? []) {
      if (b.status === 'cancelled') continue;
      const key = b.clientPhone ?? b.clientId ?? b.clientName.toLowerCase();
      const cur = m.get(key);
      if (!cur) m.set(key, { key, name: b.clientName, phone: b.clientPhone, count: 1, last: b.startsAt, next: b.startsAt > now ? b.startsAt : null, lastBookingId: b.id });
      else {
        cur.count += 1;
        if (b.startsAt <= now && b.startsAt > cur.last) {
          cur.last = b.startsAt;
          cur.lastBookingId = b.id;
        }
        if (b.startsAt > now && (!cur.next || b.startsAt < cur.next)) cur.next = b.startsAt;
      }
    }
    const list = [...m.values()].sort((a, b) => b.last.localeCompare(a.last));
    const needle = q.trim().toLowerCase();
    return needle ? list.filter((c) => c.name.toLowerCase().includes(needle) || (c.phone ?? '').includes(needle.replace(/\s/g, ''))) : list;
  }, [bookings.data, q]);

  if (!salon) return <Splash />;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <h1 className="h1 !text-[34px]">Clients</h1>
      <label className="search">
        <I icon={Search} size={22} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou téléphone" aria-label="Rechercher un client" />
      </label>
      <p className="text-[17px] text-muted">
        {rows.length} client{rows.length > 1 ? 's' : ''} · 12 derniers mois
      </p>
      {bookings.isPending ? (
        <Skeleton className="h-[200px] w-full !rounded-[20px]" />
      ) : rows.length === 0 ? (
        <p className="p">Vos clients apparaîtront ici après leur premier rendez-vous.</p>
      ) : (
        <div className="crd !gap-0 !py-1">
          {rows.map((c) => (
            <button key={c.key} type="button" className="li w-full !py-4 text-left" onClick={() => navigate(`/pro/rendez-vous/${c.lastBookingId}`)}>
              <span className="flex items-center gap-3.5">
                <Avatar name={c.name} size={52} />
                <span>
                  <span className="block text-[20px] font-bold tracking-[-0.3px]">{c.name}</span>
                  <span className="block text-[15px] text-muted">
                    {c.phone ? `${formatDZPhone(c.phone)} · ` : ''}
                    {c.count} rendez-vous · {c.next ? `prochain ${formatDateShortDZ(c.next)}` : `dernier ${formatDateShortDZ(c.last)}`}
                  </span>
                </span>
              </span>
              <I icon={ChevronRight} size={18} className="text-disabled" />
            </button>
          ))}
        </div>
      )}
      <span className="sr-only">{formatIntlDZ('+213000000000')}</span>
    </Screen>
  );
}
