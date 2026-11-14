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
        sub={t('Votre salon, vos horaires et votre compte.')}
        action={salon && <QuickCloseButton openingHours={salon.openingHours} />}
      />
      <div className="lst">
        <SettingRow to="/pro/mon-salon" icon={Store} title={t('Mon salon')} sub={t('Nom, adresse, photos, spécialités')} />
        <SettingRow to="/pro/profil/horaires" icon={Clock} title={t("Horaires d'ouverture")} sub={t('Jours et heures où l’on peut réserver')} />
        <SettingRow to="/pro/blocages" icon={CalendarOff} title={t('Fermetures')} sub={t('Congés, jours fermés')} />
        <SettingRow to="/pro/profil/regles" icon={CalendarClock} title={t('Règles de réservation')} sub={t('Délais, annulation, validation')} />
        <SettingRow
          to="/pro/profil/versement"
          icon={Landmark}
          title={t('Versement à la réservation')}
          sub={
            (salon?.depositMode ?? 'off') === 'off'
              ? t('Désactivé · CCP, banque ou BaridiMob')
              : salon.depositMode === 'percent'
                ? t('{n} % du total, justificatif à valider', { n: salon.depositValue })
                : t('{montant}, justificatif à valider', { montant: formatDA(salon.depositValue) })
          }
        />
      </div>
      <div className="lst">
        {/* À plusieurs, « Équipe » est dans le menu « Plus » : une seule entrée. */}
        {!team && (
          <SettingRow to="/pro/equipe" icon={Users} title={t('Travailler à plusieurs')} sub={t('Ajoutez une personne qui travaille avec vous')} />
        )}
        <SettingRow to="/pro/compte" icon={UserCircle} title={t('Mon compte')} sub={t('Identité, langue, notifications')} />
      </div>
    </Screen>
  );
}
