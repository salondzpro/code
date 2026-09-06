/** AUTH 14 — Retour dans l'app, session conservée : « Bon retour, Inès ». */
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { useMe } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { DESIGN_IMAGES, formatIntlDZ, readAuthFlow } from '@/lib/authFlow';
import { Avatar, Badge, Button, I, ListRow } from '@/components/ui';
import { Screen } from '@/components/AppFrame';

export function WelcomeBack() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, user, signOut } = useAuth();
  const me = useMe(!!session);
  if (!session) return <Navigate to="/connexion" replace />;

  const profile = me.data?.profile;
  const firstName = (profile?.fullName ?? '').split(' ')[0] || 'vous';
  const contact = user?.phone ? formatIntlDZ(`+${user.phone.replace(/^\+/, '')}`) : (profile?.phone ? formatIntlDZ(profile.phone) : user?.email);
  const next = params.get('next') ?? readAuthFlow()?.next ?? (profile?.role === 'pro' ? '/pro' : '/');

  const proceed = () => {
    if (!profile?.fullName) return navigate(`/profil/creer?next=${encodeURIComponent(next)}`, { replace: true });
    if (profile.role !== 'pro' && !profile.market) return navigate(`/marche?next=${encodeURIComponent(next)}`, { replace: true });
    navigate(next, { replace: true });
  };

  return (
    <Screen className="min-h-dvh justify-center" gap={16}>
      <div className="flex flex-col items-center gap-4 text-center">
        <Avatar src={profile?.avatarUrl ?? DESIGN_IMAGES.welcomeBack.src} name={firstName} size={96} />
        <div>
          <h1 className="h1">Bon retour, {firstName}</h1>
          <p className="p mt-2">{contact}</p>
        </div>
        <Badge tone="ok" md>
          Session active · aucun code requis
        </Badge>
      </div>
      <p className="p text-center">Votre session reste ouverte tant que vous ne vous déconnectez pas — sur l'application comme sur le navigateur.</p>
      <div className="crd !gap-0 !py-1">
        <ListRow onClick={proceed} right={<I icon={ChevronRight} size={18} className="text-disabled" />} chevron={false}>
          <span className="text-[16px] font-medium">Continuer comme {firstName}</span>
        </ListRow>
        <ListRow
          onClick={async () => {
            await signOut();
            navigate('/connexion', { replace: true });
          }}
          right={<I icon={RefreshCw} size={18} className="text-disabled" />}
          chevron={false}
        >
          <span className="text-[16px]">Utiliser un autre numéro</span>
        </ListRow>
      </div>
      <Button onClick={proceed}>Continuer</Button>
    </Screen>
  );
}
