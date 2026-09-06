/** C-F 22 — Profil client : identité vérifiée, compteurs, raccourcis, « Devenir professionnel ». */
import { Link } from 'react-router';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { useFavorites, useMe, useMyBookings } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { formatIntlDZ } from '@/lib/authFlow';
import { Avatar, Badge, I, ListRow } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

export function Profile() {
  const { user } = useAuth();
  const me = useMe();
  const favs = useFavorites();
  const past = useMyBookings({ scope: 'past', limit: 50 });
  const upcoming = useMyBookings({ scope: 'upcoming', limit: 50 });
  if (me.isPending) return <Splash />;
  const p = me.data?.profile;
  const phone = p?.phone ?? (user?.phone ? `+${user.phone.replace(/^\+/, '')}` : null);
  const bookings = (past.data?.items.length ?? 0) + (upcoming.data?.items.length ?? 0);

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <h1 className="h1 !text-[34px]">Profil</h1>
      <div className="crd !flex-row items-center gap-4">
        <Avatar src={p?.avatarUrl} name={p?.fullName ?? 'Moi'} size={120} />
        <div className="min-w-0">
          <div className="text-[24px] font-bold tracking-[-0.4px]">{p?.fullName ?? 'Votre nom'}</div>
          <div className="text-[17px] text-muted">{phone ? formatIntlDZ(phone) : user?.email}</div>
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
          { v: String(favs.data?.items.length ?? 0), l: 'favoris' },
          { v: '—', l: 'note donnée' },
        ].map((x) => (
          <div key={x.l} className="crd !gap-1 !px-4 !py-5">
            <span className="text-[28px] font-bold tracking-[-0.6px]">{x.v}</span>
            <span className="whitespace-nowrap text-[15px] text-muted">{x.l}</span>
          </div>
        ))}
      </div>
      <div className="crd !gap-0 !py-1">
        <ListRow to="/favoris">
          <span className="text-[19px]">Mes salons favoris</span>
        </ListRow>
        <ListRow to="/rendez-vous?scope=past">
          <span className="text-[19px]">Historique</span>
        </ListRow>
        <ListRow to="/reglages#contact">
          <span className="text-[19px]">Moyens de contact</span>
        </ListRow>
        <ListRow to="/reglages">
          <span className="text-[19px]">Réglages</span>
        </ListRow>
      </div>
      <Link to={me.data?.salon ? '/pro' : '/pro/bienvenue'} className="sf flex items-center gap-4 !p-4">
        <span className="flex h-[68px] w-[68px] flex-none items-center justify-center rounded-full border border-line bg-surface">
          <I icon={MessageCircle} size={26} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[20px] font-bold tracking-[-0.4px]">{me.data?.salon ? `Gérer ${me.data.salon.name}` : 'Devenir professionnel'}</span>
          <span className="p block text-[16px]">{me.data?.salon ? 'Agenda, demandes, page publique' : 'Recevoir des réservations sur votre page'}</span>
        </span>
        <I icon={ChevronRight} size={20} className="text-disabled" />
      </Link>
    </Screen>
  );
}
