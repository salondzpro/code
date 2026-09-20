/**
 * Administration — comptes (clients et professionnels) : liste, et fiche d'un compte.
 *
 * On cherche par ce dont on dispose quand quelqu'un écrit ou appelle : un nom, un numéro, une
 * adresse e-mail. La fiche montre son historique, ses avis, et les salons qui l'ont bloqué — de
 * quoi trancher « ce client est-il de mauvaise foi ou a-t-il eu un empêchement ? ».
 */
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ChevronRight, ExternalLink, Search } from 'lucide-react';
import { pagesItems, useAdminProfile, useAdminProfiles } from '@salondz/api-client';
import { type BookingStatus, formatDA, formatDZPhone, formatDateShortDZ } from '@salondz/constants';
import { LoadMore } from '@/components/LoadMore';
import { ErrorMessage, isNotFound } from '@/components/ErrorMessage';
import { NotFoundState } from '@/pages/NotFound';
import { Avatar, Badge, I, Pill, Skeleton, StatusBadge, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { LOCALES, t } from '@/i18n';

export function AdminProfiles() {
  const [params, setParams] = useSearchParams();
  const role = (params.get('role') as 'client' | 'pro' | null) ?? undefined;
  const [q, setQ] = useState('');
  const [needle, setNeedle] = useState('');
  useEffect(() => {
    const h = window.setTimeout(() => setNeedle(q.trim()), 300);
    return () => window.clearTimeout(h);
  }, [q]);

  const liste = useAdminProfiles({ q: needle || undefined, role });
  const rows = pagesItems(liste.data);
  const total = liste.data?.pages[0]?.total ?? rows.length;

  const filtre = (valeur?: 'client' | 'pro') => {
    const p = new URLSearchParams(params);
    if (valeur) p.set('role', valeur);
    else p.delete('role');
    setParams(p, { replace: true });
  };

  return (
    <Screen gap={12} width="page">
      <div className="flex items-end justify-between gap-3">
        <h1 className="h1">{t('Comptes')}</h1>
        <span className="text-[1rem] text-muted">{total}</span>
      </div>

      <label className="search">
        <I icon={Search} size={22} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('Nom, téléphone ou adresse e-mail')}
          aria-label={t('Rechercher un compte')}
        />
      </label>

      <div className="pills -mx-4 px-4" role="group" aria-label={t('Filtrer')}>
        <Pill on={!role} onClick={() => filtre(undefined)}>{t('Tous')}</Pill>
        <Pill on={role === 'client'} onClick={() => filtre('client')}>{t('Clients')}</Pill>
        <Pill on={role === 'pro'} onClick={() => filtre('pro')}>{t('Professionnels')}</Pill>
      </div>

      {liste.isError ? (
        <ErrorMessage error={liste.error} retry={() => void liste.refetch()} />
      ) : liste.isPending ? (
        <Skeleton className="h-[4.5rem] w-full !rounded-[var(--radius-card)]" />
      ) : rows.length === 0 ? (
        <p className="p pt-6 text-center">{t('Aucun compte ne correspond.')}</p>
      ) : (
        <div className="crd !gap-0 !py-1">
          {rows.map((p) => (
            <Link key={p.id} to={`/admin/comptes/${p.id}`} className="li">
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={p.avatarUrl} name={p.fullName ?? '?'} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-[1rem] font-semibold">
                    {p.fullName ?? t('Sans nom')}
                    {p.role === 'pro' && <span className="text-muted"> · {p.salonName ?? t('pro')}</span>}
                  </span>
                  <span className="mono block truncate text-[0.857rem] text-muted" dir="ltr">
                    {p.phone ? formatDZPhone(p.phone) : (p.email ?? '—')}
                  </span>
                </span>
              </span>
              <span className="flex-none text-end text-[0.857rem] text-muted">
                <span className="block">{t('{n} RDV', { n: p.bookingsCount })}</span>
                {p.noShowCount > 0 && <span className="block text-danger">{t('{n} absences', { n: p.noShowCount })}</span>}
              </span>
              <I icon={ChevronRight} size={18} className="shrink-0 text-disabled" />
            </Link>
          ))}
        </div>
      )}

      <LoadMore
        hasMore={liste.hasNextPage}
        loading={liste.isFetchingNextPage}
        onMore={() => void liste.fetchNextPage()}
        label={t('Voir plus de comptes')}
      />
    </Screen>
  );
}

