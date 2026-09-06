/** PRO-F 23 — Chiffre d'affaires : jour / semaine / mois, barres par jour, encaissé / reste, par prestation. */
import { useState } from 'react';
import { Download } from 'lucide-react';
import { useProStatsRange } from '@salondz/api-client';
import { DAY_LABELS_SHORT_FR, addDaysToKey, dayOfWeekFromKey, formatDA, toLocalDateKey, weekKeys } from '@salondz/constants';
import { Badge, I, IconButton, SectionLabel, Segmented, Skeleton } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';

type Period = 'day' | 'week' | 'month';
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function range(period: Period, today: string): { from: string; to: string; label: string } {
  if (period === 'day') return { from: today, to: today, label: `${Number(today.slice(8, 10))} ${MONTHS[Number(today.slice(5, 7)) - 1]}` };
  if (period === 'week') {
    const days = weekKeys(today);
    const from = days[0]!;
    const to = days[6]!;
    const sameMonth = from.slice(0, 7) === to.slice(0, 7);
    return { from, to, label: `${Number(from.slice(8, 10))}${sameMonth ? '' : ` ${MONTHS[Number(from.slice(5, 7)) - 1]}`} – ${Number(to.slice(8, 10))} ${MONTHS[Number(to.slice(5, 7)) - 1]}` };
  }
  const from = `${today.slice(0, 7)}-01`;
  const next = Number(today.slice(5, 7)) === 12 ? `${Number(today.slice(0, 4)) + 1}-01-01` : `${today.slice(0, 4)}-${String(Number(today.slice(5, 7)) + 1).padStart(2, '0')}-01`;
  return { from, to: addDaysToKey(next, -1), label: `${MONTHS[Number(today.slice(5, 7)) - 1]} ${today.slice(0, 4)}` };
}

export function Revenue() {
  const today = toLocalDateKey();
  const [period, setPeriod] = useState<Period>('week');
  const r = range(period, today);
  const stats = useProStatsRange(r.from, r.to);
  const prev = range(period, addDaysToKey(r.from, -1));
  const prevStats = useProStatsRange(prev.from, prev.to);
  const s = stats.data;
  const delta = s && prevStats.data && prevStats.data.revenueDa > 0 ? Math.round(((s.revenueDa - prevStats.data.revenueDa) / prevStats.data.revenueDa) * 100) : null;
  const max = Math.max(1, ...(s?.byDay.map((d) => d.revenueDa) ?? [1]));
  const exportCsv = () => {
    if (!s) return;
    const rows = [['date', 'rendez-vous', 'chiffre_affaires_da'], ...s.byDay.map((d) => [d.date, String(d.bookings), String(d.revenueDa)])];
    const blob = new Blob([rows.map((x) => x.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chiffre-affaires-${r.from}-${r.to}.csv`;
    a.click();
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <div className="flex items-center justify-between">
        <h1 className="h1 !text-[34px]">Chiffre d'affaires</h1>
        <IconButton lg aria-label="Exporter" onClick={exportCsv}>
          <I icon={Download} size={20} />
        </IconButton>
      </div>
      <Segmented
        label="Période"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'day', label: 'Jour' },
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
        ]}
      />
      {stats.isPending ? (
        <Skeleton className="h-[300px] w-full !rounded-[20px]" />
      ) : stats.isError ? (
        <ErrorMessage error={stats.error} retry={() => stats.refetch()} />
      ) : (
        <>
          <div className="crd !gap-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[38px] font-bold leading-none tracking-[-1px]">{formatDA(s!.revenueDa)}</div>
                <div className="p mt-2">
                  {r.label} · {s!.bookings} rendez-vous
                </div>
              </div>
              {delta != null && (
                <Badge tone={delta >= 0 ? 'ok' : 'cn'} md>
                  {delta >= 0 ? '+' : ''}
                  {delta} %
                </Badge>
              )}
            </div>
            {period !== 'day' && (
              <div className="flex items-end gap-2" style={{ height: 210 }}>
                {s!.byDay.map((d) => {
                  const isToday = d.date === today;
                  const h = Math.max(6, Math.round((d.revenueDa / max) * 170));
                  return (
                    <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-2" style={{ minWidth: 0 }}>
                      <div className={`w-full rounded-[10px] ${isToday ? 'bg-ink' : 'bg-line'}`} style={{ height: h }} title={`${formatDA(d.revenueDa)} · ${d.bookings} RDV`} />
                      {period === 'week' ? <span className={`text-[15px] ${isToday ? 'font-bold' : 'text-muted'}`}>{DAY_LABELS_SHORT_FR[dayOfWeekFromKey(d.date)]}</span> : (Number(d.date.slice(8, 10)) % 5 === 1 || isToday) && <span className={`text-[12px] ${isToday ? 'font-bold' : 'text-muted'}`}>{Number(d.date.slice(8, 10))}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="crd !gap-0 !py-1">
            <div className="li !py-5">
              <span className="text-[20px]">Encaissé</span>
              <span className="text-[24px] font-bold">{formatDA(s!.collectedDa)}</span>
            </div>
            <div className="li !py-5">
              <span>
                <span className="block text-[20px]">Reste à encaisser</span>
                <span className="p block text-[16px]">
                  {s!.remainingCount} rendez-vous confirmé{s!.remainingCount > 1 ? 's' : ''}
                </span>
              </span>
              <span className="text-[24px] font-bold">{formatDA(s!.remainingDa)}</span>
            </div>
          </div>
          <SectionLabel>Par prestation</SectionLabel>
          <div className="crd !gap-0 !py-1">
            {s!.byService.length === 0 && <p className="p py-3">Aucune prestation sur la période.</p>}
            {s!.byService.map((x) => (
              <div key={x.name} className="li !py-5">
                <span>
                  <span className="block text-[21px] font-bold tracking-[-0.3px]">{x.name}</span>
                  <span className="p block text-[16px]">
                    {x.bookings} réservation{x.bookings > 1 ? 's' : ''}
                  </span>
                </span>
                <span className="text-[22px] font-bold">{formatDA(x.revenueDa)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
