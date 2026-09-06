/** Espace pro — Prestations : catalogue avec photos, prix, durée, activation, modification. */
import { useNavigate } from 'react-router';
import { ChevronRight, Plus } from 'lucide-react';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { Button, I, Img, Toggle } from '@/components/ui';
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
        <h1 className="h1 !text-[34px]">Prestations</h1>
        <Button auto sm className="!rounded-full !px-4" onClick={() => navigate('/pro/onboarding/6')}>
          <I icon={Plus} size={18} /> Ajouter
        </Button>
      </div>
      <ErrorMessage error={update.error ?? remove.error} />
      {salon.services.length === 0 && <p className="p">Ajoutez votre première prestation : nom, prix, durée et photos.</p>}
      <div className="flex flex-col gap-3">
        {salon.services.map((sv) => {
          const photos = sv.photos ?? [];
          return (
            <div key={sv.id} className={`crd !gap-3 ${sv.isActive ? '' : 'opacity-60'}`}>
              <button type="button" className="flex items-center gap-4 text-left" onClick={() => navigate(`/pro/onboarding/6/${sv.id}`)}>
                <Img src={photos[0]?.url ?? salon.coverUrl} className="h-[88px] w-[88px] flex-none !rounded-[16px]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[21px] font-bold tracking-[-0.3px]">{sv.name}</span>
                  <span className="block text-[16px] text-muted">
                    {formatDuration(sv.durationMinutes)} · {formatDA(sv.priceDa)}
                    {photos.length ? ` · ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}
                  </span>
                </span>
                <I icon={ChevronRight} size={20} className="text-disabled" />
              </button>
              <div className="flex items-center justify-between border-t border-line-soft pt-3">
                <span className="text-[16px] text-muted">{sv.isActive ? 'Visible et réservable' : 'Désactivée'}</span>
                <div className="flex items-center gap-4">
                  <button type="button" className="text-[15px] text-muted underline" onClick={() => navigate(`/pro/onboarding/7/${sv.id}`)}>
                    Photos
                  </button>
                  <Toggle on={sv.isActive} onChange={(v) => update.mutate({ id: sv.id, isActive: v })} label={`Activer ${sv.name}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
