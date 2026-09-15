/**
 * C-F 22 — Mon compte, sur le modèle des outils du métier : l'identité en tête (photo, nom,
 * e-mail, numéro, un bouton pour modifier), trois chiffres, puis les rubriques en lignes avec
 * icône — mes rendez-vous, mes favoris, mes informations, notifications, réglages —, l'accès
 * pro, et la déconnexion tout en bas, seule.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Bell,
  Camera,
  CalendarClock,
  ChevronRight,
  Heart,
  History,
  LogOut,
  Pencil,
  Settings,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { useMe, useMeStats, useUpdateProfile } from '@salondz/api-client';
import { formatDZPhone } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { Avatar, Badge, Button, I } from '@/components/ui';
import { BrandFooter } from '@/components/BrandFooter';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { ImageCropper } from '@/components/ImageCropper';
import { uploadAvatar } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { t } from '@/i18n';

/** Ligne de rubrique : icône ronde, libellé, détail éventuel, chevron. */
function Row({ to, icon, label, sub, right }: { to: string; icon: LucideIcon; label: string; sub?: string; right?: string }) {
  return (
    <Link to={to} className="li">
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-fill text-muted">
          <I icon={icon} size={18} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[1rem] font-semibold">{label}</span>
          {sub && <span className="block truncate text-[0.857rem] text-muted">{sub}</span>}
        </span>
      </span>
      {right && <span className="flex-none text-[1rem] text-muted">{right}</span>}
      <I icon={ChevronRight} size={18} className="shrink-0 text-disabled" />
    </Link>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex min-w-0 flex-col rounded-[var(--radius-card-sm)] bg-fill px-3 py-2.5">
      <span className="truncate text-[1.429rem] font-semibold leading-tight tracking-[-0.5px]">{value}</span>
      <span className="truncate text-[0.857rem] text-muted">{label}</span>
    </span>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const me = useMe();
  const stats = useMeStats();
  const updateProfile = useUpdateProfile();
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const [cropAvatar, setCropAvatar] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (me.isPending) return <Splash />;
  const p = me.data?.profile;
  const phone = p?.phone ?? null;
  const email = user?.email ?? null;
  const bookings = stats.data?.bookings ?? 0;
  const reviews = stats.data?.reviews ?? 0;

  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <h1 className="h1">{t("Mon compte")}</h1>

      {/* Qui : photo, nom, e-mail vérifié, numéro — et le bouton pour corriger. */}
      <div className="crd !gap-3">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            className="relative flex-none"
            onClick={() => avatarInput.current?.click()}
            aria-label={t("Changer la photo de profil")}
            disabled={avatarBusy || !user}
          >
            <Avatar src={p?.avatarUrl} name={p?.fullName ?? 'Moi'} size={64} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-ink text-white">
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
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.429rem] font-semibold tracking-[-0.4px]">
              {p?.fullName ?? 'Votre nom'}
            </span>
            {email && <span className="block truncate text-[0.857rem] text-muted">{email}</span>}
            {phone && <span className="mono block text-[0.857rem] text-muted">{formatDZPhone(phone)}</span>}
          </span>
          {email && (
            <Badge tone="ok" dot>
              {t("Vérifié")}
            </Badge>
          )}
        </div>
        <Link to="/compte/informations" className="btn g sm">
          <I icon={Pencil} size={16} /> {t("Modifier mes informations")}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Stat value={String(bookings)} label={bookings > 1 ? t('réservations') : t('réservation')} />
        <Stat value={String(stats.data?.favorites ?? 0)} label={t("favoris")} />
        <Stat value={stats.data ? String(reviews) : '—'} label={reviews > 1 ? t('avis donnés') : t('avis donné')} />
      </div>

      <span className="h3">{t("Mes rendez-vous")}</span>
      <div className="crd !gap-0 !py-1">
        <Row to="/rendez-vous" icon={CalendarClock} label={t("À venir")} sub={t("Vos prochains rendez-vous")} />
        <Row to="/rendez-vous?scope=past" icon={History} label={t("Historique")} sub={t("Rendez-vous passés et annulés")} />
        <Row to="/favoris" icon={Heart} label={t("Mes salons favoris")} right={stats.data ? String(stats.data.favorites) : undefined} />
      </div>

      <span className="h3">{t("Mon compte")}</span>
      <div className="crd !gap-0 !py-1">
        <Row to="/reglages#notifications" icon={Bell} label={t("Notifications")} sub={t("Rappels, confirmations, nouveautés")} />
        <Row to="/reglages" icon={Settings} label={t("Réglages")} sub={t("Marché affiché, langue, données")} />
      </div>

      {/* Passerelle vers l'espace pro : une carte, pas une rubrique parmi d'autres. */}
      <Link
        to={me.data?.salon ? '/pro' : '/pro/bienvenue'}
        className="crd !flex-row items-center gap-3.5 !border-ink"
      >
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink text-white">
          <I icon={Store} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[1rem] font-semibold tracking-[-0.2px]">
            {me.data?.salon ? t('Gérer {salon}', { salon: me.data.salon.name }) : t('Vous êtes professionnel ?')}
          </span>
          <span className="block text-[0.857rem] text-muted">
            {me.data?.salon ? t('Agenda, demandes, page publique') : t('Ouvrez votre espace et recevez des réservations')}
          </span>
        </span>
        <I icon={ChevronRight} size={20} className="text-disabled" />
      </Link>

      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}

      <Button
        variant="g"
        className="mt-2 !text-danger"
        onClick={async () => {
          await signOut();
          navigate('/intro', { replace: true });
        }}
      >
        <I icon={LogOut} size={18} /> {t("Se déconnecter")}
      </Button>

      {cropAvatar && user && (
        <ImageCropper
          file={cropAvatar}
          aspect={1}
          round
          title={t("Recadrer votre photo")}
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
