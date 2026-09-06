/** AUTH 15 — Choix du marché : « Pour Hommes » / « Pour Femmes » (modifiable depuis le profil). */
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, type Market as MarketId } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { DESIGN_IMAGES } from '@/lib/authFlow';
import { Screen } from '@/components/AppFrame';

const CARDS: { id: MarketId; img: { src: string; credit: string } }[] = [
  { id: 'men', img: DESIGN_IMAGES.marketMen },
  { id: 'women', img: DESIGN_IMAGES.marketWomen },
];

export function Market() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const { session } = useAuth();
  const me = useMe(!!session);
  const update = useUpdateProfile();
  if (!session) return <Navigate to="/connexion" replace />;

  const choose = async (market: MarketId) => {
    await update.mutateAsync({ market });
    navigate(next, { replace: true });
  };

  return (
    <Screen className="min-h-dvh" gap={16}>
      <div className="pt-4">
        <div className="h3">{me.data?.profile.market ? 'Changer de marché' : 'Alger'}</div>
        <h1 className="h1 mt-2">Que recherchez-vous ?</h1>
      </div>
      {CARDS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => void choose(c.id)}
          disabled={update.isPending}
          className="relative h-[300px] w-full overflow-hidden rounded-[24px] text-left"
          aria-label={MARKET_LABELS_FR[c.id]}
        >
          <img src={c.img.src} alt="" className="h-full w-full object-cover" />
          <div className="ovl" />
          <div className="ovl-t !bottom-9">
            <div className="text-[28px] font-bold leading-[1.1] tracking-[-0.7px]">{MARKET_LABELS_FR[c.id]}</div>
            <div className="mt-1.5 text-[15px] leading-[1.35] text-white/85">
              {categoriesForMarket(c.id)
                .slice(0, c.id === 'men' ? 5 : 4)
                .map((x) => x.labelFr)
                .join(' · ')}
            </div>
          </div>
          <span className="absolute bottom-2 left-3 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] text-white/80">{c.img.credit}</span>
        </button>
      ))}
      <p className="p text-center">Modifiable à tout moment depuis le profil.</p>
    </Screen>
  );
}
