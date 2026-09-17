/**
 * Après un changement d'horaires (salon ou membre) : les rendez-vous à venir qui tombent hors des
 * nouvelles plages. Ils sont conservés — le professionnel les déplace ou les annule depuis l'agenda,
 * ou élargit les horaires. Même liste que l'écran Fermetures, sans action destructrice.
 */
import { useNavigate } from 'react-router';
import type { OutsideBooking } from '@salondz/types';
import { formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import { BottomSheet, Button, Dim } from './ui';
import { t } from '@/i18n';

export function HoursConflictSheet({ items, onClose }: { items: OutsideBooking[]; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <>
      <Dim onClose={onClose} className="!z-[45]" />
      <BottomSheet className="!z-50">
        <div className="h1 !text-[1.429rem]">{t('{n} rendez-vous hors des nouveaux horaires', { n: items.length })}</div>
        <p className="p">{t("Les horaires sont enregistrés et ces rendez-vous sont conservés : déplacez-les ou annulez-les depuis l'agenda, ou élargissez les horaires.")}</p>
        <div className="crd !gap-0 !py-1 max-h-[40vh] overflow-y-auto">
          {items.map((b) => (
            <div key={b.id} className="li">
              <span className="min-w-0">
                <span className="block truncate text-[1rem] font-semibold">{b.clientName}</span>
                <span className="block truncate text-[0.857rem] text-muted">{b.serviceName}</span>
              </span>
              <span className="flex-none text-[0.857rem] text-muted" dir="ltr">
                {formatDateShortDZ(b.startsAt)} · {formatTimeDZ(b.startsAt)}
              </span>
            </div>
          ))}
        </div>
        <Button onClick={() => navigate('/pro/agenda')}>{t("Voir l'agenda")}</Button>
        <Button variant="g" onClick={onClose}>
          {t('Compris')}
        </Button>
      </BottomSheet>
    </>
  );
}
