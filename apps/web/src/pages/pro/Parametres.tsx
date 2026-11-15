/**
 * Paramètres (refonte du 1er nov. 2026, ergonomie mew3id) : UNE page qui rassemble tous les réglages
 * du salon, en une carte de lignes. Elle remplace les pages relais « Profil », « Mon salon » et
 * « Rendez-vous » du tiroir. « Équipe » n'est proposée en avant qu'à partir de deux personnes ; une
 * indépendante la trouve sous « Travailler à plusieurs ».
 */
import { CalendarClock, CalendarOff, Clock, Landmark, Store, UserCircle, Users } from 'lucide-react';
import { formatDA } from '@salondz/constants';
import { useProSalon } from '@salondz/api-client';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { PageHead, SettingRow } from '@/components/ui';
import { QuickCloseButton } from '@/components/QuickClose';
import { t } from '@/i18n';

export function Parametres() {
  const salon = useProSalon().data?.salon ?? null;
  const team = (salon?.staff.filter((m) => m.isActive).length ?? 0) > 1;
  return (
    <Screen bottom={NAV_PAD} gap={18}>
      {/* « Arrêt / Pause » (fermer tout de suite pour quelques heures) : il vivait sur l’accueil, que la
          maquette 11 a allégé. */}
      <PageHead
        title={t('Paramètres')}
        action={salon && <QuickCloseButton openingHours={salon.openingHours} />}
      />
      <div className="lst">
        <SettingRow to="/pro/mon-salon" icon={Store} title={t('Mon salon')} />
        <SettingRow to="/pro/profil/horaires" icon={Clock} title={t("Horaires d'ouverture")} />
        <SettingRow to="/pro/blocages" icon={CalendarOff} title={t('Fermetures')} />
        <SettingRow to="/pro/profil/regles" icon={CalendarClock} title={t('Règles de réservation')} />
        <SettingRow
          to="/pro/profil/versement"
          icon={Landmark}
          title={t('Versement à la réservation')}
          sub={
            (salon?.depositMode ?? 'off') === 'off'
              ? t('Désactivé')
              : salon?.depositMode === 'percent'
                ? `${salon?.depositValue ?? 0} %`
                : formatDA(salon?.depositValue ?? 0)
          }
        />
      </div>
      <div className="lst">
        {/* À plusieurs, « Équipe » est dans le menu « Plus » : une seule entrée. */}
        {!team && (
          <SettingRow to="/pro/equipe" icon={Users} title={t('Travailler à plusieurs')} />
        )}
        <SettingRow to="/pro/compte" icon={UserCircle} title={t('Mon compte')} />
      </div>
    </Screen>
  );
}
