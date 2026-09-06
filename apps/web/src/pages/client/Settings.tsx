/** C-F 23 — Réglages client : notifications, préférences (langue, catalogue, ville), compte (session, confidentialité, données, déconnexion). */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { MARKET_LABELS_FR, wilayaName } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { useLocationPrefs } from '@/lib/clientPrefs';
import { Badge, ListRow, SectionLabel, Toggle, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';

function since(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

export function Settings() {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const me = useMe();
  const update = useUpdateProfile();
  const [prefs] = useLocationPrefs();
  const [reminders, setReminders] = useState(true);
  const [confirmations, setConfirmations] = useState(true);
  const [news, setNews] = useState(false);
  const p = me.data?.profile;

  useEffect(() => {
    if (p) setReminders(p.whatsappReminders ?? true);
  }, [p]);

  return (
    <Screen bottom={NAV_PAD} gap={14}>
      <TopBar backTo="/profil" right="Réglages" />
      <h1 className="h1">Réglages</h1>

      <SectionLabel>Notifications</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <span>
            <span className="block text-[19px]">Rappels WhatsApp</span>
            <span className="p block text-[16px]">2 h avant le rendez-vous</span>
          </span>
          <Toggle
            on={reminders}
            onChange={(v) => {
              setReminders(v);
              update.mutate({ whatsappReminders: v });
            }}
            label="Rappels WhatsApp"
          />
        </div>
        <div className="li !py-4">
          <span>
            <span className="block text-[19px]">Confirmations</span>
            <span className="p block text-[16px]">Réservation, report, annulation</span>
          </span>
          <Toggle on={confirmations} onChange={setConfirmations} label="Confirmations" />
        </div>
        <div className="li !py-4">
          <span>
            <span className="block text-[19px]">Nouveautés des salons suivis</span>
            <span className="p block text-[16px]">Maximum une fois par semaine</span>
          </span>
          <Toggle on={news} onChange={setNews} label="Nouveautés" />
        </div>
      </div>

      <SectionLabel>Préférences</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <span className="text-[19px]">Langue</span>
          <span className="text-[19px] text-muted">Français</span>
        </div>
        <Link to="/marche?next=/reglages" className="li !py-4">
          <span className="text-[19px]">Catalogue affiché</span>
          <span className="text-[19px] text-muted">{p?.market ? MARKET_LABELS_FR[p.market].replace('Pour ', '') : '—'}</span>
        </Link>
        <Link to="/localisation" className="li !py-4">
          <span className="text-[19px]">Ville</span>
          <span className="text-[19px] text-muted">{prefs.city ?? wilayaName(prefs.wilaya)}</span>
        </Link>
      </div>

      <SectionLabel>Compte</SectionLabel>
      <div className="crd !gap-0 !py-1" id="contact">
        <div className="li !py-4">
          <span>
            <span className="block text-[19px]">Session</span>
            <span className="p block text-[16px]">{p ? `Ouverte depuis le ${since(p.createdAt)} · illimitée` : 'Session ouverte'}</span>
          </span>
          <Badge tone="ok" md>
            Active
          </Badge>
        </div>
        <ListRow to="/confidentialite">
          <span className="text-[19px]">Confidentialité</span>
        </ListRow>
        <ListRow onClick={() => window.open(`mailto:contact@salondz.dz?subject=${encodeURIComponent('Suppression de mes données')}&body=${encodeURIComponent(`Compte : ${session?.user.email ?? session?.user.phone ?? ''}`)}`)}>
          <span className="text-[19px]">Supprimer mes données</span>
        </ListRow>
        <button
          type="button"
          className="li w-full text-left text-[19px] text-danger"
          onClick={async () => {
            await signOut();
            navigate('/intro', { replace: true });
          }}
        >
          Se déconnecter
        </button>
      </div>
    </Screen>
  );
}
