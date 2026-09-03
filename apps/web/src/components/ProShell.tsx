import { NavLink, Outlet } from 'react-router';
import { useProPendingBookings, useProSalon } from '@salondz/api-client';
import { useRealtimeBookings } from '@/lib/realtime';

const items = [
  { to: '/pro', label: 'Tableau de bord', end: true },
  { to: '/pro/agenda', label: 'Agenda' },
  { to: '/pro/reservations', label: 'Demandes' },
  { to: '/pro/services', label: 'Services' },
  { to: '/pro/equipe', label: 'Équipe' },
  { to: '/pro/horaires', label: 'Horaires' },
  { to: '/pro/salon', label: 'Mon salon' },
];

export function ProShell() {
  const { data } = useProSalon();
  const salon = data?.salon ?? null;
  const pending = useProPendingBookings(!!salon);
  useRealtimeBookings(salon?.id);
  const pendingCount = pending.data?.items.length ?? 0;

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <aside className="card h-fit p-3 md:sticky md:top-20">
        <div className="mb-3 px-2">
          <p className="truncate font-semibold">{salon?.name}</p>
          <p className="text-xs text-muted">{salon?.isPublished ? 'Publié' : 'Non publié'}</p>
          {salon && (
            <a href={`/s/${salon.slug}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
              Voir ma page publique
            </a>
          )}
        </div>
        <nav className="flex flex-col gap-1" aria-label="Espace pro">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) => `flex items-center justify-between rounded-xl px-3 py-2 text-sm ${isActive ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-bg'}`}
            >
              {it.label}
              {it.to === '/pro/reservations' && pendingCount > 0 && <span className="rounded-full bg-warning px-1.5 text-xs text-white">{pendingCount}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
