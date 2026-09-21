/**
 * Administration — fiche d'un professionnel. Elle montre EXACTEMENT ce que le professionnel a sous
 * les yeux : son catalogue, son équipe, ses horaires. C'est tout l'intérêt quand il appelle en
 * disant « ma prestation n'apparaît pas » — on regarde la même chose que lui.
 *
 * La fiche ne se modifie pas ici : le catalogue, les prix et les horaires appartiennent au
 * professionnel. Pour les corriger AVEC lui, on ouvre son espace (« Ouvrir l'espace de ce
 * salon ») — chaque écriture faite ainsi part au journal, et un bandeau rappelle en permanence
 * chez qui l'on travaille.
 *
 * Ce qui relève vraiment de la plateforme est ici : geler les réservations, masquer le salon,
 * masquer un avis, annuler un rendez-vous en son nom. Chacun avec un motif.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { EyeOff, ExternalLink, LogIn, Pause, Play, X } from 'lucide-react';
import { useAdminActions, useAdminSalon } from '@salondz/api-client';
import {
  DAY_LABELS_FR,
  type BookingStatus,
  formatDA,
  formatDZPhone,
  formatDateShortDZ,
  wilayaName,
} from '@salondz/constants';
import { ErrorMessage } from '@/components/ErrorMessage';
import { SalonNotFound } from '@/pages/NotFound';
import { isNotFound } from '@/components/ErrorMessage';
import { Avatar, Badge, Button, I, Skeleton, StatusBadge, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { actionLabel } from './AdminShell';
import { ReasonSheet } from './ReasonSheet';
import { useEnterSalon } from './useEnterSalon';
import { formatDuration } from '@/lib/format';
import { t } from '@/i18n';

/** Quelle feuille de motif est ouverte, et sur quoi. */
type Geste =
  | { quoi: 'freeze' }
  | { quoi: 'hide' }
  | { quoi: 'unsuspend' }
  | { quoi: 'hideReview'; id: string }
  | { quoi: 'unhideReview'; id: string }
  | { quoi: 'cancelBooking'; id: string }
  | null;

