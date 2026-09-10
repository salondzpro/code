/**
 * Profil → Compte : profil professionnel (nom, téléphone), notifications, paramètres (page publiée, espace client),
 * déconnexion.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeftRight, Bell, Globe, LogOut, User } from 'lucide-react';
import { useMe, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { formatDZPhone } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/components/ErrorMessage';
import { Badge, I, ListRow, SectionLabel, Toggle, TopBar } from '@/components/ui';
import { BrandFooter } from '@/components/BrandFooter';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { RowText } from './MonSalon';

export function ProAccount() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const me = useMe();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/profil" right="Profil" />
      <h1 className="h1">Compte</h1>

      <SectionLabel>Profil professionnel</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <RowText
            icon={User}
            title={me.data?.profile.fullName ?? 'Vous'}
            sub={
              me.data?.profile.phone ? formatDZPhone(me.data.profile.phone) : 'Numéro non renseigné'
            }
          />
          <Badge tone="ok" md>
            Actif
          </Badge>
        </div>
        <ListRow to="/pro/notifications">
          <RowText icon={Bell} title="Notifications" sub="Demandes, confirmations, annulations" />
        </ListRow>
      </div>

      <SectionLabel>Paramètres</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <RowText icon={Globe} title="Page publiée" sub="Visible dans la marketplace" />
          <Toggle
            on={salon.isPublished}
            onChange={(v) =>
              updateSalon.mutate({ isPublished: v }, { onError: (e) => setError(errorText(e)) })
            }
            label="Page publiée"
          />
        </div>
        <ListRow to="/">
          <RowText icon={ArrowLeftRight} title="Espace client" sub="Réserver comme un client" />
        </ListRow>
      </div>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="crd !gap-0 !py-1">
        <button
          type="button"
          className="li w-full text-left"
          onClick={async () => {
            await signOut();
            navigate('/intro', { replace: true });
          }}
        >
          <span className="flex items-center gap-3.5 text-danger">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-cancel-bg">
              <I icon={LogOut} size={18} />
            </span>
            <span className="text-[1rem] font-semibold">Se déconnecter</span>
          </span>
        </button>
      </div>
      <BrandFooter />
    </Screen>
  );
}
