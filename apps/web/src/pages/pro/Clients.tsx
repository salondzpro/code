/**
 * Espace pro — Clients : liste (compte, sinon numéro, sinon nom) calculée en base ; chaque ligne ouvre la fiche
 * client complète (/pro/clients/:key) : compteurs, notes privées, historique, blocage.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, Download, Search, Star } from 'lucide-react';
import { pagesItems, useApi, useProClientsInfinite, useProSalon } from '@salondz/api-client';
import type { ProClient } from '@salondz/types';
import { LoadMore } from '@/components/LoadMore';
import { formatDA, formatDZPhone, formatDateShortDZ, toLocalDateKey } from '@salondz/constants';

/** À partir de combien de rendez-vous TERMINÉS un client est un habitué. */
const LOYAL_VISITS = 4;
import { Avatar, Badge, I, IconButton, Skeleton, Pill } from '@/components/ui';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { PageLoading } from '@/components/PageLoading';
import { t } from '@/i18n';

/** Une cellule de CSV : le point-virgule, le guillemet et le retour à la ligne s'échappent. */
const cell = (v: string | number | null | undefined): string => {
  const t = v == null ? '' : String(v);
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function Clients() {
  const navigate = useNavigate();
  const { api } = useApi();
  const salon = useProSalon().data?.salon ?? null;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
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

  /**
   * Export de TOUTE la clientèle, pas seulement des pages déjà affichées : le professionnel qui
   * exporte veut son fichier complet. On parcourt les pages du serveur (jamais de requête qui
   * ramènerait toute la base d'un coup) et on s'arrête à EXPORT_MAX.
   */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const EXPORT_MAX = 5000;
      const tous: ProClient[] = [];
      let cursor: string | undefined;
      do {
        const page = await api.pro.clients.list({ q: needle || undefined, cursor, limit: 100 });
        tous.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor && tous.length < EXPORT_MAX);
      const lignes = [
        ['nom', 'telephone', 'rendez_vous', 'termines', 'annules', 'absences', 'depense_da', 'dernier', 'prochain', 'bloque'],
        ...tous.map((c) => [
          c.name,
          c.phone ?? '',
          c.bookingsCount,
          c.completedCount,
          c.cancelledCount,
          c.noShowCount,
          c.spentDa,
          c.lastAt ? c.lastAt.slice(0, 10) : '',
          c.nextAt ? c.nextAt.slice(0, 10) : '',
          c.blocked ? 'oui' : 'non',
        ]),
      ];
      // BOM : sans lui, Excel lit « Amine BenaÃ¯ » au lieu de « Amine Benaï ».
      const blob = new Blob(['\ufeff' + lignes.map((l) => l.map(cell).join(';')).join('\n')], {
        type: 'text/csv;charset=utf-8',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `clients-${salon?.slug ?? 'salon'}-${toLocalDateKey()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setExportError(err);
    } finally {
      setExporting(false);
    }
  };

  if (!salon) return <PageLoading />;

  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="h1">{t("Clients")}</h1>
          {total > 0 && <p className="text-[0.857rem] text-muted">{total > 1 ? t('{n} clients', { n: total }) : t('{n} client', { n: total })}</p>}
        </div>
        <span className="flex items-center gap-2">
          {total > 0 && (
            <IconButton
              lg
              aria-label={t("Exporter la clientèle")}
              title={t("Exporter la clientèle")}
              disabled={exporting}
              onClick={() => void exportCsv()}
            >
              <I icon={Download} size={20} />
            </IconButton>
          )}
        </span>
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
        <div className="pills bleed" role="group" aria-label={t("Filtrer les clients")}>
          <Pill on={!onlyBlocked} onClick={() => setOnlyBlocked(false)}>
            {t('Tous · {n}', { n: total })}
          </Pill>
          <Pill on={onlyBlocked} onClick={() => setOnlyBlocked(true)}>
            {t('Bloqués · {n}', { n: blockedCount })}
          </Pill>
        </div>
      )}
      <ErrorMessage error={exportError} />
      {clients.isError ? (
        <ErrorMessage error={clients.error} retry={() => void clients.refetch()} />
      ) : clients.isPending ? (
        <Skeleton className="h-[12.5rem] w-full !rounded-[var(--radius-card)]" />
      ) : rows.length === 0 ? (
        <p className="p">
          {onlyBlocked
            ? t('Aucun client bloqué.')
            : needle
              ? t('Aucun client pour « {q} ».', { q: needle })
              : t('Vos clients apparaîtront ici après leur premier rendez-vous.')}
        </p>
      ) : (
        /* Une ligne par client, comme un répertoire : le nom, le numéro, et à droite ce qui
           compte pour décider d'appeler — combien de rendez-vous, et le prochain ou le dernier. */
        <div className="crd !gap-0 !py-1">
          {rows.map((c) => {
            // Un repère d'un mot : l'habitué se reconnaît, le nouveau aussi.
            const tag = c.completedCount >= LOYAL_VISITS ? 'loyal' : c.bookingsCount === 1 ? 'new' : null;
            return (
              <button
                key={c.clientKey}
                type="button"
                className="li w-full text-start"
                onClick={() => navigate(`/pro/clients/${encodeURIComponent(c.clientKey)}`)}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={c.name} size={40} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[1rem] font-semibold">
                      <span className="truncate">{c.name}</span>
                      {c.blocked ? (
                        <Badge tone="cn" dot={false}>
                          {t("Bloqué")}
                        </Badge>
                      ) : tag === 'loyal' ? (
                        <span className="cl-tag loyal">
                          <I icon={Star} size={11} /> {t('Habitué')}
                        </span>
                      ) : tag === 'new' ? (
                        <span className="cl-tag">{t('Nouveau')}</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[0.857rem] text-muted">
                      <span className="mono" dir="ltr">
                        {c.phone ? formatDZPhone(c.phone) : t('Sans numéro')}
                      </span>
                    </span>
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end text-end">
                  {/* Le prochain passage compte plus que le dernier : il dit qu'on va le revoir. */}
                  <span className={`text-[0.714rem] font-semibold uppercase tracking-wide ${c.nextAt ? 'text-ok-fg' : 'text-subtle'}`}>
                    {c.nextAt ? t('Prochain') : c.lastAt ? t('Dernier') : ''}
                  </span>
                  <span className="text-[0.857rem] font-semibold">
                    {c.nextAt ? formatDateShortDZ(c.nextAt) : c.lastAt ? formatDateShortDZ(c.lastAt) : ''}
                  </span>
                  <span className="text-[0.786rem] text-muted">
                    {t('{n} RDV', { n: c.bookingsCount })}
                    {c.spentDa > 0 && (
                      <>
                        {' · '}
                        <span dir="ltr">{formatDA(c.spentDa)}</span>
                      </>
                    )}
                  </span>
                </span>
                <I icon={ChevronRight} size={18} className="shrink-0 text-disabled rtl:-scale-x-100" />
              </button>
            );
          })}
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