export function AdminProfile() {
  const { id = '' } = useParams();
  const fiche = useAdminProfile(id);

  if (isNotFound(fiche.error))
    return (
      <NotFoundState
        title={t('Compte introuvable')}
        description={t("Ce compte n'existe pas, ou a été supprimé.")}
        to="/admin/comptes"
        label={t('Retour aux comptes')}
      />
    );
  if (fiche.isError)
    return <Screen gap={12}><ErrorMessage error={fiche.error} retry={() => void fiche.refetch()} /></Screen>;
  if (fiche.isPending)
    return <Screen gap={12}><Skeleton className="h-[8rem] w-full !rounded-[var(--radius-card)]" /></Screen>;

  const { profile: p, email, bookings, reviews, blockedBy, salon } = fiche.data;

  return (
    <Screen gap={14} width="page">
      <TopBar backTo="/admin/comptes" right={t('Comptes')} />

      <div className="crd !gap-3">
        <div className="flex items-center gap-3.5">
          <Avatar src={p.avatarUrl} name={p.fullName ?? '?'} size={56} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.429rem] font-semibold tracking-[-0.4px]">
              {p.fullName ?? t('Sans nom')}
            </span>
            {email && <span className="block truncate text-[0.857rem] text-muted">{email}</span>}
            {p.phone && (
              <span className="mono block text-[0.857rem] text-muted" dir="ltr">{formatDZPhone(p.phone)}</span>
            )}
          </span>
          <Badge tone={p.role === 'pro' ? 'cf' : 'nu'}>{p.role === 'pro' ? t('Professionnel') : t('Client')}</Badge>
        </div>
        {salon && (
          <Link to={`/admin/salons/${salon.id}`} className="btn g sm !justify-center">
            <I icon={ExternalLink} size={16} /> {salon.name}
          </Link>
        )}
      </div>

      <div className="crd !gap-0 !py-1">
        <div className="li">
          <span>{t('Inscrit le')}</span>
          <b>{formatDateShortDZ(p.createdAt)}</b>
        </div>
        <div className="li">
          <span>{t('Marché affiché')}</span>
          <b>{p.market === 'women' ? t('Femmes') : p.market === 'men' ? t('Hommes') : '—'}</b>
        </div>
        <div className="li">
          <span>{t('Langue')}</span>
          <b>{LOCALES.find((l) => l.value === p.locale)?.label ?? p.locale}</b>
        </div>
      </div>

      {blockedBy.length > 0 && (
        <>
          <span className="h3">{t('Bloqué par')} · {blockedBy.length}</span>
          <div className="crd !gap-0 !py-1">
            {blockedBy.map((b) => (
              <div key={b.salonId} className="li">
                <span className="min-w-0 truncate">{b.salons?.name ?? b.salonId}</span>
                <span className="flex-none text-[0.857rem] text-muted">{b.reason ?? t('sans motif')}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <span className="h3">{t('Rendez-vous')} · {bookings.length}</span>
      <div className="crd !gap-0 !py-1">
        {bookings.length === 0 && <div className="li"><span className="p">{t('Aucun rendez-vous.')}</span></div>}
        {bookings.map((b) => (
          <div key={b.id} className="li">
            <span className="min-w-0">
              <span className="block truncate text-[1rem]">
                <b>{b.salons?.name ?? '—'}</b> <span className="text-muted">· {b.serviceName}</span>
              </span>
              <span className="block text-[0.857rem] text-muted" dir="ltr">
                {formatDateShortDZ(b.startsAt)} · {formatDA(b.priceDa)}
              </span>
              {b.cancellationReason && (
                <span className="block text-[0.857rem] text-muted">{t('Motif :')} {b.cancellationReason}</span>
              )}
            </span>
            <StatusBadge status={b.status as BookingStatus} />
          </div>
        ))}
      </div>

      <span className="h3">{t('Avis donnés')} · {reviews.length}</span>
      <div className="crd !gap-0 !py-1">
        {reviews.length === 0 && <div className="li"><span className="p">{t('Aucun avis.')}</span></div>}
        {reviews.map((r) => (
          <div key={r.id} className="li !items-start">
            <span className="min-w-0">
              <span className="block text-[1rem] font-semibold">
                {'★'.repeat(r.rating)}
                <span className="text-disabled">{'★'.repeat(5 - r.rating)}</span>
                <span className="font-normal text-muted"> · {r.salons?.name ?? '—'}</span>
              </span>
              {r.comment && <span className="block text-[0.857rem] text-muted">{r.comment}</span>}
            </span>
            <span className="flex-none text-[0.857rem] text-muted">{formatDateShortDZ(r.createdAt)}</span>
          </div>
        ))}
      </div>
    </Screen>
  );
}
