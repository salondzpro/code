/**
 * Profil → Catalogue : Catalogue → Catégorie → Prestation. Les catégories organisent (sans image) ; chaque
 * prestation a une image représentative, un prix et une durée. « + Ajouter une prestation » : nom → catégorie →
 * prix → durée → 1 photo → enregistrer. Les photos du travail réel vont dans « Réalisations » (Mon salon).
 */
import { useNavigate } from 'react-router';
import { Camera, ChevronRight, Plus, Tags } from 'lucide-react';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { formatDA, groupServices } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { Button, I, Img, SectionLabel, Toggle, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { ErrorMessage } from '@/components/ErrorMessage';

export function ProServices() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { update, remove } = useProServiceMutations();
  if (!salon) return <Splash />;
  const groups = groupServices(salon.services);
  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/profil" right="Profil" />
      <div className="flex items-center justify-between gap-3">
        <h1 className="h1">Catalogue</h1>
        <Button
          auto
          sm
          className="!rounded-full !px-4"
          onClick={() => navigate('/pro/onboarding/6')}
        >
          <I icon={Plus} size={18} /> Ajouter une prestation
        </Button>
      </div>
      <button
        type="button"
        className="crd !flex-row !items-center !gap-3.5 !py-3.5 text-left"
        onClick={() => navigate('/pro/categories')}
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
          <I icon={Tags} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[1rem] font-semibold">Catégories</span>
          <span className="block truncate text-[0.875rem] text-muted">
            {groups.length
              ? groups.map((g) => g.name).join(' · ')
              : 'Coupe, barbe, coloration, soins…'}
          </span>
        </span>
        <I icon={ChevronRight} size={18} className="text-disabled" />
      </button>
      <ErrorMessage error={update.error ?? remove.error} />
      {salon.services.length === 0 && (
        <p className="p">
          Ajoutez votre première prestation : nom, catégorie, prix, durée et une photo.
        </p>
      )}
      {groups.map((g) => (
        <div key={g.name} className="flex flex-col gap-3">
          <SectionLabel right={<span className="s">{g.services.length}</span>}>
            {g.name}
          </SectionLabel>
          <div className="crd !gap-0 !py-1">
            {g.services.map((sv) => {
              const photo = sv.photos?.[0]?.url ?? null;
              return (
                <div key={sv.id} className={`li !py-3 ${sv.isActive ? '' : 'opacity-60'}`}>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                    onClick={() => navigate(`/pro/onboarding/6/${sv.id}`)}
                    aria-label={`Modifier ${sv.name}`}
                  >
                    {photo ? (
                      <Img
                        src={photo}
                        className="h-[3.75rem] w-[3.75rem] flex-none !rounded-[0.875rem]"
                      />
                    ) : (
                      <button
                        type="button"
                        className="flex h-[3.75rem] w-[3.75rem] flex-none items-center justify-center rounded-[0.875rem] border border-dashed border-line bg-fill text-subtle"
                        aria-label={`Ajouter la photo de ${sv.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/pro/onboarding/7/${sv.id}`);
                        }}
                      >
                        <I icon={Camera} size={18} />
                      </button>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[1.0625rem] font-bold tracking-[-0.3px]">
                        {sv.name}
                      </span>
                      <span className="block text-[0.9375rem] text-muted">
                        {formatDA(sv.priceDa)} · {formatDuration(sv.durationMinutes)}
                        {sv.isActive ? '' : ' · désactivée'}
                      </span>
                    </span>
                  </button>
                  <Toggle
                    on={sv.isActive}
                    onChange={(v) => update.mutate({ id: sv.id, isActive: v })}
                    label={`Activer ${sv.name}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Screen>
  );
}
