/**
 * Profil → Compte : profil professionnel (nom, téléphone), notifications, paramètres (page publiée, espace client),
 * déconnexion.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/lib/api';
import { disableWebPush, enableWebPush, webPushPermission, webPushSupported } from '@/lib/webpush';
import { ArrowLeftRight, Bell, Globe, Languages, LogOut, User, LifeBuoy, ShieldCheck, BellRing } from 'lucide-react';
import { useMe, useProSalon, useProSalonMutations, useUpdateProfile } from '@salondz/api-client';
import { PickerField } from '@/components/Picker';
import { formatDZPhone } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/components/ErrorMessage';
import { Badge, I, ListRow, SectionLabel, Toggle, TopBar } from '@/components/ui';
import { BrandFooter } from '@/components/BrandFooter';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { RowText } from './MonSalon';
import { LOCALES, switchLocale, t, useLocale } from '@/i18n';

export function ProAccount() {
  const navigate = useNavigate();
  const [webPush, setWebPush] = useState<NotificationPermission | 'unsupported'>(webPushPermission());
  const { signOut } = useAuth();
  const me = useMe();
  const proSalon = useProSalon().data;
  const salon = proSalon?.salon ?? null;
  // Présent seulement quand un administrateur PILOTE ce salon : `me` est alors le compte de
  // l'administrateur, et c'est l'identité du professionnel que cette page doit montrer.
  const owner = proSalon?.owner ?? null;
  const identity = owner ?? me.data?.profile ?? null;
  const { updateSalon } = useProSalonMutations();
  const updateProfile = useUpdateProfile();
  const [locale] = useLocale();
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/profil" right="Profil" />
      <h1 className="h1">{t("Compte")}</h1>

      <SectionLabel>{t("Profil professionnel")}</SectionLabel>
      <div className="crd !gap-0 !py-1">
        {/* Piloté par un administrateur : l'identité se corrige dans l'administration, avec un motif
            et une trace — jamais ici, où l'on modifierait le compte de l'administrateur. */}
        <ListRow to={owner ? `/admin/comptes/${owner.id}` : '/pro/compte/informations'}>
          <RowText
            icon={User}
            title={identity?.fullName ?? (owner ? t('Propriétaire sans nom') : t('Vous'))}
            sub={identity?.phone ? formatDZPhone(identity.phone) : t('Numéro non renseigné')}
          />
        </ListRow>
        <ListRow to="/pro/notifications">
          <RowText icon={Bell} title={t("Notifications")} sub={t("Demandes, confirmations, annulations")} />
        </ListRow>
        {webPushSupported() && !owner && (
          <div className="li">
            <RowText
              icon={BellRing}
              title={t("Notifications sur cet appareil")}
              sub={webPush === 'denied' ? t("Bloquées par le navigateur") : t("Demandes, annulations, rappels · application mobile si installée, sinon ce navigateur")}
            />
            {webPush !== 'denied' && (
              <Toggle
                on={webPush === 'granted'}
                onChange={async (v) => {
                  if (v) {
                    const ok = await enableWebPush(api);
                    setWebPush(ok ? 'granted' : webPushPermission());
                  } else {
                    await disableWebPush(api);
                    setWebPush('default');
                  }
                }}
                label={t("Notifications sur cet appareil")}
              />
            )}
          </div>
        )}
      </div>

      <SectionLabel>{t("Paramètres")}</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li">
          <RowText icon={Languages} title={t("Langue")} sub={t("Français, arabe ou anglais")} />
          <PickerField
            inline
            label={t("Langue")}
            value={locale}
            onChange={(v) => {
              void updateProfile.mutateAsync({ locale: v }).catch(() => undefined).finally(() => switchLocale(v));
            }}
            options={LOCALES.map((l) => ({ value: l.value, label: l.label }))}
          />
        </div>
        <div className="li">
          <RowText icon={Globe} title={t("Page publiée")} sub="Visible dans la marketplace" />
          <Toggle
            on={salon.isPublished}
            onChange={(v) =>
              updateSalon.mutate({ isPublished: v }, { onError: (e) => setError(errorText(e)) })
            }
            label={t("Page publiée")}
          />
        </div>
        <ListRow to="/">
          <RowText icon={ArrowLeftRight} title={t("Espace client")} sub="Réserver comme un client" />
        </ListRow>
      </div>
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="crd !gap-0 !py-1">
        <ListRow to="/aide">
          <RowText icon={LifeBuoy} title={t("Aide et contact")} sub="support@salondz.com · pro@salondz.com" />
        </ListRow>
        <ListRow to="/confidentialite">
          <RowText icon={ShieldCheck} title={t("Confidentialité et CGU")} sub={t("Vos données, vos obligations")} />
        </ListRow>
      </div>
      <div className="crd !gap-0 !py-1">
        <button
          type="button"
          className="li w-full text-start"
          onClick={async () => {
            await signOut();
            navigate('/intro', { replace: true });
          }}
        >
          <span className="flex items-center gap-3.5 text-danger">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-cancel-bg">
              <I icon={LogOut} size={18} />
            </span>
            <span className="text-[1rem] font-semibold">{t("Se déconnecter")}</span>
          </span>
        </button>
      </div>
      <BrandFooter />
    </Screen>
  );
}
