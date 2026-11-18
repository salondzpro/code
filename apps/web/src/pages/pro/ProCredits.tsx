/**
 * CRÉDITS CLIENTS (18 nov. 2026) : qui doit combien, le plus gros d'abord, et le total dû en tête.
 * Chaque ligne ouvre la fiche du client, où l'on encaisse.
 */
import { Link } from 'react-router';
import { useProCredits } from '@salondz/api-client';
import { formatDA, formatDateShortDZ } from '@salondz/constants';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Avatar, EmptyState, Skeleton, TopBar } from '@/components/ui';
import { ErrorMessage } from '@/components/ErrorMessage';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

export function ProCredits() {
  const q = useProCredits();
  const total = (q.data ?? []).reduce((a, r) => a + r.balance, 0);
  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <TopBar backTo="/pro/parametres" title={t('Crédits clients')} />
      {q.isPending ? (
        <Skeleton className="h-[8rem] w-full !rounded-[var(--radius-card)]" />
      ) : q.isError ? (
        <ErrorMessage error={q.error} retry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState icon={ICONE.credit} title={t('Aucun crédit en cours')} />
      ) : (
        <>
          <div className="crd !flex-row items-center justify-between">
            <b className="text-[1rem] font-semibold">{t('Total dû')}</b>
            <span className="cr-bal du" dir="ltr">
              {formatDA(total)}
            </span>
          </div>
          <div className="crd !gap-0 !py-1">
            {q.data.map((r) => (
              <Link key={r.clientKey} to={`/pro/clients/${encodeURIComponent(r.clientKey)}`} className="li">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={r.name} size={36} />
                  <span className="min-w-0">
                    <b className="block truncate text-[1rem] font-semibold">{r.name}</b>
                    {r.lastAt && <span className="block text-[0.857rem] text-muted">{formatDateShortDZ(r.lastAt)}</span>}
                  </span>
                </span>
                <b className="flex-none text-[1rem] text-danger" dir="ltr">
                  {formatDA(r.balance)}
                </b>
              </Link>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
