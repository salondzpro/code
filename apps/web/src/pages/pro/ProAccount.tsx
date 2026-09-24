/**
 * Profil → Compte : profil professionnel (nom, téléphone), notifications, paramètres (page publiée, espace client),
 * déconnexion.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/lib/api';
import { disableWebPush, enableWebPush, webPushPermission, webPushSupported } from '@/lib/webpush';
import { Bell, Globe, Languages, LogOut, Trash2, User, LifeBuoy, ShieldCheck, BellRing } from 'lucide-react';
import { useMe, useProSalon, useProSalonMutations, useUpdateProfile } from '@salondz/api-client';
import { PickerField } from '@/components/Picker';
import { formatDZPhone } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/components/ErrorMessage';
import { Badge, BottomSheet, Button, Dim, I, ListRow, SectionLabel, Toggle, TopBar } from '@/components/ui';
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** '…' = suppression en cours ; sinon le message d'erreur à montrer dans la feuille. */
  const [deleting, setDeleting] = useState<string | null>(null);
  if (!salon) return <Splash />;

  /** Exigé par Apple et Google : la suppression se fait dans l'application. Ferme aussi le salon. */
  const deleteAccount = async () => {
    setDeleting('…');
    try {
      await api.me.deleteAccount({ withSalon: true });
      await signOut();
      navigate('/intro', { replace: true });
    } catch (err) {
      setDeleting(errorText(err));
    }
  };

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
        {/* Plus de bascule vers l'espace client : décision du 24 sept. 2026, symétrique de celle prise
            côté client. Un professionnel qui veut réserver ailleurs passe par le site. */}
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
        {/* Jamais en pilotage : `/me` serait le compte de l'administrateur, pas celui du professionnel. */}
        {!owner && (
          <button type="button" className="li w-full text-start" onClick={() => setConfirmDelete(true)}>
            <span className="flex items-center gap-3.5 text-danger">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-cancel-bg">
                <I icon={Trash2} size={18} />
              </span>
              <span className="text-[1rem] font-semibold">{t("Supprimer mon compte et mon salon")}</span>
            </span>
          </button>
        )}
      </div>
      {confirmDelete && (
        <>
          <Dim onClose={() => deleting === '…' || setConfirmDelete(false)} />
          <BottomSheet modal>
            <div className="h1 !text-[1.429rem]">{t("Supprimer mon compte et mon salon ?")}</div>
            <p className="p">
              {t("Vos rendez-vous à venir seront annulés et vos clients prévenus. Votre page, votre catalogue, votre équipe, vos avis et l’historique de vos rendez-vous seront supprimés, chez vous comme chez vos clients. Cette action est définitive.")}
            </p>
            {deleting && deleting !== '…' && (
              <p className="text-[1rem] text-danger" role="alert">
                {deleting}
              </p>
            )}
            <Button variant="d" onClick={() => void deleteAccount()} disabled={deleting === '…'}>
              {deleting === '…' ? t('Suppression…') : t('Supprimer définitivement')}
            </Button>
            <Button variant="g" onClick={() => setConfirmDelete(false)} disabled={deleting === '…'}>
              {t("Garder mon compte")}
            </Button>
          </BottomSheet>
        </>
      )}
      <BrandFooter />
    </Screen>
  );
}
