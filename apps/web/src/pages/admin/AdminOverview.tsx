/**
 * Administration — vue d'ensemble. Répond à « est-ce que tout va bien ? » sans faire défiler :
 * ce qui s'est passé aujourd'hui, la tendance sur trente jours, la taille de la place de marché,
 * et l'état de la machine. Une ligne verte ou rouge, pas un graphique.
 */
import { Link } from 'react-router';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAdminOverview } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import { ErrorMessage } from '@/components/ErrorMessage';
import { I, Skeleton } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { t } from '@/i18n';

function Chiffre({ valeur, libelle, to }: { valeur: string; libelle: string; to?: string }) {
  const contenu = (
    <>
      <span className="block text-[1.714rem] font-semibold leading-tight tracking-[-0.6px]">{valeur}</span>
      <span className="block text-[0.857rem] text-muted">{libelle}</span>
    </>
  );
  return to ? (
    <Link to={to} className="crd !gap-0 !py-3">
      {contenu}
    </Link>
  ) : (
    <div className="crd !gap-0 !py-3">{contenu}</div>
  );
}

/** Un tic de cron de plus de deux heures veut dire que les rappels ne partent plus. */
const SEUIL_CRON_MS = 2 * 3_600_000;

export function AdminOverview() {
  const vue = useAdminOverview();
  if (vue.isError) return <Screen gap={12}><ErrorMessage error={vue.error} retry={() => void vue.refetch()} /></Screen>;
  if (vue.isPending)
    return (
      <Screen gap={12}>
        <Skeleton className="h-[5rem] w-full !rounded-[var(--radius-card)]" />
        <Skeleton className="h-[9rem] w-full !rounded-[var(--radius-card)]" />
      </Screen>
    );

  const o = vue.data;
  const tic = o.health.lastCronTick ? new Date(o.health.lastCronTick) : null;
  const cronOk = !!tic && Date.now() - tic.getTime() < SEUIL_CRON_MS;

  return (
    <Screen gap={16} width="page">
      <h1 className="h1">{t("Vue d'ensemble")}</h1>

      <span className="h3">{t("Aujourd'hui")}</span>
      <div className="gr grid grid-cols-2 gap-1.5">
        <Chiffre valeur={String(o.today.bookings)} libelle={t('rendez-vous pris')} to="/admin/rendez-vous" />
        <Chiffre valeur={String(o.today.cancelled)} libelle={t('annulations')} />
        <Chiffre valeur={String(o.today.noShows)} libelle={t('absences')} />
        <Chiffre valeur={String(o.today.signups)} libelle={t('nouveaux comptes')} to="/admin/comptes" />
      </div>

      <span className="h3">{t('Trente derniers jours')}</span>
      <div className="crd !gap-0 !py-1">
        <div className="li">
          <span>{t('Rendez-vous')}</span>
          <b>{o.last30.bookings}</b>
        </div>
        <div className="li">
          <span>{t('Encaissé (terminés)')}</span>
          <b dir="ltr">{formatDA(o.last30.revenueDa)}</b>
        </div>
        <div className="li">
          <span>{t("Taux d'annulation")}</span>
          <b>{o.last30.cancelRate} %</b>
        </div>
        <div className="li">
          <span>{t("Taux d'absence")}</span>
          <b>{o.last30.noShowRate} %</b>
        </div>
      </div>

      <span className="h3">{t('La place de marché')}</span>
      <div className="crd !gap-0 !py-1">
        <Link to="/admin/salons?status=published" className="li">
          <span>{t('Salons publiés')}</span>
          <b>
            {o.marketplace.salonsPublished}{' '}
            <span className="font-normal text-muted">/ {o.marketplace.salons}</span>
          </b>
        </Link>
        <Link to="/admin/comptes?role=pro" className="li">
          <span>{t('Professionnels')}</span>
          <b>{o.marketplace.pros}</b>
        </Link>
        <Link to="/admin/comptes?role=client" className="li">
          <span>{t('Clients')}</span>
          <b>{o.marketplace.clients}</b>
        </Link>
        <div className="li">
          <span>{t('Prestations actives')}</span>
          <b>{o.marketplace.services}</b>
        </div>
        <div className="li">
          <span>{t('Avis')}</span>
          <b>
            {o.marketplace.reviews}{' '}
            <span className="font-normal text-muted">
              {t('dont {n} sans réponse', { n: o.marketplace.reviewsNoReply })}
            </span>
          </b>
        </div>
      </div>

      <span className="h3">{t('La machine')}</span>
      <div className="crd !gap-0 !py-1">
        <div className="li">
          <span className="flex items-center gap-2">
            <I icon={cronOk ? CheckCircle2 : AlertTriangle} size={18} className={cronOk ? 'text-ok-fg' : 'text-danger'} />
            {t('Tâche automatique')}
          </span>
          <b className={cronOk ? '' : 'text-danger'}>
            {tic
              ? new Intl.DateTimeFormat('fr-DZ', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Algiers' }).format(tic)
              : t('jamais')}
          </b>
        </div>
        <div className="li">
          <span className="flex items-center gap-2">
            <I
              icon={o.health.pendingOverdue === 0 ? CheckCircle2 : AlertTriangle}
              size={18}
              className={o.health.pendingOverdue === 0 ? 'text-ok-fg' : 'text-danger'}
            />
            {t('Demandes dont l’heure est passée')}
          </span>
          <b className={o.health.pendingOverdue === 0 ? '' : 'text-danger'}>{o.health.pendingOverdue}</b>
        </div>
      </div>
      {!cronOk && (
        <p className="p text-[1rem]">
          {t("La tâche automatique n'a pas tiqué depuis plus de deux heures : les rappels, les clôtures et l'expiration des demandes sont à l'arrêt.")}
        </p>
      )}
    </Screen>
  );
}
