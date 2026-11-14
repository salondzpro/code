/**
 * ÉQUIPE DE LA PLATEFORME (14 nov. 2026) — niveau `owner` seulement (le serveur le vérifie).
 *
 * Qui a accès à l'administration, à quel niveau, et quand il s'est connecté pour la dernière fois.
 * Nommer : l'adresse d'un compte EXISTANT, un niveau, un motif. Retirer : un motif ; l'accès est
 * coupé à la requête suivante (jetons de pilotage compris). On ne se retire pas soi-même, et rien ne
 * se supprime : la ligne reste pour expliquer le journal. Tout passe au journal.
 */
import { useState } from 'react';
import { Navigate } from 'react-router';
import { ShieldCheck, UserMinus } from 'lucide-react';
import { useAdminMe, useAdminMembers, useAdminTeamMutations, type AdminMember } from '@salondz/api-client';
import { formatDateShortDZ } from '@salondz/constants';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button, Field, I, Input, PageHead, Skeleton } from '@/components/ui';
import { ICONE } from '@/lib/actionIcons';
import { ReasonSheet } from './ReasonSheet';
import { t } from '@/i18n';

export function AdminTeam() {
  const me = useAdminMe();
  const owner = me.data?.level === 'owner';
  const q = useAdminMembers(owner);
  const { grant, revoke } = useAdminTeamMutations();
  const [nommer, setNommer] = useState(false);
  const [email, setEmail] = useState('');
  const [niveau, setNiveau] = useState<'support' | 'owner'>('support');
  const [retirer, setRetirer] = useState<AdminMember | null>(null);

  if (me.data && !owner) return <Navigate to="/admin" replace />;

  const actifs = (q.data?.items ?? []).filter((m) => !m.disabledAt);
  const retires = (q.data?.items ?? []).filter((m) => m.disabledAt);

  return (
    <Screen gap={16} width="page">
      <PageHead
        title={t('Équipe de la plateforme')}
        sub={t('Qui peut entrer dans l’administration. Support : voir et modérer. Propriétaire : tout, y compris cette page.')}
      />
      <div>
        <Button icon={ICONE.ajouter} sm className="!w-auto" onClick={() => setNommer(true)}>
          {t('Nommer un administrateur')}
        </Button>
      </div>
      {q.isError && <ErrorMessage error={q.error} retry={() => void q.refetch()} />}
      {q.isPending && <Skeleton className="h-[10rem] w-full !rounded-[var(--radius-card)]" />}

      {actifs.length > 0 && (
        <div className="lst">
          {actifs.map((m) => (
            <div key={m.id} className="lst-r">
              <span className="ad-av" aria-hidden>
                {(m.fullName ?? m.email ?? '?').charAt(0).toUpperCase()}
              </span>
              <span className="lst-t">
                {m.fullName ?? m.email ?? m.id}
                {m.me ? ` · ${t('vous')}` : ''}
                <small>
                  {[m.email, m.lastSignInAt ? `${t('dernière connexion')} ${formatDateShortDZ(m.lastSignInAt)}` : null].filter(Boolean).join(' · ')}
                </small>
              </span>
              <span className={`ad-niv ${m.level === 'owner' ? 'ink' : ''}`}>{m.level === 'owner' ? t('Propriétaire') : t('Support')}</span>
              {!m.me && (
                <button type="button" className="ad-ic" aria-label={t('Retirer l’accès')} onClick={() => setRetirer(m)}>
                  <I icon={UserMinus} size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {retires.length > 0 && (
        <>
          <span className="h3">{t('Accès retirés')}</span>
          <div className="lst">
            {retires.map((m) => (
              <div key={m.id} className="lst-r ad-off">
                <span className="lst-t">
                  {m.fullName ?? m.email ?? m.id}
                  <small>
                    {m.email} · {t('retiré le')} {formatDateShortDZ(m.disabledAt!)}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {nommer && (
        <ReasonSheet
          title={t('Nommer un administrateur')}
          description={t('La personne doit déjà avoir un compte Salon DZ. Elle aura accès dès sa prochaine page.')}
          confirmLabel={t('Nommer')}
          pending={grant.isPending}
          error={grant.error}
          extra={
            <div className="flex flex-col gap-3">
              <Field label={t('Adresse e-mail du compte')} htmlFor="ad-team-mail">
                <Input id="ad-team-mail" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@exemple.com" />
              </Field>
              <div className="seg" role="radiogroup" aria-label={t('Niveau')}>
                {(['support', 'owner'] as const).map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={niveau === n} className={niveau === n ? 'on' : ''} onClick={() => setNiveau(n)}>
                    <I icon={ShieldCheck} size={15} /> {n === 'owner' ? t('Propriétaire') : t('Support')}
                  </button>
                ))}
              </div>
            </div>
          }
          onConfirm={(reason) =>
            grant.mutate(
              { email: email.trim(), level: niveau, reason },
              {
                onSuccess: () => {
                  setNommer(false);
                  setEmail('');
                },
              },
            )
          }
          onClose={() => setNommer(false)}
        />
      )}
      {retirer && (
        <ReasonSheet
          title={t('Retirer l’accès')}
          description={`${retirer.fullName ?? retirer.email ?? ''} ${t('ne pourra plus entrer dans l’administration, dès sa prochaine requête.')}`}
          danger
          confirmLabel={t('Retirer l’accès')}
          pending={revoke.isPending}
          error={revoke.error}
          onConfirm={(reason) => revoke.mutate({ id: retirer.id, reason }, { onSuccess: () => setRetirer(null) })}
          onClose={() => setRetirer(null)}
        />
      )}
    </Screen>
  );
}
