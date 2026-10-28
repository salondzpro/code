/**
 * PRO-F 23 — Chiffre d'affaires : jour / semaine / mois. Refonte du 28 oct. 2026 :
 *   - l'écart avec la période précédente se dit EN DINARS (« +4 200 DA vs semaine dernière ») :
 *     un pourcentage ou un « × 29 » après une semaine presque vide ne parlait à personne ;
 *   - toucher une barre affiche ce jour-là (montant, rendez-vous) au-dessus du graphique ;
 *   - encaissé / reste à encaisser sur UNE barre partagée, chaque prestation avec sa part en jauge.
 */
import { useState } from 'react';
import { Download, TrendingDown, TrendingUp } from 'lucide-react';
import { useProStatsRange } from '@salondz/api-client';
import {
  DAY_LABELS_SHORT_FR,
  addDaysToKey,
  dayOfWeekFromKey,
  formatDA,
  toLocalDateKey,
  weekKeys,
} from '@salondz/constants';
import { I, IconButton, SectionLabel, Segmented, Skeleton, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { t } from '@/i18n';

type Period = 'day' | 'week' | 'month';
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function range(period: Period, today: string): { from: string; to: string; label: string } {
  if (period === 'day')
    return {
      from: today,
      to: today,
      label: `${Number(today.slice(8, 10))} ${t(MONTHS[Number(today.slice(5, 7)) - 1]!)}`,
    };
  if (period === 'week') {
    const days = weekKeys(today);
    const from = days[0]!;
    const to = days[6]!;
    const sameMonth = from.slice(0, 7) === to.slice(0, 7);
    return {
      from,
      to,
      label: `${Number(from.slice(8, 10))}${sameMonth ? '' : ` ${t(MONTHS[Number(from.slice(5, 7)) - 1]!)}`} – ${Number(to.slice(8, 10))} ${t(MONTHS[Number(to.slice(5, 7)) - 1]!)}`,
    };
  }
  const from = `${today.slice(0, 7)}-01`;
  const next =
    Number(today.slice(5, 7)) === 12
      ? `${Number(today.slice(0, 4)) + 1}-01-01`
      : `${today.slice(0, 4)}-${String(Number(today.slice(5, 7)) + 1).padStart(2, '0')}-01`;
  return {
    from,
    to: addDaysToKey(next, -1),
    label: `${t(MONTHS[Number(today.slice(5, 7)) - 1]!)} ${today.slice(0, 4)}`,
  };
}

export function Revenue() {
  const today = toLocalDateKey();
  const [period, setPeriod] = useState<Period>('week');
  const r = range(period, today);
  const stats = useProStatsRange(r.from, r.to);
  const prev = range(period, addDaysToKey(r.from, -1));
  const prevStats = useProStatsRange(prev.from, prev.to);
  const s = stats.data;
  // Écart en dinars avec la période précédente (rien à comparer si elle était vide).
  const diff = s && prevStats.data && prevStats.data.revenueDa > 0 ? s.revenueDa - prevStats.data.revenueDa : null;
  const prevLabel = period === 'day' ? t('vs hier') : period === 'week' ? t('vs semaine dernière') : t('vs mois dernier');
  const [picked, setPicked] = useState<string | null>(null);
  const max = Math.max(1, ...(s?.byDay.map((d) => d.revenueDa) ?? [1]));
  const exportCsv = () => {
    if (!s) return;
    const rows = [
      ['date', 'rendez-vous', 'chiffre_affaires_da'],
      ...s.byDay.map((d) => [d.date, String(d.bookings), String(d.revenueDa)]),
    ];
    const blob = new Blob([rows.map((x) => x.join(';')).join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chiffre-affaires-${r.from}-${r.to}.csv`;
    a.click();
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro" right="Accueil" />
      <div className="flex items-center justify-between">
        <h1 className="h1">{t("Chiffre d'affaires")}</h1>
        <IconButton lg aria-label={t("Exporter")} onClick={exportCsv}>
          <I icon={Download} size={20} />
        </IconButton>
      </div>
      <Segmented
        label={t("Période")}
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'day', label: t("Jour") },
          { value: 'week', label: t("Semaine") },
          { value: 'month', label: t("Mois") },
        ]}
      />
      {stats.isPending ? (
        <Skeleton className="h-[18.75rem] w-full !rounded-[var(--radius-card)]" />
      ) : stats.isError ? (
        <ErrorMessage error={stats.error} retry={() => stats.refetch()} />
      ) : (
        <>
          <div className="crd !gap-3">
            {(() => {
              // Une barre touchée prend la tête de la carte ; sinon, le total de la période.
              const d = picked ? s!.byDay.find((x) => x.date === picked) : null;
              return (
                <div>
                  <div className="text-[2.286rem] font-semibold leading-none tracking-[-1px]" dir="ltr">
                    {formatDA(d ? d.revenueDa : s!.revenueDa)}
                  </div>
                  <div className="p mt-2">
                    {d
                      ? `${t(DAY_LABELS_SHORT_FR[dayOfWeekFromKey(d.date)])} ${Number(d.date.slice(8, 10))}`
                      : r.label}{' '}
                    · {t('{n} rendez-vous', { n: d ? d.bookings : s!.bookings })}
                  </div>
                  {!d && diff != null && diff !== 0 && (
                    <div className={`rv-diff ${diff > 0 ? 'up' : 'down'}`}>
                      <I icon={diff > 0 ? TrendingUp : TrendingDown} size={15} />
                      <span dir="ltr">
                        {diff > 0 ? '+' : '−'}
                        {formatDA(Math.abs(diff))}
                      </span>{' '}
                      <span className="font-normal text-muted">{prevLabel}</span>
                    </div>
                  )}
                </div>
              );
            })()}
            {period !== 'day' && (
              <div className="flex items-end gap-2" style={{ height: 210 }}>
                {s!.byDay.map((d) => {
                  const isToday = d.date === today;
                  const h = Math.max(6, Math.round((d.revenueDa / max) * 170));
                  return (
                    <button
                      type="button"
                      key={d.date}
                      className="flex flex-1 flex-col items-center justify-end gap-2"
                      style={{ minWidth: 0 }}
                      aria-pressed={picked === d.date}
                      aria-label={`${d.date} · ${formatDA(d.revenueDa)}`}
                      onClick={() => setPicked((x) => (x === d.date ? null : d.date))}
                    >
                      <div
                        className={`rv-bar w-full rounded-[var(--radius-card-sm)] ${picked === d.date ? 'bg-ink' : picked ? 'bg-line' : isToday ? 'bg-ink' : 'bg-line'}`}
                        style={{ height: h }}
                      />
                      {period === 'week' ? (
                        <span
                          className={`text-[1rem] ${isToday ? 'font-bold' : 'text-muted'}`}
                        >
                          {t(DAY_LABELS_SHORT_FR[dayOfWeekFromKey(d.date)])}
                        </span>
                      ) : (
                        (Number(d.date.slice(8, 10)) % 5 === 1 || isToday) && (
                          <span
                            className={`text-[0.857rem] ${isToday ? 'font-bold' : 'text-muted'}`}
                          >
                            {Number(d.date.slice(8, 10))}
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {(() => {
            const sum = s!.collectedDa + s!.remainingDa;
            const pct = sum > 0 ? (s!.collectedDa / sum) * 100 : 0;
            return (
              <div className="crd !gap-2.5">
                <div className="rv-split" role="img" aria-label={t('Encaissé')}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="flex items-center gap-1.5 text-[0.857rem] text-muted">
                      <span className="rv-dot on" /> {t('Encaissé')}
                    </span>
                    <span className="block text-[1.143rem] font-semibold" dir="ltr">{formatDA(s!.collectedDa)}</span>
                    <span className="block text-[0.786rem] text-muted">{t('Rendez-vous terminés')}</span>
                  </div>
                  <div className="text-end">
                    <span className="flex items-center justify-end gap-1.5 text-[0.857rem] text-muted">
                      <span className="rv-dot" /> {t('Reste à encaisser')}
                    </span>
                    <span className="block text-[1.143rem] font-semibold" dir="ltr">{formatDA(s!.remainingDa)}</span>
                    <span className="block text-[0.786rem] text-muted">
                      {t('{n} rendez-vous à venir', { n: s!.remainingCount })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
          <SectionLabel>{t("Par prestation")}</SectionLabel>
          <div className="crd !gap-0 !py-1">
            {s!.byService.length === 0 && (
              <p className="p py-3">{t("Aucune prestation sur la période.")}</p>
            )}
            {s!.byService.map((x) => {
              const part = s!.revenueDa > 0 ? Math.round((x.revenueDa / s!.revenueDa) * 100) : 0;
              return (
                <div key={x.name} className="li !flex-col !items-stretch !gap-1.5">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[1rem] font-semibold">{x.name}</span>
                    <span className="flex-none text-[1rem] font-semibold" dir="ltr">{formatDA(x.revenueDa)}</span>
                  </span>
                  <span className="flex items-center gap-2.5">
                    <span className="rv-gauge" aria-hidden>
                      <span style={{ width: `${Math.max(2, part)}%` }} />
                    </span>
                    <span className="w-[6.5rem] flex-none text-end text-[0.786rem] text-muted">
                      {part} % · {t('{n} RDV', { n: x.bookings })}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Screen>
  );
}
