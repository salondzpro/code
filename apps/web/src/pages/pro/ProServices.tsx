/** Espace pro — Prestations : catalogue avec photos, prix, durée, activation, modification. */
import { useNavigate } from 'react-router';
import { ChevronRight, Plus } from 'lucide-react';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { formatDA, groupServices } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { Button, I, Img, SectionLabel, Toggle } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { ErrorMessage } from '@/components/ErrorMessage';

export function ProServices() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { update, remove } = useProServiceMutations();
  if (!salon) return <Splash />;
  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <div className="flex items-center justify-between">
        <h1 className="h1">Prestations</h1>
        <Button auto sm className="!rounded-full !px-4" onClick={() => navigate('/pro/onboarding/6')}>
          <I icon={Plus} size={18} /> Ajouter
        </Button>
      </div>
      <ErrorMessage error={update.error ?? remove.error} />
      {salon.services.length === 0 && <p className="p">Ajoutez votre première prestation : nom, prix, durée et photos.</p>}
      {groupServices(salon.services).map((g) => (
      <div key={g.name} className="flex flex-col gap-3">
        <SectionLabel right={<span className="s">{g.services.length}</span>}>{g.name}</SectionLabel>
        {g.services.map((sv) => {
          const photos = sv.photos ?? [];
          return (
            <div key={sv.id} className={`crd !gap-3 ${sv.isActive ? '' : 'opacity-60'}`}>
              <button type="button" className="flex items-center gap-4 text-left" onClick={() => navigate(`/pro/onboarding/6/${sv.id}`)}>
                <Img src={photos[0]?.url ?? salon.coverUrl} className="h-[5.5rem] w-[5.5rem] flex-none !rounded-[1rem]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.0625rem] font-bold tracking-[-0.3px]">{sv.name}</span>
                  <span className="block text-[0.8125rem] text-muted">
                    {formatDuration(sv.durationMinutes)} · {formatDA(sv.priceDa)}
                    {photos.length ? ` · ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}
                  </span>
                </span>
                <I icon={ChevronRight} size={20} className="text-disabled" />
              </button>
              <div className="flex items-center justify-between border-t border-line-soft pt-3">
                <span className="text-[0.8125rem] text-muted">{sv.isActive ? 'Visible et réservable' : 'Désactivée'}</span>
                <div className="flex items-center gap-4">
                  <button type="button" className="text-[0.9375rem] text-muted underline" onClick={() => navigate(`/pro/onboarding/7/${sv.id}`)}>
                    Photos
                  </button>
                  <Toggle on={sv.isActive} onChange={(v) => update.mutate({ id: sv.id, isActive: v })} label={`Activer ${sv.name}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      ))}
    </Screen>
  );
}
