/** C-F 23 — Réglages client : notifications, préférences (langue, catalogue, ville), compte (session, confidentialité, données, déconnexion). */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PickerField } from '@/components/Picker';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { MARKET_LABELS_FR, formatLocale } from '@salondz/constants';
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
import { LOCALES, switchLocale, t, useLocale } from '@/i18n';

function since(iso: string): string {
  return new Intl.DateTimeFormat(formatLocale(), { day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date(iso));
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
  const [locale] = useLocale();

  useEffect(() => {
    if (p) setReminders(p.whatsappReminders ?? true);
  }, [p]);

  return (
    <Screen bottom={NAV_PAD} gap={14}>
      <TopBar backTo="/profil" right={t("Mon compte")} />
      <h1 className="h1">{t("Réglages")}</h1>

      <SectionLabel>{t("Notifications")}</SectionLabel>
      <div className="crd !gap-0 !py-1 scroll-mt-[4.5rem]" id="notifications">
        {/* Notifications du navigateur : sans elles, l'application ne peut prévenir que
            lorsqu'elle est ouverte. C'est le seul réglage qui dépend d'une permission
            système, d'où l'état « refusé » explicite plutôt qu'un interrupteur qui ne
            bougerait pas. */}
        {webPush !== 'unsupported' && (
          <div className="li">
            <span className="text-[1rem] font-semibold">{t("Notifications sur cet appareil")}</span>
            {webPush === 'denied' ? (
              <span className="text-[0.857rem] text-muted">{t("Bloquées par le navigateur")}</span>
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
                label={t("Notifications sur cet appareil")}
              />
            )}
          </div>
        )}
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">{t("Rappels de rendez-vous")}</span>
            <span className="p block text-[0.857rem]">{t("2 h avant le rendez-vous")}</span>
          </span>
          <Toggle
            on={reminders}
            onChange={(v) => {
              setReminders(v);
              update.mutate({ whatsappReminders: v });
            }}
            label={t("Rappels de rendez-vous")}
          />
        </div>
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">{t("Confirmations")}</span>
            <span className="p block text-[0.857rem]">{t("Réservation, report, annulation")}</span>
          </span>
          <Toggle on={prefs.notifConfirmations} onChange={(v) => setPrefs({ notifConfirmations: v })} label={t("Confirmations")} />
        </div>
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">{t("Nouveautés des salons suivis")}</span>
            <span className="p block text-[0.857rem]">{t("Maximum une fois par semaine")}</span>
          </span>
          <Toggle on={prefs.notifNews} onChange={(v) => setPrefs({ notifNews: v })} label={t("Nouveautés")} />
        </div>
      </div>

      <SectionLabel>{t("Préférences")}</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">{t("Langue")}</span>
            <span className="p block text-[0.857rem]">{t("Français, arabe ou anglais")}</span>
          </span>
          <PickerField
            inline
            label={t("Langue")}
            value={locale}
            onChange={(v) => {
              // Mémorisée dans le profil quand on est connecté, puis rechargement : les
              // libellés calculés au chargement des modules se relisent dans la langue.
              update.mutate({ locale: v });
              switchLocale(v);
            }}
            options={LOCALES.map((l) => ({ value: l.value, label: l.label }))}
          />
        </div>
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">{t("Catalogue affiché")}</span>
            <span className="p block text-[0.857rem]">{t("Marketplace et recherche")}</span>
          </span>
          <PickerField
            inline
            label={t("Catalogue affiché")}
            value={p?.market ?? ''}
            placeholder="—"
            onChange={(v) => v && update.mutate({ market: v as 'men' | 'women' })}
            options={[
              { value: 'men', label: t(MARKET_LABELS_FR.men).replace('Pour ', ''), hint: t("Barbiers, coiffure homme") },
              { value: 'women', label: t(MARKET_LABELS_FR.women).replace('Pour ', ''), hint: t("Coiffure, ongles, cils, soins") },
            ]}
          />
        </div>
        <Link to="/localisation" className="li">
          <span>
            <span className="block text-[1rem] font-semibold">{t("Ville")}</span>
            <span className="p block text-[0.857rem]">{prefs.lat != null ? t('Autour de vous · {n} km', { n: prefs.radiusKm }) : prefs.city ? t('Quartier choisi') : t('Toute la wilaya')}</span>
          </span>
          <span className="text-[1rem] text-muted">{prefs.label}</span>
        </Link>
      </div>

      <SectionLabel>{t("Compte")}</SectionLabel>
      <div className="crd !gap-0 !py-1" id="contact">
        <div className="li">
          <span>
            <span className="block text-[1rem] font-semibold">{t("Session")}</span>
            <span className="p block text-[0.857rem]">{p ? t('Ouverte depuis le {date} · illimitée', { date: since(p.createdAt) }) : t('Session ouverte')}</span>
          </span>
          <Badge tone="ok" md>
            {t("Active")}
          </Badge>
        </div>
        <ListRow onClick={() => window.open(`mailto:support@salondz.com?subject=${encodeURIComponent('Suppression de mes données')}&body=${encodeURIComponent(`Compte : ${session?.user.email ?? session?.user.phone ?? ''}`)}`)}>
          <span className="text-[1rem]">{t("Supprimer mes données")}</span>
        </ListRow>
      </div>
    </Screen>
  );
}
