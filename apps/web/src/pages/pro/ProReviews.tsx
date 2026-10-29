/**
 * Espace pro — Avis : les lire, et y répondre publiquement.
 *
 * Un avis engage la réputation du salon, et le professionnel n'avait aucun endroit pour le lire
 * ni y répondre : il devait ouvrir sa propre page publique. Une réponse posée vaut mieux qu'un
 * avis laissé seul, et c'est aussi ce que lisent les futurs clients.
 *
 * L'écran met en avant ce qui ATTEND : les avis sans réponse d'abord, comptés en haut. Le
 * professionnel répond ; il ne corrige ni la note ni le texte, qui ne lui sont pas modifiables —
 * l'écran ne propose donc rien de tel.
 */
import { useState } from 'react';
import { MessageSquareQuote, Star } from 'lucide-react';
import {
  pagesItems,
  useProReviewsInfinite,
  useProReviewMutations,
  useProReviewsUnanswered,
  useProSalon,
  type ProReviewItem,
} from '@salondz/api-client';
import { formatDateShortDZ } from '@salondz/constants';
import { LoadMore } from '@/components/LoadMore';
import { errorText } from '@/components/ErrorMessage';
import { ErrorMessage } from '@/components/ErrorMessage';
import { BottomSheet, Button, Dim, I, Pill, Skeleton, Textarea, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ReportReviewButton } from '@/components/ReportReview';
import { ReviewSummary } from '@/components/ReviewExtras';
import { PageLoading } from '@/components/PageLoading';
import { t } from '@/i18n';

const MAX = 600;

/** Feuille de réponse : un seul texte, qu'on écrit, corrige, ou efface. */
function ReplySheet({
  review,
  onClose,
}: {
  review: ProReviewItem;
  onClose: () => void;
}) {
  const [texte, setTexte] = useState(review.reply ?? '');
  const [error, setError] = useState<string | null>(null);
  const { reply } = useProReviewMutations();
  const envoyer = async () => {
    setError(null);
    try {
      await reply.mutateAsync({ id: review.id, reply: texte.trim() });
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <>
      <Dim onClose={onClose} className="!z-[45]" />
      <BottomSheet modal className="!z-50">
        <div className="h2 text-center !text-[1.143rem]">
          {review.reply ? t('Modifier la réponse') : t('Répondre à cet avis')}
        </div>
        <p className="p text-[1rem]">
          {t("Votre réponse est publique : elle s'affiche sous l'avis, sur votre page.")}
        </p>
        <Textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value.slice(0, MAX))}
          maxLength={MAX}
          aria-label={t('Réponse du salon')}
          placeholder={t('Merci pour votre retour. Nous avons…')}
          autoFocus
        />
        <span className="text-[0.857rem] text-muted">
          {t('{n} caractères sur {max}', { n: texte.trim().length, max: MAX })}
        </span>
        {error && (
          <p className="text-[1rem] text-danger" role="alert">
            {error}
          </p>
        )}
        <Button onClick={() => void envoyer()} loading={reply.isPending}>
          {review.reply && !texte.trim()
            ? t('Retirer ma réponse')
            : review.reply
              ? t('Enregistrer')
              : t('Publier ma réponse')}
        </Button>
      </BottomSheet>
    </>
  );
}

