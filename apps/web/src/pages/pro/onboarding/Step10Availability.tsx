/**
 * PRO-F 12 / 13 — Étape 10 : « Vos créneaux » (granularité, battement, postes, réservation en ligne,
 * validation manuelle) puis « Règles de réservation » (délai minimum, fenêtre, annulation, report, acompte).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { errorText } from '@/components/ErrorMessage';
import { InfoBox, SectionLabel, Slot, Toggle } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, stepPath } from './Shared';

const GRANULARITY = [15, 30, 60];
const BUFFERS = [0, 5, 10, 15, 30];
const LEAD = [
  { v: 60, l: '1 h' },
  { v: 120, l: '2 h' },
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
        <h1 className="h1">Vos créneaux</h1>
        <SectionLabel>Granularité</SectionLabel>
        <div className="g3">
          {GRANULARITY.map((g) => (
            <Slot key={g} on={interval === g} onClick={() => setIntervalMin(g)} className="!py-[26px] !text-[20px]">
              {g} min
            </Slot>
          ))}
        </div>
        <SectionLabel>Règles</SectionLabel>
        <div className="crd !gap-0 !py-1">
          <label className="li !py-4">
            <span>
              <span className="block text-[19px]">Temps de battement</span>
              <span className="p block text-[16px]">Entre deux rendez-vous</span>
            </span>
            <select className="bg-transparent text-right text-[19px] text-muted outline-none" value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} aria-label="Temps de battement">
              {BUFFERS.map((b) => (
                <option key={b} value={b}>
                  {b} min
                </option>
              ))}
            </select>
          </label>
          <div className="li !py-4">
            <span>
              <span className="block text-[19px]">Rendez-vous simultanés</span>
              <span className="p block text-[16px]">Nombre de postes</span>
            </span>
            <span className="text-[19px] text-muted">{staffCount}</span>
          </div>
          <div className="li !py-4">
            <span>
              <span className="block text-[19px]">Réservation en ligne</span>
              <span className="p block text-[16px]">Visible dans la marketplace</span>
            </span>
            <Toggle on={online} onChange={setOnline} label="Réservation en ligne" />
          </div>
          <div className="li !py-4">
            <span>
              <span className="block text-[19px]">Validation manuelle</span>
              <span className="p block text-[16px]">Vous confirmez chaque demande</span>
            </span>
            <Toggle on={manual} onChange={setManual} label="Validation manuelle" />
          </div>
        </div>
        <InfoBox>Sans validation manuelle, les créneaux sont réservés instantanément.</InfoBox>
        <StepSheet onClick={() => setPhase('rules')} />
      </Screen>
    );
  }

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={10} right="Réservation" backTo={undefined} />
      <h1 className="h1">Règles de réservation</h1>
      <SectionLabel>Délai minimum avant un rendez-vous</SectionLabel>
      <div className="g4">
        {LEAD.map((l) => (
          <Slot key={l.v} on={lead === l.v} onClick={() => setLead(l.v)} className="!py-[26px] !text-[20px]">
            {l.l}
          </Slot>
        ))}
      </div>
      <SectionLabel>Fenêtre de réservation</SectionLabel>
      <div className="g3">
        {HORIZON.map((h) => (
          <Slot key={h} on={horizon === h} onClick={() => setHorizon(h)} className="!py-[26px] !text-[20px]">
            {h} j
          </Slot>
        ))}
      </div>
      <div className="crd !gap-0 !py-1">
        <label className="li !py-4">
          <span>
            <span className="block text-[19px]">Annulation client</span>
            <span className="p block text-[16px]">Gratuite jusqu'à</span>
          </span>
          <select className="bg-transparent text-right text-[19px] text-muted outline-none" value={cancel} onChange={(e) => setCancel(Number(e.target.value))} aria-label="Annulation gratuite jusqu'à">
            {CANCEL.map((c) => (
              <option key={c} value={c}>
                {c} h avant
              </option>
            ))}
          </select>
        </label>
        <div className="li !py-4">
          <span>
            <span className="block text-[19px]">Report client</span>
            <span className="p block text-[16px]">Sur demande, avec validation</span>
          </span>
          <Toggle on={report} onChange={setReport} label="Report client" />
        </div>
        <div className="li !py-4">
          <span>
            <span className="block text-[19px]">Acompte</span>
            <span className="p block text-[16px]">Paiement sur place uniquement</span>
          </span>
          <Toggle on={deposit} onChange={setDeposit} label="Acompte" />
        </div>
      </div>
      {error && (
        <p className="text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet label={settings ? 'Enregistrer' : 'Continuer'} onClick={() => void save()} busy={updateSalon.isPending} />
    </Screen>
  );
}
