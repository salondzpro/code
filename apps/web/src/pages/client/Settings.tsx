/** C-F 23 — Réglages client : notifications, préférences (langue, catalogue, ville), compte (session, confidentialité, données, déconnexion). */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PickerField } from '@/components/Picker';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { MARKET_LABELS_FR } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { useLocationPrefs } from '@/lib/clientPrefs';
import { Badge, ListRow, SectionLabel, Toggle, TopBar } from '@/components/ui';
import { api } from '@/lib/api';
import {
  disableWebPush,
  enableWebPush,
  webPushPermission,
} from '@/lib/webpush';
import { Screen, NAV_PAD } from '@/components/AppFrame';

function since(iso: string): string {
  return new Intl.DateTimeFormat('fr-DZ', { day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date(iso));
}

export function Settings() {
  const [webPush, setWebPush] = useState<NotificationPermission | 'unsupported'>(() =>
    webPushPermission(),
  );
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const me = useMe();
  const update = useUpdateProfile();
  const [prefs, setPrefs] = useLocationPrefs();
  const [reminders, setReminders] = useState(true);
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
        {/* Notifications du navigateur : sans elles, l'application ne peut prévenir que
            lorsqu'elle est ouverte. C'est le seul réglage qui dépend d'une permission
            système, d'où l'état « refusé » explicite plutôt qu'un interrupteur qui ne
            bougerait pas. */}
        {webPush !== 'unsupported' && (
          <div className="li">
            <span className="text-[1rem] font-semibold">Notifications sur cet appareil</span>
            {webPush === 'denied' ? (
              <span className="text-[0.857rem] text-muted">Bloquées par le navigateur</span>
            ) : (
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
                label="Notifications sur cet appareil"
              />
            )}
          </div>
        )}
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">Rappels de rendez-vous</span>
            <span className="p block text-[0.857rem]">2 h avant le rendez-vous</span>
          </span>
          <Toggle
            on={reminders}
            onChange={(v) => {
              setReminders(v);
              update.mutate({ whatsappReminders: v });
            }}
            label="Rappels de rendez-vous"
          />
        </div>
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">Confirmations</span>
            <span className="p block text-[0.857rem]">Réservation, report, annulation</span>
          </span>
          <Toggle on={prefs.notifConfirmations} onChange={(v) => setPrefs({ notifConfirmations: v })} label="Confirmations" />
        </div>
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">Nouveautés des salons suivis</span>
            <span className="p block text-[0.857rem]">Maximum une fois par semaine</span>
          </span>
          <Toggle on={prefs.notifNews} onChange={(v) => setPrefs({ notifNews: v })} label="Nouveautés" />
        </div>
      </div>

      <SectionLabel>Préférences</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">Langue</span>
            <span className="p block text-[0.857rem]">L'interface en arabe arrive bientôt</span>
          </span>
          <PickerField
            inline
            label="Langue"
            value={p?.locale ?? 'fr'}
            onChange={(v) => update.mutate({ locale: v })}
            options={[
              { value: 'fr', label: 'Français' },
              { value: 'ar', label: 'العربية', hint: 'Bientôt disponible · votre choix est mémorisé' },
            ]}
          />
        </div>
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">Catalogue affiché</span>
            <span className="p block text-[0.857rem]">Marketplace et recherche</span>
          </span>
          <PickerField
            inline
            label="Catalogue affiché"
            value={p?.market ?? ''}
            placeholder="—"
            onChange={(v) => v && update.mutate({ market: v as 'men' | 'women' })}
            options={[
              { value: 'men', label: MARKET_LABELS_FR.men.replace('Pour ', ''), hint: 'Barbiers, coiffure homme' },
              { value: 'women', label: MARKET_LABELS_FR.women.replace('Pour ', ''), hint: 'Coiffure, ongles, cils, soins' },
            ]}
          />
        </div>
        <Link to="/localisation" className="li">
          <span>
            <span className="block text-[1rem] font-semibold">Ville</span>
            <span className="p block text-[0.857rem]">{prefs.lat != null ? `Autour de vous · ${prefs.radiusKm} km` : prefs.city ? 'Quartier choisi' : 'Toute la wilaya'}</span>
          </span>
          <span className="text-[1rem] text-muted">{prefs.label}</span>
        </Link>
      </div>

      <SectionLabel>Compte</SectionLabel>
      <div className="crd !gap-0 !py-1" id="contact">
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">Session</span>
            <span className="p block text-[0.857rem]">{p ? `Ouverte depuis le ${since(p.createdAt)} · illimitée` : 'Session ouverte'}</span>
          </span>
          <Badge tone="ok" md>
            Active
          </Badge>
        </div>
        <ListRow to="/confidentialite">
          <span className="text-[1rem]">Confidentialité</span>
        </ListRow>
        <ListRow onClick={() => window.open(`mailto:support@salondz.com?subject=${encodeURIComponent('Suppression de mes données')}&body=${encodeURIComponent(`Compte : ${session?.user.email ?? session?.user.phone ?? ''}`)}`)}>
          <span className="text-[1rem]">Supprimer mes données</span>
        </ListRow>
        <button
          type="button"
          className="li w-full text-left text-[1rem] text-danger"
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
