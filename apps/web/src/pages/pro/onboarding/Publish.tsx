/** PRO-F 16 — « Tout est prêt » : liste de contrôle, lien public, prévisualiser, publier. */
import { useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import { ApiError, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { errorText } from '@/components/ErrorMessage';
import { Badge, Button, I } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepSheet } from './Shared';
import { useState } from 'react';

export function Publish() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const host = window.location.host.replace(/^www\./, '');
  const withPhotos = salon.services.filter((s) => s.isActive && (s.photos?.length ?? 0) > 0).length;
  const works = salon.photos.length + salon.services.reduce((a, s) => a + (s.photos?.length ?? 0), 0);
  const openDays = salon.openingHours.filter((h) => !h.isClosed).length;
  const items: { label: string; ok: boolean; hint?: string; to: string }[] = [
    { label: 'Établissement et adresse', ok: !!salon.name && !!salon.city, to: '/pro/profil' },
    { label: 'Couverture et logo', ok: !!salon.coverUrl && !!salon.logoUrl, hint: !salon.coverUrl ? 'Ajoutez une photo de couverture' : undefined, to: '/pro/profil' },
    { label: `${salon.services.filter((s) => s.isActive).length} prestation${salon.services.length > 1 ? 's' : ''}${withPhotos ? ` avec photos` : ''}`, ok: salon.services.some((s) => s.isActive), hint: 'Au moins une prestation active', to: '/pro/onboarding/6' },
    { label: `${works} réalisation${works > 1 ? 's' : ''}`, ok: works > 0, hint: 'Recommandé — améliore votre visibilité', to: '/pro/onboarding/8' },
    { label: 'Horaires et disponibilités', ok: openDays > 0, to: '/pro/onboarding/9' },
    { label: 'Description du salon', ok: !!salon.description, hint: 'Recommandé — améliore votre visibilité', to: '/pro/profil' },
  ];

  const publish = async () => {
    setError(null);
    try {
      await updateSalon.mutateAsync({ isPublished: true });
      navigate('/pro/lien', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && Array.isArray(err.details) ? (err.details as string[]).join(' · ') : errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <h1 className="h1 mt-2">Tout est prêt</h1>
      <div className="crd !gap-0 !py-1">
        {items.map((it) => (
          <button key={it.label} type="button" className="li w-full !py-4 text-left" onClick={() => navigate(it.to)}>
            <span>
              <span className="block text-[19px]">{it.label}</span>
              {!it.ok && it.hint && <span className="p block text-[16px]">{it.hint}</span>}
            </span>
            {it.ok ? (
              <I icon={Check} size={22} className="text-ok-fg" />
            ) : (
              <Badge tone="pd" dot={false} md>
                À faire
              </Badge>
            )}
          </button>
        ))}
      </div>
      <div className="rounded-[20px] bg-ink p-5 text-white">
        <div className="text-[17px] text-white/60">Votre page publique</div>
        <div className="mt-1 text-[24px] font-bold tracking-[-0.4px]">
          {host}/s/{salon.slug}
        </div>
      </div>
      <Button variant="g" onClick={() => navigate(`/s/${salon.slug}`)}>
        Prévisualiser la page
      </Button>
      {error && (
        <p className="text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet label={salon.isPublished ? 'Page publiée · voir mon lien' : 'Publier ma page'} onClick={() => (salon.isPublished ? navigate('/pro/lien') : void publish())} busy={updateSalon.isPending} />
    </Screen>
  );
}
