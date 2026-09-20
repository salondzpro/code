/**
 * Administration — professionnels. La liste sert à UNE chose : retrouver un salon en trois
 * secondes quand son propriétaire appelle. On cherche donc par ce qu'on a sous la main — le nom,
 * la ville, le lien, mais aussi le nom et le numéro du propriétaire.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ChevronRight, Search } from 'lucide-react';
import { pagesItems, useAdminSalons } from '@salondz/api-client';
import { formatDA, formatDZPhone, wilayaName } from '@salondz/constants';
import { LoadMore } from '@/components/LoadMore';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Avatar, Badge, I, Pill, Skeleton } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { t } from '@/i18n';

/** En français, zéro et un restent au singulier. Une phrase par cas : l'extracteur de
    traductions ne voit que celles écrites en toutes lettres. */
const nAnnules = (n: number) => (n > 1 ? t('{n} annulés', { n }) : t('{n} annulé', { n }));
const nAbsences = (n: number) => (n > 1 ? t('{n} absences', { n }) : t('{n} absence', { n }));
const nPrestations = (n: number) =>
  n > 1 ? t('{n} prestations', { n }) : t('{n} prestation', { n });

export function AdminSalons() {
  const [params, setParams] = useSearchParams();
  const statut = (params.get('status') as 'published' | 'draft' | null) ?? undefined;
  const [q, setQ] = useState('');
  const [needle, setNeedle] = useState('');
  useEffect(() => {
    const h = window.setTimeout(() => setNeedle(q.trim()), 300);
    return () => window.clearTimeout(h);
  }, [q]);

  const liste = useAdminSalons({ q: needle || undefined, status: statut });
  const rows = pagesItems(liste.data);
  const total = liste.data?.pages[0]?.total ?? rows.length;

  const filtre = (valeur?: 'published' | 'draft') => {
    const p = new URLSearchParams(params);
    if (valeur) p.set('status', valeur);
    else p.delete('status');
    setParams(p, { replace: true });
  };

  return (
    <Screen gap={12} width="page">
      <div className="flex items-end justify-between gap-3">
        <h1 className="h1">{t('Professionnels')}</h1>
        <span className="text-[1rem] text-muted">{total}</span>
      </div>

      <label className="search">
        <I icon={Search} size={22} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('Salon, ville, lien, propriétaire, téléphone')}
          aria-label={t('Rechercher un professionnel')}
        />
      </label>

      <div className="pills -mx-4 px-4" role="group" aria-label={t('Filtrer')}>
        <Pill on={!statut} onClick={() => filtre(undefined)}>{t('Tous')}</Pill>
        <Pill on={statut === 'published'} onClick={() => filtre('published')}>{t('Publiés')}</Pill>
        <Pill on={statut === 'draft'} onClick={() => filtre('draft')}>{t('Non publiés')}</Pill>
      </div>

      {liste.isError ? (
        <ErrorMessage error={liste.error} retry={() => void liste.refetch()} />
      ) : liste.isPending ? (
        <>
          <Skeleton className="h-[5.5rem] w-full !rounded-[var(--radius-card)]" />
          <Skeleton className="h-[5.5rem] w-full !rounded-[var(--radius-card)]" />
        </>
      ) : rows.length === 0 ? (
        <p className="p pt-6 text-center">{t('Aucun professionnel ne correspond.')}</p>
      ) : (
        <div className="gr flex flex-col gap-2">
          {rows.map((s) => (
            <Link key={s.id} to={`/admin/salons/${s.id}`} className="crd !gap-2">
              <div className="flex items-center gap-3">
                <Avatar name={s.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[1.143rem] font-semibold">{s.name}</span>
                  <span className="block truncate text-[0.857rem] text-muted">
                    {s.city} · {wilayaName(s.wilayaCode)}
                  </span>
                </span>
                {s.suspendedAt ? (
                  <Badge tone="cn">{s.suspensionLevel === 'hidden' ? t('Masqué') : t('Gelé')}</Badge>
                ) : (
                  <Badge tone={s.isPublished ? 'ok' : 'pd'}>
                    {s.isPublished ? t('En ligne') : t('Brouillon')}
                  </Badge>
                )}
                <I icon={ChevronRight} size={18} className="shrink-0 text-disabled" />
              </div>
              <div className="sf !py-2 text-[0.857rem]">
                <span className="block truncate">
                  <b>{s.ownerName ?? t('Propriétaire sans nom')}</b>
                  {s.ownerPhone && <span className="mono text-muted" dir="ltr"> · {formatDZPhone(s.ownerPhone)}</span>}
                </span>
                {s.ownerEmail && <span className="block truncate text-muted">{s.ownerEmail}</span>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.857rem] text-muted">
                <span>{t('{n} rendez-vous · 30 j', { n: s.bookings30 })}</span>
                <span dir="ltr">{formatDA(s.revenue30)}</span>
                <span>{nAnnules(s.cancelled30)}</span>
                <span>{nAbsences(s.noShow30)}</span>
                <span>{nPrestations(s.servicesCount)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <LoadMore
        hasMore={liste.hasNextPage}
        loading={liste.isFetchingNextPage}
        onMore={() => void liste.fetchNextPage()}
        label={t('Voir plus de professionnels')}
      />
    </Screen>
  );
}
