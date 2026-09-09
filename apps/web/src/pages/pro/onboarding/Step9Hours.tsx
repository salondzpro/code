/**
 * PRO-F 11 — Étape 9 : horaires par jour (interrupteur + plage) et pause facultative PAR JOUR
 * (ex. vendredi 12:00–14:00 uniquement). Une journée avec pause = deux plages en base.
 * Semaine commençant dimanche. Réutilisé dans les réglages (`settings`).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { DAY_LABELS_FR, formatDayRanges, rangesFromRows, rowError, rowsFromRanges, type DayHoursRow, type DayOfWeek } from '@salondz/constants';
import { errorText } from '@/components/ErrorMessage';
import { Toggle } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, stepPath } from './Shared';

/** Éditeur d'une semaine d'horaires avec pause par jour — partagé avec les horaires d'un membre (Équipe). */
export function WeekHoursEditor({ rows, onChange, closedLabel = 'Fermé', breakLabel = 'Pause' }: { rows: DayHoursRow[]; onChange: (rows: DayHoursRow[]) => void; closedLabel?: string; breakLabel?: string }) {
  const patch = (d: DayOfWeek, p: Partial<DayHoursRow>) => onChange(rows.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  return (
    <div className="crd !gap-0 !py-1">
      {rows.map((r) => {
        const err = rowError(r);
        const day = DAY_LABELS_FR[r.dayOfWeek];
        return (
          <div key={r.dayOfWeek} className="flex flex-col gap-2 border-b border-line-soft py-3 last:border-b-0">
            <div className="flex items-center gap-3">
              <span className={`w-[5.5rem] flex-none text-[0.9375rem] ${r.open ? 'font-semibold' : 'text-subtle'}`}>{day}</span>
              <span className="flex flex-1 items-center gap-1 text-[0.9375rem] text-muted">
                {r.open ? (
                  <>
                    <input type="time" className="tm" value={r.opensAt} onChange={(e) => patch(r.dayOfWeek, { opensAt: e.target.value })} aria-label={`Ouverture ${day}`} />
                    <span>–</span>
                    <input type="time" className="tm" value={r.closesAt} onChange={(e) => patch(r.dayOfWeek, { closesAt: e.target.value })} aria-label={`Fermeture ${day}`} />
                  </>
                ) : (
                  <span className="text-disabled">{closedLabel}</span>
                )}
              </span>
              <Toggle on={r.open} onChange={(v) => patch(r.dayOfWeek, { open: v })} label={day} />
            </div>
            {r.open && (
              <div className="flex items-center gap-3 pl-[5.5rem]">
                <span className="flex flex-1 items-center gap-1 text-[0.875rem] text-muted">
                  <span className="mr-1">{breakLabel}</span>
                  {r.hasBreak ? (
                    <>
                      <input type="time" className="tm" value={r.breakFrom} onChange={(e) => patch(r.dayOfWeek, { breakFrom: e.target.value })} aria-label={`Début de pause ${day}`} />
                      <span>–</span>
                      <input type="time" className="tm" value={r.breakTo} onChange={(e) => patch(r.dayOfWeek, { breakTo: e.target.value })} aria-label={`Fin de pause ${day}`} />
                    </>
                  ) : (
                    <span className="text-disabled">aucune</span>
                  )}
                </span>
                <Toggle on={r.hasBreak} onChange={(v) => patch(r.dayOfWeek, { hasBreak: v })} label={`${breakLabel} ${day}`} />
              </div>
            )}
            {r.open && (
              <div className="pl-[5.5rem] text-[0.75rem] text-subtle" aria-live="polite">
                {formatDayRanges(rangesFromRows([r]))}
              </div>
            )}
            {err && <p className="pl-[5.5rem] text-[0.8125rem] text-danger">{err}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function Step9Hours({ settings }: { settings?: boolean }) {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { setHours } = useProSalonMutations();
  const [rows, setRows] = useState<DayHoursRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salon) return;
    setRows(rowsFromRanges(salon.openingHours.filter((h) => !h.isClosed).map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.opensAt, end: h.closesAt }))));
  }, [salon]);

  if (!salon || rows.length === 0) return <Splash />;
  const invalid = rows.some((r) => rowError(r) !== null);

  const save = async () => {
    setError(null);
    const open = rangesFromRows(rows).map((r) => ({ dayOfWeek: r.dayOfWeek, opensAt: r.start, closesAt: r.end, isClosed: false }));
    const closed = rows.filter((r) => !r.open).map((r) => ({ dayOfWeek: r.dayOfWeek, opensAt: r.opensAt, closesAt: r.closesAt, isClosed: true }));
    try {
      await setHours.mutateAsync({ hours: [...open, ...closed] });
      navigate(settings ? '/pro/profil' : stepPath(10));
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={9} backTo={settings ? '/pro/profil' : stepPath(8)} right={settings ? 'Horaires' : undefined} />
      <h1 className="h1">Horaires</h1>
      <p className="p">Ouverture et fermeture par jour. Ajoutez une pause sur les jours qui en ont une, par exemple le vendredi de 12:00 à 14:00.</p>
      <WeekHoursEditor rows={rows} onChange={setRows} />
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <span className="text-[0.9375rem]">Semaine commençant</span>
          <span className="text-[0.9375rem] text-muted">Dimanche</span>
        </div>
      </div>
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet label={settings ? 'Enregistrer' : 'Continuer'} onClick={() => void save()} disabled={invalid} busy={setHours.isPending} />
    </Screen>
  );
}
