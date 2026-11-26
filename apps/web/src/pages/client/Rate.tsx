/** C-F 20 — Noter la prestation : étoiles, « Ce qui vous a plu », commentaire, publication sous prénom + initiale. */
import { ICONE } from '@/lib/actionIcons';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Star } from 'lucide-react';
import { useBooking, useCreateReview, useMe } from '@salondz/api-client';
import { formatDA, formatLocale } from '@salondz/constants';
import { Avatar, BottomSheet, Button, Field, Pill, SectionLabel, Textarea, TopBar } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { PageLoading } from '@/components/PageLoading';
import { t } from '@/i18n';

const TAGS = ['Ponctualité', 'Hygiène', 'Accueil', 'Résultat', 'Rapport qualité-prix'];

function dayMonth(iso: string): string {
  return new Intl.DateTimeFormat(formatLocale(), { day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

export function Rate() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const booking = useBooking(id);
  const me = useMe();
  const review = useCreateReview();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  // AVIS PRIS EN COMPTE (26 nov. 2026, demande du propriétaire) : coche animée + étoiles, puis retour
  // tout seul aux rendez-vous passés. Affiché AVANT le garde « déjà noté », que l'envoi rend vrai.
  const [envoye, setEnvoye] = useState(false);
  useEffect(() => {
    if (!envoye) return;
    try {
      navigator.vibrate?.([18, 60, 18]);
    } catch {
      /* pas de vibreur */
    }
    const id = window.setTimeout(() => navigate('/rendez-vous?scope=past', { replace: true }), 2400);
    return () => window.clearTimeout(id);
  }, [envoye, navigate]);

  if (envoye)
    return (
      <Screen gap={16}>
        <div className="cf ok rv-merci" role="status">
          <span className="cf-badge" aria-hidden>
            <i className="cf-wave" />
            <i className="cf-wave w2" />
            <svg viewBox="0 0 24 24" width="30" height="30">
              <path className="cf-draw" d="M5 12.5l4.2 4.2L19 7" pathLength={24} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1 className="cf-t">{t('Merci pour votre avis')}</h1>
          <span className="rv-etoiles" aria-label={t('{n} sur 5', { n: rating })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={22} strokeWidth={1.6} className={n <= rating ? 'text-ink' : 'text-disabled'} fill={n <= rating ? 'currentColor' : 'none'} style={{ animationDelay: `${0.5 + n * 0.08}s` }} />
            ))}
          </span>
        </div>
      </Screen>
    );


  if (booking.isPending) return <PageLoading />;
  if (booking.isError) return <ErrorMessage error={booking.error} retry={() => booking.refetch()} />;
  const b = booking.data;
  // Un seul avis par rendez-vous, et seulement après un rendez-vous terminé (règle API BOOKING_NOT_COMPLETED / ALREADY_REVIEWED).
  if (b.reviewRating != null || b.status !== 'completed') return <Navigate to="/rendez-vous?scope=past" replace />;
  const name = me.data?.profile.fullName ?? '';
  const initials = name ? `${name.split(' ')[0]} ${(name.split(' ')[1] ?? '').charAt(0)}${name.split(' ')[1] ? '.' : ''}`.trim() : 'vous';

  const send = async () => {
    const text = [tags.length ? tags.join(' · ') : '', comment.trim()].filter(Boolean).join(' — ');
    try {
      await review.mutateAsync({ bookingId: b.id, rating, comment: text || undefined });
      setEnvoye(true);
    } catch {
      /* affiché par `review.error` sous le formulaire */
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar
        backTo="/rendez-vous?scope=past"
        title={
          <>
            {t("Comment s'est passée")} {t("votre visite ?")}
          </>
        }
        right={
          <button type="button" className="text-[0.857rem] text-muted" onClick={() => navigate('/rendez-vous?scope=past')}>
            {t("Passer")}
          </button>
        }
      />
      <div className="crd !flex-row items-center gap-3.5">
        <Avatar src={b.salon.coverUrl} name={b.salon.name} size={88} />
        <span className="min-w-0">
          <span className="block text-[1.143rem] font-semibold tracking-[-0.4px]">{b.salon.name}</span>
          <span className="block text-[0.857rem] text-muted">
            {dayMonth(b.startsAt)} · {b.serviceName} · {formatDA(b.priceDa)}
          </span>
        </span>
      </div>
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex gap-4" role="radiogroup" aria-label={t("Note")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sur 5`} onClick={() => setRating(n)}>
              <Star size={44} strokeWidth={1.6} className={n <= rating ? 'text-ink' : 'text-disabled'} fill={n <= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
      </div>
      <SectionLabel>{t("Ce qui vous a plu")}</SectionLabel>
      <div className="flex flex-wrap gap-2.5">
        {TAGS.map((t) => (
          <Pill key={t} lg on={tags.includes(t)} onClick={() => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}>
            {t}
          </Pill>
        ))}
      </div>
      <Field label={t("Commentaire (optionnel)")} htmlFor="rv-comment">
        <Textarea id="rv-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} placeholder={t("Très bon travail, salon impeccable. Un peu d'attente à l'arrivée.")} />
      </Field>
      {/* Un avis est toujours signé prénom + initiale (règle de l'API, aucune option anonyme) : on le
          DIT, sans interrupteur — l'ancien ne changeait rien à ce qui était envoyé. */}
      <div className="crd">
        <span className="block text-[1rem] font-semibold">{t("Publié sous «")}{' '}{initials} »</span>
      </div>
      <ErrorMessage error={review.error} />
      <BottomSheet>
        <Button icon={ICONE.envoyer} disabled={!rating || review.isPending} onClick={() => void send()}>
          {review.isPending ? t('Envoi…') : t('Envoyer mon avis')}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
