/**
 * Deux compléments des avis (28 oct. 2026) :
 *
 *   - `ReviewService` : la PRESTATION notée, en lien discret sous l'avis. On lit « Pose gel » et
 *     l'on réserve cette prestation-là d'un geste (`/s/:slug/prestations?service=`). Une prestation
 *     retirée du catalogue reste nommée, sans lien.
 *   - `ReviewSummary` : la synthèse des avis par IA, une ligne. Elle n'est DEMANDÉE qu'à partir de
 *     `REVIEW_SUMMARY_MIN_REVIEWS` avis (le serveur applique le même seuil sur les avis commentés) ;
 *     tant qu'elle n'existe pas, rien ne s'affiche — pas de squelette pour une ligne facultative.
 */
import { Link } from 'react-router';
import { ChevronRight, Sparkles, Tag } from 'lucide-react';
import { useReviewSummary } from '@salondz/api-client';
import { REVIEW_SUMMARY_MIN_REVIEWS } from '@salondz/constants';
import type { SalonPublic } from '@salondz/types';
import { I } from './ui';
import { t, useLocale } from '@/i18n';

export function ReviewService({
  salon,
  serviceId,
  serviceName,
}: {
  salon: Pick<SalonPublic, 'slug' | 'services'>;
  serviceId: string | null;
  serviceName: string | null;
}) {
  if (!serviceName) return null;
  const bookable = !!serviceId && salon.services.some((sv) => sv.id === serviceId);
  const inner = (
    <>
      <I icon={Tag} size={13} className="shrink-0" />
      <span className="truncate">{serviceName}</span>
      {bookable && <I icon={ChevronRight} size={13} className="shrink-0 rtl:-scale-x-100" />}
    </>
  );
  const cls =
    'inline-flex max-w-full items-center gap-1 self-start text-[0.857rem] font-medium text-muted';
  return bookable ? (
    <Link
      to={`/s/${salon.slug}/prestations?service=${serviceId}`}
      className={`${cls} hover:text-text hover:underline`}
      aria-label={t('Réserver {service}', { service: serviceName })}
    >
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

export function ReviewSummary({ salon }: { salon: Pick<SalonPublic, 'id' | 'ratingCount'> }) {
  const [locale] = useLocale();
  const q = useReviewSummary(salon.id, locale, salon.ratingCount >= REVIEW_SUMMARY_MIN_REVIEWS);
  const summary = q.data?.summary;
  if (!summary) return null;
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-card)] bg-fill px-3 py-2.5">
      <I icon={Sparkles} size={16} className="mt-0.5 shrink-0 text-muted" />
      <p className="min-w-0 text-[1rem] leading-[1.4]">
        {summary}
        <span className="ms-1.5 whitespace-nowrap text-[0.786rem] text-muted">
          {t('· Résumé IA des avis')}
        </span>
      </p>
    </div>
  );
}