export function AdminSalon() {
  const { id = '' } = useParams();
  const fiche = useAdminSalon(id);
  const actions = useAdminActions();
  const [geste, setGeste] = useState<Geste>(null);
  const espace = useEnterSalon();

  if (isNotFound(fiche.error)) return <SalonNotFound />;
  if (fiche.isError)
    return (
      <Screen gap={12}>
        <ErrorMessage error={fiche.error} retry={() => void fiche.refetch()} />
      </Screen>
    );
  if (fiche.isPending)
    return (
      <Screen gap={12}>
        <Skeleton className="h-[7rem] w-full !rounded-[var(--radius-card)]" />
        <Skeleton className="h-[12rem] w-full !rounded-[var(--radius-card)]" />
      </Screen>
    );

  const { salon: s, suspension, owner, ownerEmail, bookings, reviews, audit } = fiche.data;
  const suspendu = !!suspension.suspendedAt;
  const masque = suspension.suspensionLevel === 'hidden';

  const enCours =
    actions.suspendSalon.isPending ||
    actions.unsuspendSalon.isPending ||
    actions.hideReview.isPending ||
    actions.unhideReview.isPending ||
    actions.cancelBooking.isPending;
  const erreur =
    actions.suspendSalon.error ??
    actions.unsuspendSalon.error ??
    actions.hideReview.error ??
    actions.unhideReview.error ??
    actions.cancelBooking.error;
  const fermer = () => setGeste(null);
  const apres = { onSuccess: fermer };

  return (
    <Screen gap={14} width="page">
      <TopBar backTo="/admin/salons" right={t('Professionnels')} />

      <div className="crd !gap-3">
        <div className="flex items-center gap-3.5">
          <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={56} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.429rem] font-semibold tracking-[-0.4px]">{s.name}</span>
            <span className="block truncate text-[0.857rem] text-muted">
              {[s.address, s.zone ?? s.city, wilayaName(s.wilayaCode)].filter(Boolean).join(', ')}
            </span>
          </span>
          {suspendu ? (
            <Badge tone="cn">{masque ? t('Masqué') : t('Gelé')}</Badge>
          ) : (
            <Badge tone={s.isPublished ? 'ok' : 'pd'}>{s.isPublished ? t('En ligne') : t('Brouillon')}</Badge>
          )}
        </div>
        <a href={`/s/${s.slug}`} target="_blank" rel="noreferrer" className="btn g sm !justify-center">
          <I icon={ExternalLink} size={16} /> {t('Voir la page publique')}
        </a>
        <Button onClick={() => espace.enter({ id: s.id, name: s.name })} disabled={espace.pending}>
          <I icon={LogIn} size={18} /> {espace.pending ? t('Ouverture…') : t('Ouvrir l’espace de ce salon')}
        </Button>
        {espace.error && <ErrorMessage error={espace.error} />}
      </div>

      <span className="h3">{t('Décisions de la plateforme')}</span>
      <div className="crd !gap-3">
        {suspendu ? (
          <>
            <p className="p text-[1rem]">
              {masque
                ? t('Ce salon est masqué : il n’apparaît plus dans la recherche et sa page ne s’ouvre plus. Les rendez-vous déjà pris tiennent.')
                : t('Les réservations de ce salon sont gelées : sa page reste en ligne, mais plus personne ne peut réserver. Les rendez-vous déjà pris tiennent.')}
            </p>
            {suspension.suspendedReason && (
              <p className="sf !py-2 text-[0.857rem]">
                {t('Motif :')} {suspension.suspendedReason}
              </p>
            )}
            <Button variant="g" onClick={() => setGeste({ quoi: 'unsuspend' })}>
              <I icon={Play} size={16} /> {t('Lever la suspension')}
            </Button>
          </>
        ) : (
          <>
            <p className="p text-[1rem]">
              {t('Geler arrête les nouvelles réservations en laissant la page en ligne. Masquer retire le salon de la place de marché. Dans les deux cas, les rendez-vous déjà pris tiennent.')}
            </p>
            <Button variant="g" onClick={() => setGeste({ quoi: 'freeze' })}>
              <I icon={Pause} size={16} /> {t('Geler les réservations')}
            </Button>
            <Button variant="d" onClick={() => setGeste({ quoi: 'hide' })}>
              <I icon={EyeOff} size={16} /> {t('Masquer le salon')}
            </Button>
          </>
        )}
      </div>

      <span className="h3">{t('Le propriétaire')}</span>
      <div className="crd !gap-0 !py-1">
        <div className="li">
          <span>{t('Nom')}</span>
          <b>{owner?.fullName ?? '—'}</b>
        </div>
        <div className="li">
          <span>{t('Téléphone')}</span>
          <b className="mono" dir="ltr">{owner?.phone ? formatDZPhone(owner.phone) : '—'}</b>
        </div>
        <div className="li">
          <span>{t('Adresse e-mail')}</span>
          <b className="truncate">{ownerEmail ?? '—'}</b>
        </div>
        <div className="li">
          <span>{t('Inscrit le')}</span>
          <b>{owner ? formatDateShortDZ(owner.createdAt) : '—'}</b>
        </div>
        {owner && (
          <Link to={`/admin/comptes/${owner.id}`} className="li">
            <span>{t('Voir son compte')}</span>
            <I icon={ExternalLink} size={16} className="text-disabled" />
          </Link>
        )}
      </div>

      <span className="h3">{t('Catalogue')} · {s.services.length}</span>
      <div className="crd !gap-0 !py-1">
        {s.services.length === 0 && <div className="li"><span className="p">{t('Aucune prestation.')}</span></div>}
        {s.services.map((sv) => (
          <div key={sv.id} className="li">
            <span className="min-w-0">
              <span className="block truncate text-[1rem] font-semibold">{sv.name}</span>
              <span className="block text-[0.857rem] text-muted" dir="ltr">
                {formatDA(sv.priceDa)} · {formatDuration(sv.durationMinutes)}
              </span>
            </span>
            {!sv.isActive && <Badge tone="cn">{t('Inactive')}</Badge>}
          </div>
        ))}
      </div>

      <span className="h3">{t('Équipe')} · {s.staff.length}</span>
      <div className="crd !gap-0 !py-1">
        {s.staff.map((m) => (
          <div key={m.id} className="li">
            <span className="flex min-w-0 items-center gap-3">
              <Avatar src={m.avatarUrl} name={m.displayName} size={36} />
              <span className="truncate text-[1rem]">{m.displayName}</span>
            </span>
            {!m.isActive && <Badge tone="cn">{t('Inactif')}</Badge>}
          </div>
        ))}
      </div>

      <span className="h3">{t("Horaires d'ouverture")}</span>
      <div className="crd !gap-0 !py-1">
        {s.openingHours.map((h) => (
          <div key={h.id} className="li">
            <span>{t(DAY_LABELS_FR[h.dayOfWeek])}</span>
            <b dir="ltr">{h.isClosed ? t('Fermé') : `${h.opensAt} – ${h.closesAt}`}</b>
          </div>
        ))}
      </div>

      <span className="h3">{t('Derniers rendez-vous')}</span>
      <div className="crd !gap-0 !py-1">
        {bookings.length === 0 && <div className="li"><span className="p">{t('Aucun rendez-vous.')}</span></div>}
        {bookings.map((b) => (
          <div key={b.id} className="li">
            <span className="min-w-0">
              <span className="block truncate text-[1rem]">
                <b>{b.clientName}</b> <span className="text-muted">· {b.serviceName}</span>
              </span>
              <span className="block text-[0.857rem] text-muted" dir="ltr">
                {formatDateShortDZ(b.startsAt)} · {formatDA(b.priceDa)}
              </span>
            </span>
            {(b.status === 'pending' || b.status === 'confirmed') && (
              <Button
                variant="g"
                sm
                auto
                onClick={() => setGeste({ quoi: 'cancelBooking', id: b.id })}
                aria-label={t('Annuler ce rendez-vous au nom de la plateforme')}
              >
                <I icon={X} size={14} />
              </Button>
            )}
            <StatusBadge status={b.status as BookingStatus} />
          </div>
        ))}
      </div>

      <span className="h3">{t('Avis')} · {s.ratingCount}</span>
      <div className="crd !gap-0 !py-1">
        {reviews.length === 0 && <div className="li"><span className="p">{t('Aucun avis.')}</span></div>}
        {reviews.map((r) => (
          <div key={r.id} className="li !items-start">
            <span className="min-w-0">
              <span className="block text-[1rem] font-semibold">
                {'★'.repeat(r.rating)}
                <span className="text-disabled">{'★'.repeat(5 - r.rating)}</span>
              </span>
              {r.comment && <span className="block text-[0.857rem] text-muted">{r.comment}</span>}
              {r.reply && <span className="block text-[0.857rem] text-muted">↳ {r.reply}</span>}
              {r.hiddenReason && (
                <span className="block text-[0.857rem] text-muted">
                  {t('Masqué')} · {r.hiddenReason}
                </span>
              )}
            </span>
            <span className="flex flex-none items-center gap-2">
              <span className="text-[0.857rem] text-muted">{formatDateShortDZ(r.createdAt)}</span>
              <Button
                variant="g"
                sm
                auto
                onClick={() =>
                  setGeste(r.hiddenAt ? { quoi: 'unhideReview', id: r.id } : { quoi: 'hideReview', id: r.id })
                }
              >
                {r.hiddenAt ? t('Rétablir') : t('Masquer')}
              </Button>
            </span>
          </div>
        ))}
      </div>

      <span className="h3">{t('Journal')}</span>
      <div className="crd !gap-0 !py-1">
        {audit.length === 0 && <div className="li"><span className="p">{t('Aucune action enregistrée.')}</span></div>}
        {audit.map((a) => (
          <div key={a.id} className="li">
            <span className="min-w-0 truncate text-[1rem]">
              {actionLabel(a.action)}
              {a.reason ? ` · ${a.reason}` : ''}
            </span>
            <span className="flex-none text-[0.857rem] text-muted">{formatDateShortDZ(a.createdAt)}</span>
          </div>
        ))}
      </div>

      <p className="p text-[0.857rem]">
        {t('Le catalogue, les prix et les horaires appartiennent au professionnel : pour les corriger, ouvrez son espace plutôt que de décider à sa place.')}
      </p>

      {geste?.quoi === 'freeze' && (
        <ReasonSheet
          title={t('Geler les réservations')}
          description={t('La page du salon reste en ligne et ses clients le retrouvent, mais personne ne peut plus réserver. Les rendez-vous déjà pris tiennent.')}
          confirmLabel={t('Geler les réservations')}
          pending={enCours}
          error={erreur}
          onClose={fermer}
          onConfirm={(reason) => actions.suspendSalon.mutate({ id, level: 'frozen', reason }, apres)}
        />
      )}
      {geste?.quoi === 'hide' && (
        <ReasonSheet
          title={t('Masquer le salon')}
          description={t('Le salon disparaît de la recherche et des listes, et sa page ne s’ouvre plus. Son propriétaire continue de voir son espace, et les rendez-vous déjà pris tiennent.')}
          confirmLabel={t('Masquer le salon')}
          danger
          pending={enCours}
          error={erreur}
          onClose={fermer}
          onConfirm={(reason) => actions.suspendSalon.mutate({ id, level: 'hidden', reason }, apres)}
        />
      )}
      {geste?.quoi === 'unsuspend' && (
        <ReasonSheet
          title={t('Lever la suspension')}
          description={t('Le salon redevient réservable, et visible s’il était masqué.')}
          confirmLabel={t('Lever la suspension')}
          optional
          pending={enCours}
          error={erreur}
          onClose={fermer}
          onConfirm={(reason) => actions.unsuspendSalon.mutate({ id, reason: reason || undefined }, apres)}
        />
      )}
      {geste?.quoi === 'hideReview' && (
        <ReasonSheet
          title={t('Masquer cet avis')}
          description={t('Il quitte la page publique et le calcul de la note. Il n’est pas supprimé : une décision doit pouvoir s’expliquer plus tard.')}
          confirmLabel={t('Masquer l’avis')}
          danger
          pending={enCours}
          error={erreur}
          onClose={fermer}
          onConfirm={(reason) => actions.hideReview.mutate({ id: geste.id, reason }, apres)}
        />
      )}
      {geste?.quoi === 'unhideReview' && (
        <ReasonSheet
          title={t('Rétablir cet avis')}
          description={t('Il revient sur la page publique et recompte dans la note.')}
          confirmLabel={t('Rétablir l’avis')}
          optional
          pending={enCours}
          error={erreur}
          onClose={fermer}
          onConfirm={(reason) => actions.unhideReview.mutate({ id: geste.id, reason: reason || undefined }, apres)}
        />
      )}
      {geste?.quoi === 'cancelBooking' && (
        <ReasonSheet
          title={t('Annuler au nom de la plateforme')}
          description={t('Le client et le salon sont prévenus, et le créneau repart en liste d’attente. Ni l’un ni l’autre n’en portera la responsabilité.')}
          confirmLabel={t('Annuler le rendez-vous')}
          danger
          pending={enCours}
          error={erreur}
          onClose={fermer}
          onConfirm={(reason) => actions.cancelBooking.mutate({ id: geste.id, reason }, apres)}
        />
      )}
    </Screen>
  );
}
