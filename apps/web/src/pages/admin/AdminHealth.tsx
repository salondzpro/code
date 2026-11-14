/**
 * SANTÉ DE LA PLATEFORME (14 nov. 2026) — `GET /admin/health`.
 *
 * Répondre en dix secondes à « est-ce que tout tourne ? » : la base et le site (avec leur temps de
 * réponse), les services branchés (e-mails, notifications Android / iPhone / navigateur, IA), la
 * livraison des notifications sur 24 h, et ce qui attend quelqu'un (demandes de plus d'un jour,
 * signalements ouverts). Rafraîchi toutes les minutes. Un service « non branché » n'est pas une
 * panne : c'est une variable absente sur le serveur, la fonction correspondante est simplement coupée.
 */
import { Link } from 'react-router';
import { CheckCircle2, CircleAlert, CircleDashed } from 'lucide-react';
import { useAdminHealth } from '@salondz/api-client';
import { formatTimeDZ } from '@salondz/constants';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { I, PageHead, Skeleton } from '@/components/ui';
import { t } from '@/i18n';

const SERVICES: Record<string, { titre: string; sens: string }> = {
  db: { titre: 'Base de données', sens: 'Comptes, salons, rendez-vous' },
  site: { titre: 'Site salondz.com', sens: 'Page publique et application' },
  email: { titre: 'E-mails', sens: 'Confirmation, lien de connexion, mot de passe' },
  fcm: { titre: 'Notifications Android', sens: 'Application sur Android' },
  apns: { titre: 'Notifications iPhone', sens: 'Application sur iPhone' },
  webpush: { titre: 'Notifications navigateur', sens: 'Site ouvert sur ordinateur' },
  ia: { titre: 'Synthèse des avis (IA)', sens: 'Phrase résumée sur les pages de salon' },
};

function duree(s: number) {
  const j = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return j ? `${j} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

export function AdminHealth() {
  const q = useAdminHealth();
  if (q.isError) return <Screen gap={12}><ErrorMessage error={q.error} retry={() => void q.refetch()} /></Screen>;
  if (q.isPending)
    return (
      <Screen gap={12} width="page">
        <Skeleton className="h-[4rem] w-full !rounded-[var(--radius-card)]" />
        <Skeleton className="h-[16rem] w-full !rounded-[var(--radius-card)]" />
      </Screen>
    );
  const h = q.data;
  const pannes = h.services.filter((s) => (s.key === 'db' || s.key === 'site') && !s.ok).length;
  const p = h.push;
  const total = p.sent + p.no_device + p.opted_out + p.failed + p.waiting;
  const taux = total ? Math.round((p.failed / total) * 100) : 0;

  return (
    <Screen gap={16} width="page">
      <PageHead
        title={t('Santé de la plateforme')}
        sub={`${t('Vérifié à')} ${formatTimeDZ(h.checkedAt)} · ${t('serveur en ligne depuis')} ${duree(h.uptimeS)}`}
      />

      <div className={`ad-etat ${pannes ? 'ko' : 'ok'}`} role="status">
        <I icon={pannes ? CircleAlert : CheckCircle2} size={22} />
        <span>{pannes ? t('Un service essentiel ne répond pas.') : t('Tout fonctionne.')}</span>
      </div>

      <span className="h3">{t('Services')}</span>
      <div className="lst">
        {h.services.map((s) => {
          const def = SERVICES[s.key];
          return (
            <div key={s.key} className="lst-r">
              <span className={`ad-pt ${s.ok ? 'ok' : s.key === 'db' || s.key === 'site' ? 'ko' : 'off'}`} aria-hidden>
                <I icon={s.ok ? CheckCircle2 : s.key === 'db' || s.key === 'site' ? CircleAlert : CircleDashed} size={18} />
              </span>
              <span className="lst-t">
                {t(def?.titre ?? s.key)}
                <small>{t(def?.sens ?? '')}</small>
              </span>
              <span className="ad-val" dir="ltr">
                {s.ms != null ? `${s.ms} ms` : s.ok ? t('Branché') : t('Non branché')}
              </span>
            </div>
          );
        })}
      </div>

      <span className="h3">{t('Notifications · 24 heures')}</span>
      <div className="gr four grid grid-cols-2 gap-1.5">
        <div className="ad-kpi">
          <b>{p.sent}</b>
          <span>{t('livrées')}</span>
        </div>
        <div className="ad-kpi">
          <b>{p.no_device}</b>
          <span>{t('sans appareil')}</span>
        </div>
        <div className={`ad-kpi ${p.failed ? 'alerte' : ''}`}>
          <b>{p.failed}</b>
          <span>{t('en échec')} {total ? `· ${taux} %` : ''}</span>
        </div>
        <div className="ad-kpi">
          <b>{p.waiting}</b>
          <span>{t('en attente d’envoi')}</span>
        </div>
      </div>

      <span className="h3">{t('Activité · 24 heures')}</span>
      <div className="lst">
        <Link to="/admin/rendez-vous" className="lst-r">
          <span className="lst-t">{t('Rendez-vous pris')}</span>
          <span className="ad-val">{h.activity.bookings24}</span>
        </Link>
        <Link to="/admin/comptes" className="lst-r">
          <span className="lst-t">{t('Nouveaux comptes')}</span>
          <span className="ad-val">{h.activity.signups24}</span>
        </Link>
        <Link to="/admin/rendez-vous" className="lst-r">
          <span className="lst-t">
            {t('Demandes à valider')}
            <small>{t('Dont plus d’un jour sans réponse du salon')} : {h.activity.pendingOld}</small>
          </span>
          <span className={`ad-val ${h.activity.pendingOld ? 'alerte' : ''}`}>{h.activity.pendingAll}</span>
        </Link>
        <Link to="/admin/signalements" className="lst-r">
          <span className="lst-t">{t('Signalements ouverts')}</span>
          <span className={`ad-val ${h.activity.openReports ? 'alerte' : ''}`}>{h.activity.openReports}</span>
        </Link>
      </div>
    </Screen>
  );
}
