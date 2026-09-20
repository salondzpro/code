/**
 * Administration — fiche d'un professionnel. Elle montre EXACTEMENT ce que le professionnel a sous
 * les yeux : son catalogue, son équipe, ses horaires. C'est tout l'intérêt quand il appelle en
 * disant « ma prestation n'apparaît pas » — on regarde la même chose que lui.
 *
 * En lecture seule, et pas par prudence : modifier le catalogue ou les horaires d'un salon, c'est
 * prendre la responsabilité de son agenda. En cas d'erreur, on l'appelle. Le lot 2 n'ajoutera que
 * ce qui relève vraiment de la plateforme — suspendre, et rien d'autre.
 */
import { Link, useParams } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { useAdminSalon } from '@salondz/api-client';
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
import { Avatar, Badge, I, Skeleton, StatusBadge, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { formatDuration } from '@/lib/format';
import { t } from '@/i18n';

export function AdminSalon() {
  const { id = '' } = useParams();
  const fiche = useAdminSalon(id);

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

  const { salon: s, owner, ownerEmail, bookings, reviews, audit } = fiche.data;

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
          <Badge tone={s.isPublished ? 'ok' : 'pd'}>{s.isPublished ? t('En ligne') : t('Brouillon')}</Badge>
        </div>
        <a href={`/s/${s.slug}`} target="_blank" rel="noreferrer" className="btn g sm !justify-center">
          <I icon={ExternalLink} size={16} /> {t('Voir la page publique')}
        </a>
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
            </span>
            <span className="flex-none text-[0.857rem] text-muted">{formatDateShortDZ(r.createdAt)}</span>
          </div>
        ))}
      </div>

      <span className="h3">{t('Journal')}</span>
      <div className="crd !gap-0 !py-1">
        {audit.length === 0 && <div className="li"><span className="p">{t('Aucune action enregistrée.')}</span></div>}
        {audit.map((a) => (
          <div key={a.id} className="li">
            <span className="min-w-0 truncate text-[1rem]">{a.action}{a.reason ? ` · ${a.reason}` : ''}</span>
            <span className="flex-none text-[0.857rem] text-muted">{formatDateShortDZ(a.createdAt)}</span>
          </div>
        ))}
      </div>

      <p className="p text-[0.857rem]">
        {t("Cette fiche est en lecture seule : le catalogue, les prix et les horaires appartiennent au professionnel. En cas d'erreur, on l'appelle.")}
      </p>
    </Screen>
  );
}
