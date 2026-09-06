/** C-F 20 — Noter la prestation : étoiles, « Ce qui vous a plu », commentaire, publication sous prénom + initiale. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Star } from 'lucide-react';
import { useBooking, useCreateReview, useMe } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import { Avatar, BottomSheet, Button, Field, Pill, SectionLabel, Textarea, Toggle, TopBar } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';

const TAGS = ['Ponctualité', 'Hygiène', 'Accueil', 'Résultat', 'Rapport qualité-prix'];

function dayMonth(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date(iso));
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
  const [publish, setPublish] = useState(true);

  if (booking.isPending) return <Splash />;
  if (booking.isError) return <ErrorMessage error={booking.error} retry={() => booking.refetch()} />;
  const b = booking.data;
  const name = me.data?.profile.fullName ?? '';
  const initials = name ? `${name.split(' ')[0]} ${(name.split(' ')[1] ?? '').charAt(0)}${name.split(' ')[1] ? '.' : ''}`.trim() : 'vous';

  const send = async () => {
    const text = [tags.length ? tags.join(' · ') : '', comment.trim()].filter(Boolean).join(' — ');
    await review.mutateAsync({ bookingId: b.id, rating, comment: text || undefined });
    navigate('/rendez-vous?scope=past', { replace: true });
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar
        backTo="/rendez-vous?scope=past"
        right={
          <button type="button" className="text-[17px] text-muted" onClick={() => navigate('/rendez-vous?scope=past')}>
            Passer
          </button>
        }
      />
      <h1 className="h1">
        Comment s'est passée
        <br />
        votre visite ?
      </h1>
      <div className="crd !flex-row items-center gap-3.5">
        <Avatar src={b.salon.coverUrl} name={b.salon.name} size={88} />
        <span className="min-w-0">
          <span className="block text-[22px] font-bold tracking-[-0.4px]">{b.salon.name}</span>
          <span className="block text-[17px] text-muted">
            {dayMonth(b.startsAt)} · {b.serviceName} · {formatDA(b.priceDa)}
          </span>
        </span>
      </div>
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex gap-4" role="radiogroup" aria-label="Note">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sur 5`} onClick={() => setRating(n)}>
              <Star size={44} strokeWidth={1.6} className={n <= rating ? 'text-ink' : 'text-disabled'} fill={n <= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        <span className="text-[18px] text-muted">{rating ? `${rating} sur 5` : 'Touchez une étoile'}</span>
      </div>
      <SectionLabel>Ce qui vous a plu</SectionLabel>
      <div className="flex flex-wrap gap-2.5">
        {TAGS.map((t) => (
          <Pill key={t} lg on={tags.includes(t)} onClick={() => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}>
            {t}
          </Pill>
        ))}
      </div>
      <Field label="Commentaire (optionnel)" htmlFor="rv-comment">
        <Textarea id="rv-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} placeholder="Très bon travail, salon impeccable. Un peu d'attente à l'arrivée." />
      </Field>
      <div className="crd !flex-row items-center justify-between">
        <span>
          <span className="block text-[18px]">Publier sous « {initials} »</span>
          <span className="p block text-[15px]">Votre numéro reste privé</span>
        </span>
        <Toggle on={publish} onChange={setPublish} label="Publier sous mon prénom" />
      </div>
      <ErrorMessage error={review.error} />
      <BottomSheet>
        <Button disabled={!rating || review.isPending} onClick={() => void send()}>
          {review.isPending ? 'Envoi…' : 'Envoyer mon avis'}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
