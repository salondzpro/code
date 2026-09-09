/** PRO-F 07 / PRO-H 04 — Étape 5 : « Vos prestations » — catégories du catalogue du marché, cochables. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, salonMarkets, type CategoryId, type GenderTarget } from '@salondz/constants';
import { PickerField } from '@/components/Picker';
import { errorText } from '@/components/ErrorMessage';
import { BottomSheet, Button, I, Img, InfoBox } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, stepPath } from './Shared';

/** Type de clientèle du salon : détermine le ou les catalogues proposés (mixte = les deux). */
export const GENDER_OPTIONS: { value: GenderTarget; label: string; hint: string }[] = [
  { value: 'men', label: MARKET_LABELS_FR.men, hint: 'Barbier, coiffure homme' },
  { value: 'women', label: MARKET_LABELS_FR.women, hint: 'Coiffure, ongles, cils, soins' },
  { value: 'unisex', label: 'Mixte', hint: 'Hommes et femmes · les deux catalogues' },
];
export function catalogLabel(genderTarget: GenderTarget): string {
  return genderTarget === 'unisex' ? 'Mixte' : MARKET_LABELS_FR[genderTarget];
}
/** Catégories proposées d'après le type de clientèle (les deux marchés pour un salon mixte). */
export function catalogFor(genderTarget: GenderTarget) {
  return salonMarkets(genderTarget).flatMap((m) => categoriesForMarket(m));
}

/** Sous-titres du design pour chaque catégorie. */
const HINTS: Record<string, string> = {
  manucure: 'Manucure, pédicure, soin des mains',
  ongles: 'Pose gel, nail art, remplissage',
  'coiffure-lissage': 'Coupe, brushing, lissage',
  cils: 'Extensions, rehaussement, teinture',
  soins: 'Soin visage, hydratation',
  laser: 'Épilation laser',
  coiffure: 'Coupe, dégradé, brushing homme',
  lissage: 'Lissage et défrisage',
  'coloration-meches': 'Couleur, mèches, camouflage',
  'soins-peau': 'Nettoyage, masque, hydratation',
  tresses: 'Tresses, twists, nattes',
};

export function Step5Catalog() {
  const navigate = useNavigate();
  const salonQ = useProSalon();
  const salon = salonQ.data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [selected, setSelected] = useState<CategoryId[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (salon) setSelected(salon.categoryIds as CategoryId[]);
  }, [salon]);

  if (!salon) return <Splash />;
  const cats = catalogFor(salon.genderTarget);
  const toggle = (id: CategoryId) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Changer de clientèle enregistre tout de suite le choix et retire les catégories qui ne sont plus proposées. */
  const changeGender = async (genderTarget: GenderTarget) => {
    if (genderTarget === salon.genderTarget) return;
    setError(null);
    const allowed = new Set(catalogFor(genderTarget).map((c) => c.id));
    try {
      await updateSalon.mutateAsync({ genderTarget, categoryIds: selected.filter((id) => allowed.has(id)) });
    } catch (err) {
      setError(errorText(err));
    }
  };

  const next = async () => {
    if (selected.length === 0) return setError('Cochez au moins une prestation.');
    setError(null);
    try {
      await updateSalon.mutateAsync({ categoryIds: selected });
      navigate(stepPath(6));
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={5} backTo="/pro" />
      <h1 className="h1">Vos prestations</h1>
      <div className="sf flex items-center justify-between gap-3 !px-5 !py-4">
        <span>
          <span className="block text-[0.9375rem]">Catalogue</span>
          <span className="p block text-[0.8125rem]">Hommes, femmes ou mixte</span>
        </span>
        <PickerField inline label="Catalogue" title="Votre clientèle" value={salon.genderTarget} onChange={(v) => void changeGender(v)} options={GENDER_OPTIONS} className="font-semibold !text-text" />
      </div>
      <p className="p text-[0.9375rem]">Cochez ce que vous proposez. Vous fixerez prix, durée et photos à l'étape suivante.</p>
      <div className="crd !gap-0 !py-1">
        {cats.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button key={c.id} type="button" className="li w-full !py-4 text-left" onClick={() => toggle(c.id)} aria-pressed={on}>
              <span className="flex items-center gap-4">
                <Img src={salon.coverUrl} className="h-[5.5rem] w-[5.5rem] flex-none !rounded-[1rem]" />
                <span>
                  <span className="block text-[1.0625rem] font-bold tracking-[-0.3px]">{c.labelFr}</span>
                  <span className="block text-[0.8125rem] text-muted">{HINTS[c.id] ?? ''}</span>
                </span>
              </span>
              <span className={`chk${on ? ' on' : ''}`} aria-hidden>
                {on && <I icon={Check} size={16} />}
              </span>
            </button>
          );
        })}
      </div>
      <InfoBox>
        {salon.genderTarget === 'unisex' ? 'Salon mixte : les catalogues Pour Hommes et Pour Femmes vous sont proposés.' : `Seules les prestations du catalogue ${catalogLabel(salon.genderTarget)} vous sont proposées.`} Elles déterminent les filtres sur lesquels les clients vous trouvent.
      </InfoBox>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <BottomSheet>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.9375rem] text-muted">
            {selected.length} prestation{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}
          </span>
          <Button auto className="!rounded-full !px-7 !py-3.5" onClick={() => void next()} disabled={updateSalon.isPending}>
            Continuer
          </Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}
