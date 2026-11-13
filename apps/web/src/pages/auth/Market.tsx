/**
 * AUTH 15 — Choix du marché : « Pour Hommes » / « Pour Femmes » (modifiable depuis le profil).
 * Thème minimal éditorial (14 nov. 2026) : deux cartes blanches, la photo en haut, le nom et les
 * métiers dessous — plus de texte posé sur la photo ni de pastille de crédit par-dessus.
 */
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, type Market as MarketId } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { DESIGN_IMAGES } from '@/lib/authFlow';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { I } from '@/components/ui';
import { ChevronRight } from 'lucide-react';
import { t } from '@/i18n';

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
    try {
      await update.mutateAsync({ market });
      navigate(next, { replace: true });
    } catch {
      /* affiché par `update.error` ci-dessous */
    }
  };

  return (
    <Screen className="h-app" gap={16}>
      <div className="pt-4">
        {me.data?.profile.market && <div className="h3">{t('Changer de marché')}</div>}
        <h1 className="h1 mt-2">{t('Que recherchez-vous ?')}</h1>
      </div>
      {CARDS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => void choose(c.id)}
          disabled={update.isPending}
          className="mk-card"
          aria-label={t(MARKET_LABELS_FR[c.id])}
        >
          <img src={c.img.src} alt="" className="mk-ph" />
          <span className="mk-txt">
            <span className="mk-t">{t(MARKET_LABELS_FR[c.id])}</span>
            <span className="mk-s">
              {categoriesForMarket(c.id)
                .slice(0, c.id === 'men' ? 4 : 4)
                .map((x) => t(x.labelFr))
                .join(' · ')}
            </span>
          </span>
          <I icon={ChevronRight} size={20} className="mk-fl rtl:-scale-x-100" />
        </button>
      ))}
      <ErrorMessage error={update.error} />
      <p className="p text-center">{t('Modifiable à tout moment depuis le profil.')}</p>
    </Screen>
  );
}
