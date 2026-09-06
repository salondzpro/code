/**
 * C-F 14 — Rendez-vous à venir (Itinéraire / Reporter) ; C-F 19 — Rendez-vous passés
 * (Réserver à nouveau / Noter, note donnée).
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMyBookings } from '@salondz/api-client';
import { formatDA, formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import { Avatar, Button, Img, LinkButton, Segmented, Skeleton, StatusBadge } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import type { BookingWithSalon } from '@salondz/types';

export function directionsUrl(b: BookingWithSalon): string {
  const q = [b.salon.name, b.salon.address, b.salon.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** « 2 août » sans le jour de semaine. */
function dayMonth(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

export function Bookings() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [scope, setScope] = useState<'upcoming' | 'past'>(params.get('scope') === 'past' ? 'past' : 'upcoming');
  const list = useMyBookings({ scope });
  const items = list.data?.items ?? [];

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <h1 className="h1 !text-[34px]">{scope === 'past' ? 'Mes rendez-vous' : 'Rendez-vous'}</h1>
      <Segmented
        label="Période"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'upcoming', label: 'À venir' },
          { value: 'past', label: 'Passés' },
        ]}
      />
      {list.isPending ? (
        <>
          <Skeleton className="h-[180px] w-full !rounded-[20px]" />
          <Skeleton className="h-[120px] w-full !rounded-[20px]" />
        </>
      ) : list.isError ? (
        <ErrorMessage error={list.error} retry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 pt-14 text-center">
          <div className="text-[22px] font-bold">{scope === 'upcoming' ? 'Aucun rendez-vous à venir' : 'Aucun rendez-vous passé'}</div>
          <p className="p">Réservez en quelques secondes dans le salon de votre choix.</p>
          <LinkButton to="/" className="mt-2">
            Explorer les salons
          </LinkButton>
        </div>
      ) : scope === 'upcoming' ? (
        items.map((b) => {
          const active = b.status === 'pending' || b.status === 'confirmed';
          return (
            <div key={b.id} role="link" tabIndex={0} onClick={() => navigate(`/rendez-vous/${b.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/rendez-vous/${b.id}`)} className="crd !gap-4 cursor-pointer">
              <div className="flex items-center justify-between gap-3">
                <span className={`text-[22px] font-bold tracking-[-0.4px] ${active ? '' : 'text-muted'}`}>
                  {formatDateShortDZ(b.startsAt).replace(/^\w/, (c) => c.toUpperCase())} · {formatTimeDZ(b.startsAt)}
                </span>
                <StatusBadge status={b.status} md />
              </div>
              <div className="flex items-center gap-3.5">
                <Img src={b.salon.coverUrl} className={`h-[104px] w-[104px] flex-none !rounded-[16px] ${active ? '' : 'opacity-60'}`} />
                <span className="min-w-0">
                  <span className={`block text-[22px] font-bold tracking-[-0.4px] ${active ? '' : 'text-muted'}`}>{b.serviceName}</span>
                  <span className="block text-[17px] text-muted">
                    {b.status === 'cancelled' ? `Annulé${b.cancelledBy === 'salon' ? ' par le salon' : ''}` : `${b.salon.name} · ${formatDA(b.priceDa)}`}
                  </span>
                </span>
              </div>
              {active && (
                <div className="g2">
                  <a href={directionsUrl(b)} target="_blank" rel="noreferrer" className="btn g sm !py-[18px] !text-[17px]" onClick={(e) => e.stopPropagation()}>
                    Itinéraire
                  </a>
                  {b.salon.allowClientReschedule !== false && (
                    <Button
                      variant="g"
                      sm
                      className="!py-[18px] !text-[17px]"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/rendez-vous/${b.id}/reporter`);
                      }}
                    >
                      Reporter
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })
      ) : (
        items.map((b) => (
          <div key={b.id} className="crd !gap-4">
            <div className="flex items-center gap-3.5">
              <Avatar src={b.salon.coverUrl} name={b.salon.name} size={84} />
              <span className="min-w-0 flex-1">
                <span className="block text-[22px] font-bold tracking-[-0.4px]">{b.salon.name}</span>
                <span className="block text-[17px] text-muted">
                  {dayMonth(b.startsAt)} · {b.serviceName}
                  {b.status !== 'cancelled' ? ` · ${formatDA(b.priceDa)}` : ''}
                </span>
              </span>
              <StatusBadge status={b.status} md />
            </div>
            {b.status === 'completed' && (
              <div className="flex gap-2.5">
                <LinkButton to={`/s/${b.salon.slug}/prestations`} variant="g" sm className="flex-1 !py-[18px] !text-[18px]">
                  Réserver à nouveau
                </LinkButton>
                <LinkButton to={`/rendez-vous/${b.id}/noter`} variant="g" sm auto className="!px-6 !py-[18px] !text-[18px]">
                  Noter
                </LinkButton>
              </div>
            )}
          </div>
        ))
      )}
    </Screen>
  );
}
