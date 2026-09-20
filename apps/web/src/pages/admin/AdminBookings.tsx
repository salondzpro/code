/**
 * Administration — recherche de rendez-vous, et journal.
 *
 * La recherche sert presque uniquement au litige : « le client dit qu'il a annulé, le salon dit
 * que non ». On montre donc ce qui tranche — qui a annulé, quand, avec quel motif — plutôt qu'un
 * bel agenda.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Search } from 'lucide-react';
import { pagesItems, useAdminAudit, useAdminBookings } from '@salondz/api-client';
import { BOOKING_STATUSES, type BookingStatus, formatDA, formatDZPhone } from '@salondz/constants';
import { LoadMore } from '@/components/LoadMore';
import { ErrorMessage } from '@/components/ErrorMessage';
import { I, Pill, Skeleton, StatusBadge } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { t } from '@/i18n';

/**
 * Les mêmes mots que partout ailleurs dans le produit : on ne lit pas « no_show » à l'écran. Les
 * phrases sont écrites une par une, et non dans une table indexée : l'extracteur de traductions
 * ne voit que les appels de traduction dont la phrase est écrite en toutes lettres.
 */
const libelle = (s: BookingStatus) =>
  s === 'pending'
    ? t('À confirmer')
    : s === 'confirmed'
      ? t('Confirmés')
      : s === 'cancelled'
        ? t('Annulés')
        : s === 'completed'
          ? t('Terminés')
          : t('Absences');

/**
 * Qui a annulé, vu de la plateforme. `cancelledLabel` répond « par vous » selon qu'on regarde en
 * client ou en salon ; ici on n'est ni l'un ni l'autre, donc on nomme les deux.
 */
const parQui = (by: string | null) =>
  by === 'client'
    ? t('le client')
    : by === 'salon'
      ? t('le salon')
      : by === 'system'
        ? t('le système (demande expirée)')
        : '—';

const quand = (iso: string) =>
  new Intl.DateTimeFormat('fr-DZ', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Africa/Algiers',
  }).format(new Date(iso));

export function AdminBookings() {
  const [q, setQ] = useState('');
  const [needle, setNeedle] = useState('');
  const [statut, setStatut] = useState<string | undefined>(undefined);
  useEffect(() => {
    const h = window.setTimeout(() => setNeedle(q.trim()), 300);
    return () => window.clearTimeout(h);
  }, [q]);

  const liste = useAdminBookings({ q: needle || undefined, status: statut });
  const rows = pagesItems(liste.data);
  const total = liste.data?.pages[0]?.total ?? rows.length;

  return (
    <Screen gap={12} width="page">
      <div className="flex items-end justify-between gap-3">
        <h1 className="h1">{t('Rendez-vous')}</h1>
        <span className="text-[1rem] text-muted">{total}</span>
      </div>

      <label className="search">
        <I icon={Search} size={22} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('Client, téléphone ou salon')}
          aria-label={t('Rechercher un rendez-vous')}
        />
      </label>

      <div className="pills -mx-4 px-4" role="group" aria-label={t('Filtrer par statut')}>
        <Pill on={!statut} onClick={() => setStatut(undefined)}>{t('Tous')}</Pill>
        {BOOKING_STATUSES.map((s) => (
          <Pill key={s} on={statut === s} onClick={() => setStatut(s)}>
            {libelle(s)}
          </Pill>
        ))}
      </div>

      {liste.isError ? (
        <ErrorMessage error={liste.error} retry={() => void liste.refetch()} />
      ) : liste.isPending ? (
        <Skeleton className="h-[5rem] w-full !rounded-[var(--radius-card)]" />
      ) : rows.length === 0 ? (
        <p className="p pt-6 text-center">{t('Aucun rendez-vous ne correspond.')}</p>
      ) : (
        <div className="crd !gap-0 !py-1">
          {rows.map((b) => (
            <div key={b.id} className="li !items-start">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[1rem]">
                  <b>{b.clientName}</b>
                  {b.clientPhone && (
                    <span className="mono text-muted" dir="ltr"> · {formatDZPhone(b.clientPhone)}</span>
                  )}
                </span>
                <span className="block truncate text-[0.857rem] text-muted">
                  {b.salonSlug ? (
                    <Link to={`/admin/salons/${b.salonId}`} className="underline">
                      {b.salonName}
                    </Link>
                  ) : (
                    b.salonName
                  )}
                  {' · '}
                  {b.serviceName}
                  {b.staffName ? ` · ${b.staffName}` : ''}
                </span>
                <span className="block text-[0.857rem] text-muted" dir="ltr">
                  {quand(b.startsAt)} · {formatDA(b.priceDa)} · {b.source}
                </span>
                {b.cancelledAt && (
                  <span className="block text-[0.857rem] text-danger">
                    {t('Annulé par {qui} le {quand}', {
                      qui: parQui(b.cancelledBy),
                      quand: quand(b.cancelledAt),
                    })}
                    {b.cancellationReason ? ` · ${b.cancellationReason}` : ''}
                  </span>
                )}
              </span>
              <StatusBadge status={b.status as BookingStatus} />
            </div>
          ))}
        </div>
      )}

      <LoadMore
        hasMore={liste.hasNextPage}
        loading={liste.isFetchingNextPage}
        onMore={() => void liste.fetchNextPage()}
        label={t('Voir plus de rendez-vous')}
      />
    </Screen>
  );
}

/**
 * Journal des actions d'administration. Un opérateur agit sur les données d'autrui ; savoir qui a
 * regardé ou modifié quoi fait partie du contrat, et c'est ce qui permet d'expliquer une décision
 * six mois plus tard.
 */
export function AdminAudit() {
  const liste = useAdminAudit();
  const rows = pagesItems(liste.data);
  return (
    <Screen gap={12} width="page">
      <h1 className="h1">{t('Journal')}</h1>
      <p className="p text-[1rem]">
        {t("Toute consultation d'une fiche nominative et toute action laissent une trace : qui, quand, sur qui, et depuis où.")}
      </p>

      {liste.isError ? (
        <ErrorMessage error={liste.error} retry={() => void liste.refetch()} />
      ) : liste.isPending ? (
        <Skeleton className="h-[5rem] w-full !rounded-[var(--radius-card)]" />
      ) : rows.length === 0 ? (
        <p className="p pt-6 text-center">{t('Rien pour le moment.')}</p>
      ) : (
        <div className="crd !gap-0 !py-1">
          {rows.map((a) => (
            <div key={a.id} className="li !items-start">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[1rem]">
                  <b>{a.action}</b>
                  {a.targetType && <span className="text-muted"> · {a.targetType}</span>}
                </span>
                <span className="block truncate text-[0.857rem] text-muted">
                  {a.profiles?.fullName ?? a.adminId}
                  {a.ip ? ` · ${a.ip}` : ''}
                  {a.reason ? ` · ${a.reason}` : ''}
                </span>
              </span>
              <span className="flex-none text-[0.857rem] text-muted" dir="ltr">{quand(a.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      <LoadMore
        hasMore={liste.hasNextPage}
        loading={liste.isFetchingNextPage}
        onMore={() => void liste.fetchNextPage()}
        label={t('Voir plus')}
      />
    </Screen>
  );
}
