/**
 * PRO-F 12 / 13 — Étape 10 : « Vos créneaux » (granularité, battement, postes, réservation en ligne,
 * validation manuelle) puis « Règles de réservation » (délai minimum, fenêtre, annulation, report, acompte).
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { errorText } from '@/components/ErrorMessage';
import { SectionLabel, Slot, Toggle } from '@/components/ui';
import { PickerField } from '@/components/Picker';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, stepPath } from './Shared';
import { t } from '@/i18n';

const GRANULARITY = [15, 30, 60];
const BUFFERS = [0, 5, 10, 15, 30];
const LEAD = [
  { v: 30, l: '30 min' },
  { v: 60, l: '1 h' },
  { v: 90, l: '1 h 30' },
  { v: 120, l: '2 h' },
  { v: 180, l: '3 h' },
  { v: 240, l: '4 h' },
  { v: 1440, l: '24 h' },
];
const HORIZON = [7, 30, 60];
const CANCEL = [2, 4, 12, 24];

export function Step10Availability({ settings }: { settings?: boolean }) {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [phase, setPhase] = useState<'slots' | 'rules'>('slots');
  const [interval, setIntervalMin] = useState(30);
  const [buffer, setBuffer] = useState(0);
  const [online, setOnline] = useState(true);
  const [manual, setManual] = useState(false);
  const [lead, setLead] = useState(120);
  const [horizon, setHorizon] = useState(30);
  const [cancel, setCancel] = useState(2);
  const [report, setReport] = useState(true);
  const [deposit, setDeposit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salon) return;
    setIntervalMin(salon.slotIntervalMinutes);
    setBuffer(salon.bufferMinutes ?? 0);
    setManual(!salon.autoConfirm);
    setLead(salon.bookingLeadTimeMinutes);
    setHorizon(salon.bookingHorizonDays);
    setCancel(salon.cancelMinHours ?? 2);
    setReport(salon.allowClientReschedule ?? true);
    setDeposit(salon.depositRequired ?? false);
    // En réglage, l'interrupteur reflète la publication ; pendant l'onboarding, la page est publiée à la fin.
    setOnline(settings ? salon.isPublished : true);
  }, [salon, settings]);

  if (!salon) return <Splash />;
  const staffCount = salon.staff.filter((s) => s.isActive).length;

  const save = async () => {
    setError(null);
    try {
      await updateSalon.mutateAsync({
        slotIntervalMinutes: interval as 10 | 15 | 20 | 30 | 60,
        bufferMinutes: buffer,
        autoConfirm: !manual,
        bookingLeadTimeMinutes: lead,
        bookingHorizonDays: horizon,
        cancelMinHours: cancel,
        allowClientReschedule: report,
        depositRequired: deposit,
        ...(settings ? { isPublished: online } : {}),
      });
      navigate(settings ? '/pro/profil' : '/pro/onboarding/publier');
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (phase === 'slots') {
    return (
      <Screen bottom={SHEET_PAD} gap={16}>
        <StepBar step={10} backTo={settings ? '/pro/profil' : stepPath(9)} right="Disponibilités" />
        <h1 className="h1">{t("Vos créneaux")}</h1>
        <SectionLabel>{t("Créneaux proposés toutes les")}</SectionLabel>
        <div className="g3">
          {GRANULARITY.map((g) => (
            <Slot key={g} on={interval === g} onClick={() => setIntervalMin(g)} className="!py-[1.625rem] !text-[1rem]">
              {g} {t("min")}
            </Slot>
          ))}
        </div>
        <SectionLabel>{t("Règles")}</SectionLabel>
        <div className="crd !gap-0 !py-1">
          <label className="li">
            <span className="text-[1rem] font-semibold">{t("Pause entre deux rendez-vous")}</span>
            <PickerField inline label={t("Temps de battement")} value={buffer} onChange={setBuffer} options={BUFFERS.map((b) => ({ value: b, label: `${b} min` }))} />
          </label>
          <label className="li">
            <span className="text-[1rem] font-semibold">{t("Réserver au plus tard")}</span>
            <PickerField inline label={t("Délai minimum de réservation")} value={lead} onChange={setLead} options={LEAD.map((l) => ({ value: l.v, label: `${l.l} avant` }))} />
          </label>
          <Link to="/pro/equipe" className="li">
            <span className="text-[1rem] font-semibold">{t("Rendez-vous en même temps")}</span>
            <span className="text-[1rem] text-muted">{staffCount}</span>
          </Link>
          <div className="li">
            <span className="text-[1rem] font-semibold">{t("Réservation en ligne")}</span>
            <Toggle on={online} onChange={setOnline} label={t("Réservation en ligne")} />
          </div>
          <div className="li">
            <span className="text-[1rem] font-semibold">{t("Je valide chaque demande")}</span>
            <Toggle on={manual} onChange={setManual} label={t("Validation manuelle")} />
          </div>
        </div>
        <StepSheet onClick={() => setPhase('rules')} />
      </Screen>
    );
  }

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={10} right="Réservation" backTo={undefined} />
      <h1 className="h1">{t("Règles de réservation")}</h1>
      <SectionLabel>{t("Réservable jusqu’à")}</SectionLabel>
      <div className="g3">
        {HORIZON.map((h) => (
          <Slot key={h} on={horizon === h} onClick={() => setHorizon(h)} className="!py-[1.625rem] !text-[1rem]">
            {h} {t("j")}
          </Slot>
        ))}
      </div>
      <div className="crd !gap-0 !py-1">
        <label className="li">
          <span className="text-[1rem] font-semibold">{t("Annulation gratuite jusqu'à")}</span>
          <PickerField inline label={t("Annulation gratuite jusqu'à")} value={cancel} onChange={setCancel} options={CANCEL.map((c) => ({ value: c, label: `${c} h avant` }))} />
        </label>
        <div className="li">
          <span className="text-[1rem] font-semibold">{t("Le client peut reporter")}</span>
          <Toggle on={report} onChange={setReport} label={t("Report client")} />
        </div>
      </div>
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet label={settings ? 'Enregistrer' : 'Continuer'} onClick={() => void save()} busy={updateSalon.isPending} />
    </Screen>
  );
}
