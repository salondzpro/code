/** C-F 22 — Profil client : identité vérifiée, compteurs, raccourcis, « Devenir professionnel ». */
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Camera, ChevronRight, MessageCircle } from 'lucide-react';
import { useMe, useMeStats, useUpdateProfile } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { formatIntlDZ } from '@/lib/authFlow';
import { Avatar, Badge, I, ListRow } from '@/components/ui';
import { BrandFooter } from '@/components/BrandFooter';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { ImageCropper } from '@/components/ImageCropper';
import { uploadAvatar } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';

export function Profile() {
  const { user } = useAuth();
  const me = useMe();
  const stats = useMeStats();
  const updateProfile = useUpdateProfile();
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const [cropAvatar, setCropAvatar] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (me.isPending) return <Splash />;
  const p = me.data?.profile;
  const phone = p?.phone ?? (user?.phone ? `+${user.phone.replace(/^\+/, '')}` : null);
  const bookings = stats.data?.bookings ?? 0;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <h1 className="h1">Profil</h1>
      <div className="crd !flex-row items-center gap-4">
        <button
          type="button"
          className="relative flex-none"
          onClick={() => avatarInput.current?.click()}
          aria-label="Changer la photo de profil"
          disabled={avatarBusy || !user}
        >
          <Avatar src={p?.avatarUrl} name={p?.fullName ?? 'Moi'} size={120} />
          <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-ink text-white">
            <I icon={Camera} size={15} />
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
        <div className="min-w-0">
          <div className="text-[1.25rem] font-bold tracking-[-0.4px]">
            {p?.fullName ?? 'Votre nom'}
          </div>
          <div className="text-[0.8125rem] text-muted">
            {phone ? formatIntlDZ(phone) : user?.email}
          </div>
          <div className="mt-2">
            <Badge tone="ok" md>
              {phone ? 'Numéro vérifié' : 'Adresse vérifiée'}
            </Badge>
          </div>
        </div>
      </div>
      <div className="g3">
        {[
          { v: String(bookings), l: 'réservations' },
          { v: String(stats.data?.favorites ?? 0), l: 'favoris' },
          { v: stats.data ? String(stats.data.reviews) : '—', l: stats.data && stats.data.reviews > 1 ? 'avis donnés' : 'avis donné' },
        ].map((x) => (
          <div key={x.l} className="crd !gap-1 !px-4 !py-5">
            <span className="text-[1.5rem] font-bold tracking-[-0.6px]">{x.v}</span>
            <span className="whitespace-nowrap text-[0.9375rem] text-muted">{x.l}</span>
          </div>
        ))}
      </div>
      <div className="crd !gap-0 !py-1">
        <ListRow to="/favoris">
          <span className="text-[0.9375rem]">Mes salons favoris</span>
        </ListRow>
        <ListRow to="/rendez-vous?scope=past">
          <span className="text-[0.9375rem]">Historique</span>
        </ListRow>
        <ListRow to="/reglages#contact">
          <span className="text-[0.9375rem]">Moyens de contact</span>
        </ListRow>
        <ListRow to="/reglages">
          <span className="text-[0.9375rem]">Réglages</span>
        </ListRow>
      </div>
      <Link
        to={me.data?.salon ? '/pro' : '/pro/bienvenue'}
        className="sf flex items-center gap-4 !p-4"
      >
        <span className="flex h-[4.25rem] w-[4.25rem] flex-none items-center justify-center rounded-full border border-line bg-surface">
          <I icon={MessageCircle} size={26} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[1rem] font-bold tracking-[-0.4px]">
            {me.data?.salon ? `Gérer ${me.data.salon.name}` : 'Devenir professionnel'}
          </span>
          <span className="p block text-[0.8125rem]">
            {me.data?.salon
              ? 'Agenda, demandes, page publique'
              : 'Recevoir des réservations sur votre page'}
          </span>
        </span>
        <I icon={ChevronRight} size={20} className="text-disabled" />
      </Link>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      {cropAvatar && user && (
        <ImageCropper
          file={cropAvatar}
          aspect={1}
          round
          title="Recadrer votre photo"
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
