/** PRO-F 11 — Étape 9 : horaires par jour (interrupteur + plage), pause déjeuner, semaine commençant dimanche. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { DAY_LABELS_FR, DEFAULT_OPENING_HOURS, WEEK_DAYS, type DayOfWeek } from '@salondz/constants';
import { errorText } from '@/components/ErrorMessage';
import { Toggle } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, stepPath } from './Shared';

interface Row {
  dayOfWeek: DayOfWeek;
  open: boolean;
  opensAt: string;
  closesAt: string;
}

export function Step9Hours({ settings }: { settings?: boolean }) {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { setHours } = useProSalonMutations();
  const [rows, setRows] = useState<Row[]>([]);
  const [lunch, setLunch] = useState(false);
  const [lunchFrom, setLunchFrom] = useState('12:00');
  const [lunchTo, setLunchTo] = useState('13:00');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salon) return;
    const next: Row[] = WEEK_DAYS.map((d) => {
      const ranges = salon.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed).sort((a, b) => a.opensAt.localeCompare(b.opensAt));
      const def = DEFAULT_OPENING_HOURS[d]!;
      if (ranges.length === 0) return { dayOfWeek: d, open: false, opensAt: def.opensAt, closesAt: def.closesAt };
      return { dayOfWeek: d, open: true, opensAt: ranges[0]!.opensAt, closesAt: ranges[ranges.length - 1]!.closesAt };
    });
    setRows(next);
    // pause déjeuner déduite d'une journée en deux plages
    const split = WEEK_DAYS.map((d) => salon.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed).sort((a, b) => a.opensAt.localeCompare(b.opensAt))).find((r) => r.length === 2);
    if (split) {
      setLunch(true);
      setLunchFrom(split[0]!.closesAt);
      setLunchTo(split[1]!.opensAt);
    }
  }, [salon]);

  if (!salon || rows.length === 0) return <Splash />;
  const patch = (d: DayOfWeek, p: Partial<Row>) => setRows((prev) => prev.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  const invalid = rows.some((r) => r.open && r.opensAt >= r.closesAt) || (lunch && lunchFrom >= lunchTo);

  const save = async () => {
    setError(null);
    const hours = rows.flatMap((r) => {
      if (!r.open) return [{ dayOfWeek: r.dayOfWeek, opensAt: r.opensAt, closesAt: r.closesAt, isClosed: true }];
      if (lunch && lunchFrom > r.opensAt && lunchTo < r.closesAt) {
        return [
          { dayOfWeek: r.dayOfWeek, opensAt: r.opensAt, closesAt: lunchFrom, isClosed: false },
          { dayOfWeek: r.dayOfWeek, opensAt: lunchTo, closesAt: r.closesAt, isClosed: false },
        ];
      }
      return [{ dayOfWeek: r.dayOfWeek, opensAt: r.opensAt, closesAt: r.closesAt, isClosed: false }];
    });
    try {
      await setHours.mutateAsync({ hours });
      navigate(settings ? '/pro/profil' : stepPath(10));
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={9} backTo={settings ? '/pro/profil' : stepPath(8)} right={settings ? 'Horaires' : undefined} />
      <h1 className="h1">Horaires</h1>
      <div className="crd !gap-0 !py-1">
        {rows.map((r) => (
          <div key={r.dayOfWeek} className="li !py-4">
            <span className={`w-[104px] flex-none text-[19px] ${r.open ? '' : 'text-subtle'}`}>{DAY_LABELS_FR[r.dayOfWeek]}</span>
            <span className="flex flex-1 items-center gap-1 text-[19px] text-muted">
              {r.open ? (
                <>
                  <input type="time" className="tm" value={r.opensAt} onChange={(e) => patch(r.dayOfWeek, { opensAt: e.target.value })} aria-label={`Ouverture ${DAY_LABELS_FR[r.dayOfWeek]}`} />
                  <span>–</span>
                  <input type="time" className="tm" value={r.closesAt} onChange={(e) => patch(r.dayOfWeek, { closesAt: e.target.value })} aria-label={`Fermeture ${DAY_LABELS_FR[r.dayOfWeek]}`} />
                </>
              ) : (
                <span className="text-disabled">Fermé</span>
              )}
            </span>
            <Toggle on={r.open} onChange={(v) => patch(r.dayOfWeek, { open: v })} label={DAY_LABELS_FR[r.dayOfWeek]} />
          </div>
        ))}
      </div>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <span className="text-[19px]">Pause déjeuner</span>
          <span className="flex items-center gap-2 text-[19px] text-muted">
            {lunch && (
              <>
                <input type="time" className="tm" value={lunchFrom} onChange={(e) => setLunchFrom(e.target.value)} aria-label="Début de pause" />
                –
                <input type="time" className="tm" value={lunchTo} onChange={(e) => setLunchTo(e.target.value)} aria-label="Fin de pause" />
              </>
            )}
            <Toggle on={lunch} onChange={setLunch} label="Pause déjeuner" />
          </span>
        </div>
        <div className="li !py-4">
          <span className="text-[19px]">Semaine commençant</span>
          <span className="text-[19px] text-muted">Dimanche</span>
        </div>
      </div>
      {invalid && <p className="text-[14px] text-danger">L'heure d'ouverture doit précéder la fermeture.</p>}
      {error && (
        <p className="text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet label={settings ? 'Enregistrer' : 'Continuer'} onClick={() => void save()} disabled={invalid} busy={setHours.isPending} />
    </Screen>
  );
}
