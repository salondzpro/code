/**
 * RÈGLES DE RÉSERVATION (Paramètres) — réduites à l'essentiel le 15 nov. 2026 (demande du propriétaire :
 * « supprime définitivement tous les paramètres pas utiles »). Trois lignes, une carte :
 *   Je valide chaque demande · Réserver au plus tard · Annulation gratuite jusqu'à.
 * BOUCLIER (26 nov. 2026, demande du propriétaire) : + Prestations par rendez-vous (1 par défaut) et
 *   Rendez-vous à venir par client (1 par défaut) — un client ne remplit plus la journée du pro.
 * Retirés de l'affichage, partout : rendez-vous en même temps, pause entre deux rendez-vous, pas des
 * créneaux, réservable jusqu'à, report par le client, et les blocs d'information. Leurs valeurs en base
 * restent celles d'aujourd'hui (défauts du salon) ; rien n'est remis à zéro.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useBookingGuard, useProSalon, useProSalonMutations, useSaveBookingGuard } from '@salondz/api-client';
import { BOOKING_GUARD_DEFAULT, BOOKING_GUARD_SERVICES_CHOICES, BOOKING_GUARD_UPCOMING_CHOICES } from '@salondz/constants';
import { errorText } from '@/components/ErrorMessage';
import { Toggle } from '@/components/ui';
import { PickerField } from '@/components/Picker';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { PageLoading } from '@/components/PageLoading';
import { StepBar, StepSheet } from './Shared';
import { t } from '@/i18n';

const LEAD = [
  { v: 30, l: '30 min' },
  { v: 60, l: '1 h' },
  { v: 120, l: '2 h' },
  { v: 240, l: '4 h' },
  { v: 1440, l: '24 h' },
];
const CANCEL = [1, 2, 4, 12, 24];

export function Step10Availability() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [manual, setManual] = useState(false);
  const [lead, setLead] = useState(120);
  const [cancel, setCancel] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const guardQ = useBookingGuard();
  const saveGuard = useSaveBookingGuard();
  const [maxServices, setMaxServices] = useState<number>(BOOKING_GUARD_DEFAULT.maxServices);
  const [maxUpcoming, setMaxUpcoming] = useState<number>(BOOKING_GUARD_DEFAULT.maxUpcoming);
  useEffect(() => {
    if (!guardQ.data) return;
    setMaxServices(guardQ.data.maxServices);
    setMaxUpcoming(guardQ.data.maxUpcoming);
  }, [guardQ.data]);

  useEffect(() => {
    if (!salon) return;
    setManual(!salon.autoConfirm);
    setLead(salon.bookingLeadTimeMinutes);
    setCancel(salon.cancelMinHours ?? 2);
  }, [salon]);

  if (!salon) return <PageLoading />;
  const leads = LEAD.some((l) => l.v === lead) ? LEAD : [...LEAD, { v: lead, l: `${lead} min` }].sort((a, b) => a.v - b.v);
  const cancels = CANCEL.includes(cancel) ? CANCEL : [...CANCEL, cancel].sort((a, b) => a - b);

  const save = async () => {
    setError(null);
    try {
      await Promise.all([
        updateSalon.mutateAsync({ bookingLeadTimeMinutes: lead, cancelMinHours: cancel, autoConfirm: !manual }),
        saveGuard.mutateAsync({ maxServices, maxUpcoming }),
      ]);
      navigate('/pro/parametres');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={10} backTo="/pro/parametres" right={null} title={t('Règles de réservation')} />
      <div className="crd !gap-0 !py-1">
        <div className="li">
          <span className="text-[1rem] font-semibold">{t('Je valide chaque demande')}</span>
          <Toggle on={manual} onChange={setManual} label={t('Validation manuelle')} />
        </div>
        <label className="li">
          <span className="text-[1rem] font-semibold">{t('Réserver au plus tard')}</span>
          <PickerField inline label={t('Délai minimum de réservation')} value={lead} onChange={setLead} options={leads.map((l) => ({ value: l.v, label: t('{n} avant', { n: l.l }) }))} />
        </label>
        <label className="li">
          <span className="text-[1rem] font-semibold">{t("Annulation gratuite jusqu'à")}</span>
          <PickerField inline label={t("Annulation gratuite jusqu'à")} value={cancel} onChange={setCancel} options={cancels.map((c) => ({ value: c, label: t('{n} h avant', { n: c }) }))} />
        </label>
        <label className="li">
          <span className="text-[1rem] font-semibold">{t('Prestations par rendez-vous')}</span>
          <PickerField inline label={t('Prestations par rendez-vous')} value={maxServices} onChange={setMaxServices} options={BOOKING_GUARD_SERVICES_CHOICES.map((n) => ({ value: n, label: String(n) }))} />
        </label>
        <label className="li">
          <span className="text-[1rem] font-semibold">{t('Rendez-vous à venir par client')}</span>
          <PickerField inline label={t('Rendez-vous à venir par client')} value={maxUpcoming} onChange={setMaxUpcoming} options={BOOKING_GUARD_UPCOMING_CHOICES.map((n) => ({ value: n, label: String(n) }))} />
        </label>
      </div>
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet label={t('Enregistrer')} onClick={() => void save()} busy={updateSalon.isPending || saveGuard.isPending} />
    </Screen>
  );
}
