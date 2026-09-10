/**
 * Profil → Rendez-vous : les règles qui encadrent les réservations — créneaux et règles de réservation
 * (délai minimum, horizon), validation manuelle, règles d'annulation et de report, règle de retard, anti-abus.
 * Les valeurs fixes de la plateforme sont rappelées ici pour que le pro sache ce que voient ses clients.
 */
import { useState } from 'react';
import { AlertTriangle, CalendarX, ShieldCheck, SlidersHorizontal, Timer } from 'lucide-react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import {
  ARRIVAL_ADVANCE_MINUTES,
  CANCEL_ABUSE_BLOCK_DAYS,
  CANCEL_ABUSE_MAX,
  CANCEL_ABUSE_WINDOW_DAYS,
  LATE_TOLERANCE_MINUTES,
  MAX_CLIENT_RESCHEDULES,
  NO_SHOW_ABUSE_BLOCK_DAYS,
  NO_SHOW_ABUSE_MAX,
  NO_SHOW_ABUSE_WINDOW_DAYS,
} from '@salondz/constants';
import { errorText } from '@/components/ErrorMessage';
import { I, ListRow, SectionLabel, Toggle, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { RowText } from './MonSalon';

export function ProRules() {
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const cancelText = `Jusqu'à ${salon.cancelMinHours} h avant le rendez-vous`;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/profil" right="Profil" />
      <h1 className="h1">Rendez-vous</h1>

      <SectionLabel>Réservation</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <ListRow to="/pro/profil/regles">
          <RowText
            icon={SlidersHorizontal}
            title="Créneaux et règles de réservation"
            sub="Délai minimum, horizon, annulation, report"
          />
        </ListRow>
        <div className="li !py-4">
          <RowText
            icon={ShieldCheck}
            title="Validation manuelle"
            sub="Vous confirmez chaque demande"
          />
          <Toggle
            on={!salon.autoConfirm}
            onChange={(v) =>
              updateSalon.mutate({ autoConfirm: !v }, { onError: (e) => setError(errorText(e)) })
            }
            label="Validation manuelle"
          />
        </div>
      </div>

      <SectionLabel>Annulation et report</SectionLabel>
      <div className="crd !gap-2">
        <span className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
            <I icon={CalendarX} size={18} />
          </span>
          <span className="text-[1rem] font-semibold">Ce que voient vos clients</span>
        </span>
        <ul className="ml-1 flex list-disc flex-col gap-1 pl-4 text-[0.9375rem] text-muted">
          <li>Annulation en ligne : {cancelText}.</li>
          <li>
            Report en ligne :{' '}
            {salon.allowClientReschedule === false
              ? 'désactivé (le client vous contacte)'
              : `${MAX_CLIENT_RESCHEDULES} fois par rendez-vous, ${cancelText.toLowerCase()}`}
            .
          </li>
        </ul>
        <p className="text-[0.8125rem] text-muted">
          Modifiable dans « Créneaux et règles de réservation ».
        </p>
      </div>

      <SectionLabel>Retard</SectionLabel>
      <div className="crd !gap-2">
        <span className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
            <I icon={Timer} size={18} />
          </span>
          <span className="text-[1rem] font-semibold">Règle de retard</span>
        </span>
        <ul className="ml-1 flex list-disc flex-col gap-1 pl-4 text-[0.9375rem] text-muted">
          <li>Arrivée recommandée {ARRIVAL_ADVANCE_MINUTES} min avant l'heure.</li>
          <li>
            Retard toléré {LATE_TOLERANCE_MINUTES} min ; au-delà, vous pouvez annuler pour retard
            depuis la fiche du rendez-vous.
          </li>
        </ul>
      </div>

      <SectionLabel>Protection anti-abus</SectionLabel>
      <div className="crd !gap-2">
        <span className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
            <I icon={AlertTriangle} size={18} />
          </span>
          <span className="text-[1rem] font-semibold">Appliquée automatiquement par Salon DZ</span>
        </span>
        <ul className="ml-1 flex list-disc flex-col gap-1 pl-4 text-[0.9375rem] text-muted">
          <li>
            {CANCEL_ABUSE_MAX} annulations en {CANCEL_ABUSE_WINDOW_DAYS} jours → réservation
            suspendue {CANCEL_ABUSE_BLOCK_DAYS} jours.
          </li>
          <li>
            {NO_SHOW_ABUSE_MAX} absences en {NO_SHOW_ABUSE_WINDOW_DAYS} jours → réservation
            suspendue {NO_SHOW_ABUSE_BLOCK_DAYS} jours.
          </li>
          <li>Vous pouvez aussi bloquer un client depuis sa fiche.</li>
        </ul>
      </div>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
    </Screen>
  );
}