export function ProReviews() {
  const salon = useProSalon().data?.salon ?? null;
  const [onlyWaiting, setOnlyWaiting] = useState(false);
  const [open, setOpen] = useState<ProReviewItem | null>(null);
  const reviews = useProReviewsInfinite(onlyWaiting, !!salon);
  const items = pagesItems(reviews.data);
  // Compteur dédié : charger tous les avis pour compter ceux sans réponse serait du gaspillage.
  const waiting = useProReviewsUnanswered(!!salon).data?.count ?? 0;

  if (!salon) return <PageLoading />;

  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <TopBar backTo="/pro/profil" right={t('Profil')} />
      <h1 className="h1">{t('Avis')}</h1>

      {/* Vue d'ensemble (28 oct. 2026) : la note, et la part d'avis qui ont une réponse — c'est
          le chiffre que le professionnel peut faire bouger, et que lisent les futurs clients. */}
      {salon.ratingCount > 0 && (
        <div className="crd !gap-3">
          <div className="flex items-center gap-3.5">
            <span className="text-[2.286rem] font-semibold leading-none tracking-[-1px]" dir="ltr">
              {salon.ratingAvg.toFixed(1)}
            </span>
            <span className="min-w-0">
              <span className="block text-[1.143rem] font-semibold" aria-hidden>
                {'★'.repeat(Math.round(salon.ratingAvg))}
                <span className="text-disabled">{'★'.repeat(5 - Math.round(salon.ratingAvg))}</span>
              </span>
              <span className="block text-[0.857rem] text-muted">{t('{n} avis', { n: salon.ratingCount })}</span>
            </span>
          </div>
          {(() => {
            const answered = Math.max(0, salon.ratingCount - waiting);
            const pct = Math.round((answered / salon.ratingCount) * 100);
            return (
              <div className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-3 text-[0.857rem]">
                  <span className="font-semibold">{t('Avis avec une réponse')}</span>
                  <span className="text-muted" dir="ltr">{pct} %</span>
                </span>
                <span className="rv-gauge !flex-none" aria-hidden>
                  <span style={{ width: `${Math.max(2, pct)}%` }} />
                </span>
              </div>
            );
          })()}
          <ReviewSummary salon={salon} />
        </div>
      )}

      {waiting > 0 && (
        <div className="pills bleed" role="group" aria-label={t('Filtrer les avis')}>
          <Pill on={!onlyWaiting} onClick={() => setOnlyWaiting(false)}>
            {t('Tous')}
          </Pill>
          <Pill on={onlyWaiting} onClick={() => setOnlyWaiting(true)}>
            {t('Sans réponse · {n}', { n: waiting })}
          </Pill>
        </div>
      )}

      {reviews.isError ? (
        <ErrorMessage error={reviews.error} retry={() => void reviews.refetch()} />
      ) : reviews.isPending ? (
        <>
          <Skeleton className="h-[8rem] w-full !rounded-[var(--radius-card)]" />
          <Skeleton className="h-[8rem] w-full !rounded-[var(--radius-card)]" />
        </>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 pt-8 text-center">
          <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-fill text-muted">
            <I icon={Star} size={30} />
          </span>
          <div className="text-[1.143rem] font-semibold">
            {onlyWaiting ? t('Tous vos avis ont une réponse') : t('Aucun avis pour le moment')}
          </div>
          <p className="p">
            {onlyWaiting
              ? t('Rien n’attend de vous ici.')
              : t('Vos clients pourront noter leur rendez-vous une fois la prestation terminée.')}
          </p>
        </div>
      ) : (
        items.map((r) => (
          <div key={r.id} className="crd !gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[1.143rem] font-semibold" aria-label={t('{n} sur 5', { n: r.rating })}>
                {'★'.repeat(r.rating)}
                <span className="text-disabled">{'★'.repeat(5 - r.rating)}</span>
              </span>
              <span className="text-[0.857rem] text-muted">{formatDateShortDZ(r.createdAt)}</span>
            </div>
            <span className="text-[1rem]">
              <b>{r.authorName}</b>
              {r.serviceName && <span className="text-muted"> · {r.serviceName}</span>}
            </span>
            {r.comment && <p className="p text-[1rem]">{r.comment}</p>}
            {/* Un avis mensonger fait d'abord du tort au professionnel : c'est lui qui le voit en premier. */}
            <ReportReviewButton reviewId={r.id} />

            {r.reply ? (
              <div className="sf !py-2.5">
                <span className="block text-[0.857rem] font-semibold text-muted">
                  {t('Votre réponse')}
                </span>
                <p className="text-[1rem]">{r.reply}</p>
                <button
                  type="button"
                  className="mt-1.5 text-[1rem] font-semibold underline"
                  onClick={() => setOpen(r)}
                >
                  {t('Modifier')}
                </button>
              </div>
            ) : (
              <Button variant="g" className="!justify-center" onClick={() => setOpen(r)}>
                <I icon={MessageSquareQuote} size={18} /> {t('Répondre')}
              </Button>
            )}
          </div>
        ))
      )}

      <LoadMore
        hasMore={reviews.hasNextPage}
        loading={reviews.isFetchingNextPage}
        onMore={() => void reviews.fetchNextPage()}
        label={t("Voir plus d'avis")}
      />

      {open && <ReplySheet review={open} onClose={() => setOpen(null)} />}
    </Screen>
  );
}
