/**
 * MON COMPTE, CÔTÉ CLIENT (refonte du 16 nov. 2026, demande du propriétaire : « uniquement le
 * nécessaire, ultra moderne façon Apple / Uber, au thème actuel comme côté pro »).
 *
 * Ce qu'une cliente vient chercher ici : se reconnaître (photo, nom, numéro) et corriger ses
 * informations, retrouver ses salons favoris, ses réglages (notifications : cloche de l'accueil), se déconnecter.
 * Rien d'autre :
 *   - carte d'identité façon « identifiant Apple » : la photo (touchée = changer), le nom, le
 *     numéro, et toute la carte mène à « Mes informations » — plus de bouton « Modifier » à part,
 *     plus de pastille « Vérifié » qui n'apprenait rien ;
 *   - une liste groupée (`SettingRow` dans `.lst`, les mêmes lignes que l'espace pro) ;
 *   - « Se déconnecter » seul, en rouge, dans son propre groupe.
 * Retirés : la phrase sous le titre, les trois compteurs (réservations = onglet Rendez-vous ; avis
 * = fiche d'un rendez-vous passé ; favoris = ligne ci-dessous, avec leur nombre).
 */
import { useRef, useState } from 'react';
import { ICONE } from '@/lib/actionIcons';
import { Link } from 'react-router';
import { Camera, ChevronRight, Heart, LogOut, Settings } from 'lucide-react';
import { useMe, useMeStats, useMyCredits, useUpdateProfile } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import { formatDZPhone } from '@salondz/constants';
import { useAuth, useSignOut } from '@/lib/auth';
import { visibleEmail } from '@/lib/alias';
import { Avatar, I, PageHead, SettingRow } from '@/components/ui';
import { BrandFooter } from '@/components/BrandFooter';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { PageLoading } from '@/components/PageLoading';
import { ImageCropper } from '@/components/ImageCropper';
import { uploadAvatar } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { t } from '@/i18n';

export function Profile() {
  const { user } = useAuth();
  const { seDeconnecter, enCours } = useSignOut();
  const me = useMe();
  const credits = useMyCredits();
  const stats = useMeStats();
  const updateProfile = useUpdateProfile();
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const [cropAvatar, setCropAvatar] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (me.isPending) return <PageLoading />;
  const p = me.data?.profile;
  const phone = p?.phone ?? null;
  const email = visibleEmail(user);
  const favoris = stats.data?.favorites ?? 0;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <PageHead title={t('Mon compte')} />

      {/* Qui : la photo (touchée = changer) et l'identité, qui mène à « Mes informations ». */}
      <div className="crd !flex-row items-center !gap-3.5">
        <button
          type="button"
          className="relative flex-none"
          onClick={() => avatarInput.current?.click()}
          aria-label={t('Changer la photo de profil')}
          disabled={avatarBusy || !user}
        >
          <Avatar src={p?.avatarUrl} name={p?.fullName ?? 'Moi'} size={64} />
          <span className="absolute -bottom-0.5 -end-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-ink text-white">
            <I icon={Camera} size={14} />
          </span>
        </button>
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setCropAvatar(f);
            e.target.value = '';
          }}
        />
        <Link to="/compte/informations" className="flex min-w-0 flex-1 items-center gap-2" aria-label={t('Mes informations')}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.429rem] font-semibold tracking-[-0.4px]">{p?.fullName ?? t('Votre nom')}</span>
            <span className="block truncate text-[0.929rem] text-muted" dir="ltr">
              {phone ? formatDZPhone(phone) : email}
            </span>
          </span>
          <I icon={ChevronRight} size={18} className="shrink-0 text-disabled rtl:rotate-180" />
        </Link>
      </div>

      {/* Crédits en cours chez des salons (18 nov. 2026) : le client sait ce qu'il doit, et pourquoi son
          compte est gelé tant que ce n'est pas réglé. */}
      {(credits.data?.length ?? 0) > 0 && (
        <div className="crd !gap-0 !py-1">
          {credits.data!.map((c) => (
            <div key={c.salonId} className="li">
              <span className="flex min-w-0 items-center gap-3">
                <span className="fid-ic" aria-hidden>
                  <I icon={ICONE.credit} size={18} strokeWidth={1.7} />
                </span>
                <b className="min-w-0 truncate text-[1rem] font-semibold">
                  {c.balance > 0 ? t('Crédit chez {salon}', { salon: c.salonName }) : t('Avance chez {salon}', { salon: c.salonName })}
                </b>
              </span>
              <b className={`flex-none text-[1rem] ${c.balance > 0 ? 'text-danger' : 'text-ok-fg'}`} dir="ltr">
                {c.balance > 0 ? formatDA(c.balance) : `+${formatDA(-c.balance)}`}
              </b>
            </div>
          ))}
        </div>
      )}

      <div className="lst">
        <SettingRow
          to="/favoris"
          icon={Heart}
          title={t('Mes favoris')}
          right={
            <span className="flex items-center gap-1.5 text-muted">
              {favoris > 0 && <span>{favoris}</span>}
              <I icon={ChevronRight} size={18} className="shrink-0 text-disabled rtl:rotate-180" />
            </span>
          }
        />
        <SettingRow to="/fidelite" icon={ICONE.fidelite} title={t('Ma fidélité')} />
        <SettingRow to="/reglages" icon={Settings} title={t('Réglages')} />
      </div>

      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="lst">
        <SettingRow
          onClick={() => void seDeconnecter()}
          icon={LogOut}
          danger
          title={enCours ? t('Déconnexion…') : t('Se déconnecter')}
          right={<span />}
        />
      </div>

      {cropAvatar && user && (
        <ImageCropper
          file={cropAvatar}
          aspect={1}
          round
          title={t('Recadrer votre photo')}
          onCancel={() => setCropAvatar(null)}
          onDone={async (f) => {
            setCropAvatar(null);
            setAvatarBusy(true);
            setError(null);
            try {
              const url = await uploadAvatar(user.id, f);
              await updateProfile.mutateAsync({ avatarUrl: url });
            } catch (e) {
              setError(errorText(e));
            } finally {
              setAvatarBusy(false);
            }
          }}
        />
      )}
      <BrandFooter />
    </Screen>
  );
}
