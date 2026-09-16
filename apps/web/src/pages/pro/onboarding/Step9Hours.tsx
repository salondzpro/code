/**
 * PRO-F 11 — Étape 9 : horaires de la semaine, façon outil du métier : une ligne par jour (jour, plage,
 * interrupteur) dans une seule carte ; toucher un jour ouvert déplie ses heures et ses pauses (ex. vendredi
 * 12:00–14:00). Une journée avec pause = deux plages en base. Semaine commençant dimanche.
 * Réutilisé dans les réglages (`settings`) et pour les horaires d'un membre (Équipe).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { ChevronDown, Copy, Plus, X } from 'lucide-react';
import { DAY_LABELS_FR, MAX_BREAKS_PER_DAY, formatDayRanges, nextBreakSuggestion, rangesFromRows, rowError, rowsFromRanges, type DayBreak, type DayHoursRow, type DayOfWeek } from '@salondz/constants';
import { errorText } from '@/components/ErrorMessage';
import { I, Toggle } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, stepPath } from './Shared';
import { t } from '@/i18n';

/** Case horaire : petit libellé + heure en grand, champ natif (sélecteur du téléphone) sur toute la case. */
function TimeBox({ label, value, onChange, ariaLabel }: { label: string; value: string; onChange: (v: string) => void; ariaLabel: string }) {
  return (
    <label className="tmb">
      <span className="tmb-l">{label}</span>
      <input type="time" className="tmb-i" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label={ariaLabel} />
    </label>
  );
}

/**
 * Éditeur d'une semaine d'horaires avec une ou plusieurs pauses par jour. Une carte, sept lignes ; le jour
 * touché se déplie. « Appliquer à tous les jours ouverts » évite de saisir sept fois la même plage.
 */
export function WeekHoursEditor({ rows, onChange, closedLabel = 'Fermé' }: { rows: DayHoursRow[]; onChange: (rows: DayHoursRow[]) => void; closedLabel?: string }) {
  const [openDay, setOpenDay] = useState<DayOfWeek | null>(null);
  const patch = (d: DayOfWeek, p: Partial<DayHoursRow>) => onChange(rows.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  const patchBreak = (r: DayHoursRow, idx: number, b: Partial<DayBreak>) => patch(r.dayOfWeek, { breaks: r.breaks.map((x, k) => (k === idx ? { ...x, ...b } : x)) });
  const applyToAll = (src: DayHoursRow) =>
    onChange(rows.map((r) => (r.open ? { ...r, opensAt: src.opensAt, closesAt: src.closesAt, breaks: src.breaks.map((b) => ({ ...b })) } : r)));
  const openCount = rows.filter((r) => r.open).length;

  return (
    <div className="crd !gap-0 !py-1">
      {rows.map((r) => {
        const err = rowError(r);
        const day = t(DAY_LABELS_FR[r.dayOfWeek]);
        const expanded = r.open && openDay === r.dayOfWeek;
        return (
          <div key={r.dayOfWeek} className="border-b border-line last:border-b-0">
            <div className="flex items-center gap-3 py-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                onClick={() => setOpenDay(expanded ? null : r.dayOfWeek)}
                aria-expanded={expanded}
                disabled={!r.open}
              >
                <span className={`text-[1rem] font-semibold ${r.open ? '' : 'text-subtle'}`}>{day}</span>
                <span className={`flex items-center gap-1.5 text-[1rem] ${r.open ? (err ? 'text-danger' : 'text-ink') : 'text-subtle'}`}>
                  {/* Plages toujours de gauche à droite, même en arabe : « 09:00–19:00 » ne s'inverse pas. */}
                  <span dir="ltr">{r.open ? formatDayRanges(rangesFromRows([r])) : t(closedLabel)}</span>
                  {r.open && <I icon={ChevronDown} size={16} className={`text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />}
                </span>
              </button>
              <Toggle
                on={r.open}
                onChange={(v) => {
                  patch(r.dayOfWeek, { open: v });
                  setOpenDay(v ? r.dayOfWeek : null);
                }}
                label={day}
              />
            </div>
            {expanded && (
              <div className="flex flex-col gap-3 pb-4">
                <div className="g2">
                  <TimeBox label={t("Ouvre")} value={r.opensAt} onChange={(v) => patch(r.dayOfWeek, { opensAt: v })} ariaLabel={`Ouverture ${day}`} />
                  <TimeBox label={t("Ferme")} value={r.closesAt} onChange={(v) => patch(r.dayOfWeek, { closesAt: v })} ariaLabel={`Fermeture ${day}`} />
                </div>
                {r.breaks.map((b, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="g2 flex-1">
                      <TimeBox label={r.breaks.length > 1 ? t('Pause {n} · début', { n: idx + 1 }) : t('Début de pause')} value={b.from} onChange={(v) => patchBreak(r, idx, { from: v })} ariaLabel={`Début de pause ${idx + 1} ${day}`} />
                      <TimeBox label={r.breaks.length > 1 ? t('Pause {n} · fin', { n: idx + 1 }) : t('Fin de pause')} value={b.to} onChange={(v) => patchBreak(r, idx, { to: v })} ariaLabel={`Fin de pause ${idx + 1} ${day}`} />
                    </div>
                    <button type="button" className="ib flex-none" aria-label={`Supprimer la pause ${idx + 1} ${day}`} onClick={() => patch(r.dayOfWeek, { breaks: r.breaks.filter((_, k) => k !== idx) })}>
                      <I icon={X} size={16} />
                    </button>
                  </div>
                ))}
                {err && <p className="text-[0.857rem] text-danger">{err}</p>}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {r.breaks.length < MAX_BREAKS_PER_DAY && (
                    <button type="button" className="flex items-center gap-1.5 text-[1rem] font-semibold" onClick={() => patch(r.dayOfWeek, { breaks: [...r.breaks, nextBreakSuggestion(r)] })} aria-label={`Ajouter une pause ${day}`}>
                      <I icon={Plus} size={16} /> {r.breaks.length ? t('Ajouter une autre pause') : t('Ajouter une pause')}
                    </button>
                  )}
                  {openCount > 1 && !err && (
                    <button type="button" className="flex items-center gap-1.5 text-[1rem] font-semibold text-muted" onClick={() => applyToAll(r)}>
                      <I icon={Copy} size={16} /> {t('Appliquer à tous les jours ouverts')}
                    </button>
                  )}
                </div>
              </div>
            )}
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
      <StepBar step={9} backTo={settings ? '/pro/profil' : stepPath(8)} right={settings ? t('Horaires') : undefined} />
      <h1 className="h1">{t("Horaires")}</h1>
      <p className="p -mt-2">{t("Touchez un jour pour régler ses heures ou ajouter une pause, par exemple 12:00 – 14:00.")}</p>
      <WeekHoursEditor rows={rows} onChange={setRows} />
      <p className="text-[0.857rem] text-muted">{t("Semaine commençant")} {t("Dimanche").toLowerCase()} · {t("heure d'Alger")}</p>
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet label={settings ? t('Enregistrer') : t('Continuer')} onClick={() => void save()} disabled={invalid} busy={setHours.isPending} />
    </Screen>
  );
}
