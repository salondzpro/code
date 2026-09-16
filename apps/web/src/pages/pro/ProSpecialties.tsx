/** Mon salon → Spécialités : les catégories dans lesquelles le salon apparaît (filtres de la marketplace, suggestions du catalogue). */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import type { CategoryId } from '@salondz/constants';
import { errorText } from '@/components/ErrorMessage';
import { BottomSheet, Button, TopBar } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { MAX_SPECIALTIES, SpecialtiesGrid, specialtiesFor } from '@/components/SpecialtiesGrid';
import { Splash } from '@/pages/auth/Splash';
import { StepTitle } from './onboarding/Shared';
import { t } from '@/i18n';

export function ProSpecialties() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (salon) setChosen(salon.categoryIds);
  }, [salon]);
  if (!salon) return <Splash />;
  const dirty = chosen.join(',') !== salon.categoryIds.join(',');

  const save = async () => {
    setError(null);
    try {
      await updateSalon.mutateAsync({ categoryIds: chosen as CategoryId[] });
      navigate('/pro/mon-salon', { replace: true });
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo="/pro/mon-salon" right={t('Mon salon')} />
      <StepTitle sub={t("Vos clients vous trouvent par spécialité. Choisissez-en une ou plusieurs : la suite de l'inscription s'adapte.")}>
        {t("Que proposez-vous ?")}
      </StepTitle>
      <SpecialtiesGrid items={specialtiesFor(salon.genderTarget)} chosen={chosen} onChange={setChosen} />
      <p className="p text-[0.857rem]">{t('{n} sur {max} spécialités', { n: chosen.length, max: MAX_SPECIALTIES })}</p>
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <BottomSheet grab={false}>
        <Button onClick={() => void save()} disabled={!dirty || chosen.length === 0 || updateSalon.isPending}>
          {updateSalon.isPending ? t('Enregistrement…') : t('Enregistrer')}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
