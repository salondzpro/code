/**
 * Espace pro — Clients : liste (compte, sinon numéro, sinon nom) calculée en base ; chaque ligne ouvre la fiche
 * client complète (/pro/clients/:key) : compteurs, notes privées, historique, blocage.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, Search } from 'lucide-react';
import { pagesItems, useProClientsInfinite, useProSalon } from '@salondz/api-client';
import { LoadMore } from '@/components/LoadMore';
import { formatDZPhone, formatDateShortDZ } from '@salondz/constants';
import { Avatar, Badge, I, Skeleton, Pill } from '@/components/ui';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { t } from '@/i18n';

export function Clients() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const [q, setQ] = useState('');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  // Recherche côté serveur, après une courte pause de saisie : on ne charge jamais toute la clientèle.
  const [needle, setNeedle] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setNeedle(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  const clients = useProClientsInfinite(needle);
  const rows = pagesItems(clients.data).filter((c) => !onlyBlocked || c.blocked);
  const total = clients.data?.pages[0]?.total ?? rows.length;
  const blockedCount = clients.data?.pages[0]?.blockedCount ?? 0;

  if (!salon) return <Splash />;

  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <div className="flex items-end justify-between gap-3">
        <h1 className="h1">{t("Clients")}</h1>
        <span className="text-[1rem] text-muted">{total}</span>
      </div>
      <label className="search">
        <I icon={Search} size={22} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Nom ou téléphone")}
          aria-label={t("Rechercher un client")}
        />
      </label>
      {blockedCount > 0 && (
        <div className="pills -mx-4 px-4" role="group" aria-label={t("Filtrer les clients")}>
          <Pill on={!onlyBlocked} onClick={() => setOnlyBlocked(false)}>
            {t('Tous · {n}', { n: total })}
          </Pill>
          <Pill on={onlyBlocked} onClick={() => setOnlyBlocked(true)}>
            {t('Bloqués · {n}', { n: blockedCount })}
          </Pill>
        </div>
      )}
      {clients.isError ? (
        <ErrorMessage error={clients.error} retry={() => void clients.refetch()} />
      ) : clients.isPending ? (
        <Skeleton className="h-[12.5rem] w-full !rounded-[var(--radius-card)]" />
      ) : rows.length === 0 ? (
        <p className="p">
          {onlyBlocked
            ? 'Aucun client bloqué.'
            : needle
              ? `Aucun client pour « ${needle} ».`
              : 'Vos clients apparaîtront ici après leur premier rendez-vous.'}
        </p>
      ) : (
        /* Une ligne par client, comme un répertoire : le nom, le numéro, et à droite ce qui
           compte pour décider d'appeler — combien de rendez-vous, et le prochain ou le dernier. */
        <div className="crd !gap-0 !py-1">
          {rows.map((c) => (
            <button
              key={c.clientKey}
              type="button"
              className="li w-full text-left"
              onClick={() => navigate(`/pro/clients/${encodeURIComponent(c.clientKey)}`)}
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={c.name} size={40} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[1rem] font-semibold">
                    <span className="truncate">{c.name}</span>
                    {c.blocked && (
                      <Badge tone="cn" dot={false}>
                        {t("Bloqué")}
                      </Badge>
                    )}
                  </span>
                  <span className="mono block truncate text-[0.857rem] text-muted">
                    {c.phone ? formatDZPhone(c.phone) : 'Sans numéro'}
                  </span>
                </span>
              </span>
              <span className="flex flex-none flex-col items-end">
                <span className="text-[1rem] font-semibold">
                  {c.bookingsCount} {t("RDV")}
                </span>
                <span className={`text-[0.857rem] ${c.nextAt ? 'text-ok-fg' : 'text-muted'}`}>
                  {c.nextAt
                    ? formatDateShortDZ(c.nextAt)
                    : c.lastAt
                      ? formatDateShortDZ(c.lastAt)
                      : ''}
                </span>
              </span>
              <I icon={ChevronRight} size={18} className="shrink-0 text-disabled" />
            </button>
          ))}
        </div>
      )}
      <LoadMore
        hasMore={clients.hasNextPage}
        loading={clients.isFetchingNextPage}
        onMore={() => void clients.fetchNextPage()}
        label={t("Voir plus de clients")}
      />
    </Screen>
  );
}
