/** PRO-F 07 / PRO-H 04 — Étape 5 : « Vos prestations » — catégories du catalogue du marché, cochables. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, type CategoryId, type Market } from '@salondz/constants';
import { errorText } from '@/components/ErrorMessage';
import { BottomSheet, Button, I, Img, InfoBox } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, stepPath } from './Shared';

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
  const market: Market = salon.genderTarget === 'men' ? 'men' : 'women';
  const cats = categoriesForMarket(market);
  const toggle = (id: CategoryId) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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
      <div className="sf flex items-center justify-between !px-5 !py-5 text-[19px]">
        <span>
          Catalogue : <b>{MARKET_LABELS_FR[market]}</b>
        </span>
        <Link to="/pro/profil" className="text-[17px] font-semibold text-muted">
          Modifier
        </Link>
      </div>
      <p className="p text-[19px]">Cochez ce que vous proposez. Vous fixerez prix, durée et photos à l'étape suivante.</p>
      <div className="crd !gap-0 !py-1">
        {cats.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button key={c.id} type="button" className="li w-full !py-4 text-left" onClick={() => toggle(c.id)} aria-pressed={on}>
              <span className="flex items-center gap-4">
                <Img src={salon.coverUrl} className="h-[88px] w-[88px] flex-none !rounded-[16px]" />
                <span>
                  <span className="block text-[21px] font-bold tracking-[-0.3px]">{c.labelFr}</span>
                  <span className="block text-[16px] text-muted">{HINTS[c.id] ?? ''}</span>
                </span>
              </span>
              <span className={`chk${on ? ' on' : ''}`} aria-hidden>
                {on && <I icon={Check} size={16} />}
              </span>
            </button>
          );
        })}
      </div>
      <InfoBox>Seules les prestations du catalogue {MARKET_LABELS_FR[market]} vous sont proposées. Elles déterminent les filtres sur lesquels les clients vous trouvent.</InfoBox>
      {error && (
        <p className="text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}
      <BottomSheet>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[19px] text-muted">
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
