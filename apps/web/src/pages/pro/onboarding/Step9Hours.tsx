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

/** Case horaire : petit libellé + heure en grand, champ natif (sélecteur du téléphone) sur toute la case. */
function TimeBox({ label, value, onChange, ariaLabel }: { label: string; value: string; onChange: (v: string) => void; ariaLabel: string }) {
  return (
    <label className="tmb">
      <span className="tmb-l">{label}</span>
      <input type="time" className="tmb-i" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label={ariaLabel} />
    </label>
  );
}

/** Éditeur d'une semaine d'horaires avec pause par jour — partagé avec les horaires d'un membre (Équipe). */
export function WeekHoursEditor({ rows, onChange, closedLabel = 'Fermé', breakLabel = 'Pause' }: { rows: DayHoursRow[]; onChange: (rows: DayHoursRow[]) => void; closedLabel?: string; breakLabel?: string }) {
  const patch = (d: DayOfWeek, p: Partial<DayHoursRow>) => onChange(rows.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => {
        const err = rowError(r);
        const day = DAY_LABELS_FR[r.dayOfWeek];
        return (
          <div key={r.dayOfWeek} className={`crd !gap-3 ${r.open ? '' : '!bg-fill'}`}>
            <div className="flex items-center justify-between gap-3">
              <span className={`text-[1rem] font-semibold ${r.open ? '' : 'text-subtle'}`}>{day}</span>
              <span className="flex items-center gap-3">
                <span className="text-[0.8125rem] text-muted">{r.open ? formatDayRanges(rangesFromRows([r])) : closedLabel}</span>
                <Toggle on={r.open} onChange={(v) => patch(r.dayOfWeek, { open: v })} label={day} />
              </span>
            </div>
            {r.open && (
              <>
                <div className="g2">
                  <TimeBox label="Ouvre" value={r.opensAt} onChange={(v) => patch(r.dayOfWeek, { opensAt: v })} ariaLabel={`Ouverture ${day}`} />
                  <TimeBox label="Ferme" value={r.closesAt} onChange={(v) => patch(r.dayOfWeek, { closesAt: v })} ariaLabel={`Fermeture ${day}`} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[0.9375rem]">{breakLabel}</span>
                  <Toggle on={r.hasBreak} onChange={(v) => patch(r.dayOfWeek, { hasBreak: v })} label={`${breakLabel} ${day}`} />
                </div>
                {r.hasBreak && (
                  <div className="g2">
                    <TimeBox label="Début de pause" value={r.breakFrom} onChange={(v) => patch(r.dayOfWeek, { breakFrom: v })} ariaLabel={`Début de pause ${day}`} />
                    <TimeBox label="Fin de pause" value={r.breakTo} onChange={(v) => patch(r.dayOfWeek, { breakTo: v })} ariaLabel={`Fin de pause ${day}`} />
                  </div>
                )}
              </>
            )}
            {err && <p className="text-[0.8125rem] text-danger">{err}</p>}
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
