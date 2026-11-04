/**
 * PRO-F 23 — Chiffre d'affaires, ouvert sur aujourd'hui. Pensé pour se lire d'un coup d'œil : un grand
 * montant, deux cases (encaissé, à encaisser), puis une ligne par prestation. Pas de pourcentage :
 * l'écart avec la période précédente se dit en dinars. Toucher une barre affiche ce jour-là.
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
import { I, IconButton, TopBar, SectionLabel, Segmented, Skeleton } from '@/components/ui';
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
  const [period, setPeriod] = useState<Period>('day');
  const r = range(period, today);
  const stats = useProStatsRange(r.from, r.to);
  const prev = range(period, addDaysToKey(r.from, -1));
  const prevStats = useProStatsRange(prev.from, prev.to);
  const s = stats.data;
  // Écart en dinars avec la période précédente (rien à comparer si elle était vide).
  const diff = s && prevStats.data && prevStats.data.revenueDa > 0 ? s.revenueDa - prevStats.data.revenueDa : null;
  const prevLabel =
    period === 'day'
      ? t("par rapport à hier")
      : period === 'week'
        ? t('par rapport à la semaine dernière')
        : t('par rapport au mois dernier');
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

  const shown = picked ? s?.byDay.find((x) => x.date === picked) : null;
  const count = shown ? shown.bookings : (s?.bookings ?? 0);
  const when = shown
    ? `${t(DAY_LABELS_SHORT_FR[dayOfWeekFromKey(shown.date)])} ${Number(shown.date.slice(8, 10))}`
    : period === 'day'
      ? null
      : r.label;

  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <TopBar
        backTo="/pro"
        title={t("Chiffre d'affaires")}
        right={
          <IconButton lg aria-label={t("Exporter")} onClick={exportCsv}>
            <I icon={Download} size={20} />
          </IconButton>
        }
      />
      <Segmented
        label={t("Période")}
        value={period}
        onChange={(v) => {
          setPeriod(v);
          setPicked(null);
        }}
        options={[
          { value: 'day', label: t("Aujourd'hui") },
          { value: 'week', label: t("Semaine") },
          { value: 'month', label: t("Mois") },
        ]}
      />
      {stats.isPending ? (
        <Skeleton className="h-[12rem] w-full !rounded-[var(--radius-card)]" />
      ) : stats.isError ? (
        <ErrorMessage error={stats.error} retry={() => stats.refetch()} />
      ) : (
        <>
          <div className="crd !gap-3">
            <div>
              <div className="text-[2.286rem] font-semibold leading-none tracking-[-1px]" dir="ltr">
                {formatDA(shown ? shown.revenueDa : s!.revenueDa)}
              </div>
              <div className="p mt-2">
                {when && `${when} · `}
                {count > 0 ? t('{n} rendez-vous', { n: count }) : t('Aucun rendez-vous')}
              </div>
              {!shown && diff != null && diff !== 0 && (
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
            {period !== 'day' && (
              <div className="flex items-end gap-1.5" style={{ height: 130 }}>
                {s!.byDay.map((d) => {
                  const isToday = d.date === today;
                  const h = Math.max(6, Math.round((d.revenueDa / max) * 100));
                  return (
                    <button
                      type="button"
                      key={d.date}
                      className="flex flex-1 flex-col items-center justify-end gap-1.5"
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
                        <span className={`text-[0.857rem] ${isToday ? 'font-semibold' : 'text-muted'}`}>
                          {t(DAY_LABELS_SHORT_FR[dayOfWeekFromKey(d.date)])}
                        </span>
                      ) : (
                        (Number(d.date.slice(8, 10)) % 5 === 1 || isToday) && (
                          <span className={`text-[0.857rem] ${isToday ? 'font-semibold' : 'text-muted'}`}>
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
          {s!.collectedDa + s!.remainingDa > 0 && (
            <div className="g2">
              <div className="crd !gap-1 !p-3.5">
                <span className="flex items-center gap-1.5 text-[1rem] text-muted">
                  <span className="rv-dot on" /> {t('Encaissé')}
                </span>
                <span className="text-[1.286rem] font-semibold" dir="ltr">{formatDA(s!.collectedDa)}</span>
              </div>
              <div className="crd !gap-1 !p-3.5">
                <span className="flex items-center gap-1.5 text-[1rem] text-muted">
                  <span className="rv-dot" /> {t('À encaisser')}
                </span>
                <span className="text-[1.286rem] font-semibold" dir="ltr">{formatDA(s!.remainingDa)}</span>
              </div>
            </div>
          )}
          {s!.byService.length > 0 && (
            <>
              <SectionLabel>{t("Par prestation")}</SectionLabel>
              <div className="crd !gap-0 !py-1">
                {s!.byService.map((x) => (
                  <div key={x.name} className="li !py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[1rem] font-semibold">
                      {x.name} <span className="font-normal text-muted">× {x.bookings}</span>
                    </span>
                    <span className="flex-none text-[1rem] font-semibold" dir="ltr">{formatDA(x.revenueDa)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
