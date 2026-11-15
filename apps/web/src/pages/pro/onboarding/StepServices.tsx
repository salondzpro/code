/**
 * INSCRIPTION PRO — écran 3 sur 3 (15 nov. 2026) : « Vos prestations ». La liste est DÉJÀ remplie avec
 * les prestations courantes du métier en Algérie (`SERVICE_TEMPLATES` : nom, durée, prix en DA), les
 * plus demandées cochées d'office. Le professionnel décoche, corrige un prix d'un toucher, et met son
 * salon EN LIGNE : prestations créées, page publiée (horaires du samedi au jeudi 9 h – 19 h posés à la
 * création, vendredi fermé ; créneaux et règles par défaut). Photos, description, horaires et règles se
 * règlent plus tard, depuis l'espace pro — rien de tout cela n'empêche de recevoir des réservations.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Scissors } from 'lucide-react';
import { useProSalon, useProSalonMutations, useProServiceMutations } from '@salondz/api-client';
import { SERVICE_TEMPLATES, categoriesForMarket, categoryLabel, type CategoryId, type Market } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { I } from '@/components/ui';
import { PageLoading } from '@/components/PageLoading';
import { errorText } from '@/components/ErrorMessage';
import { clearProDraft } from '@/lib/proDraft';
import { StepBar, StepSheet, StepTitle } from './Shared';
import { t } from '@/i18n';

type Row = { key: string; name: string; minutes: number; priceDa: number; categoryId: CategoryId; on: boolean };

/** Cochées d'office : les deux premières de chaque spécialité, six au plus en tout. */
const PRECHECK_PER_CATEGORY = 2;
const PRECHECK_MAX = 6;

export function StepServices() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { create } = useProServiceMutations();
  const { updateSalon } = useProSalonMutations();
  const [edits, setEdits] = useState<Record<string, Partial<Row>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = useMemo<Row[]>(() => {
    if (!salon) return [];
    const out: Row[] = [];
    const seen = new Set<string>();
    let checked = 0;
    // Dans l'ordre du métier (coiffure avant barbe), pas dans l'ordre alphabétique des identifiants.
    const order = categoriesForMarket((salon.genderTarget === 'women' ? 'women' : 'men') as Market).map((c) => c.id as string);
    const cats = [...salon.categoryIds].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    for (const cat of cats) {
      let n = 0;
      for (const tpl of SERVICE_TEMPLATES[cat as CategoryId] ?? []) {
        if (seen.has(tpl.name)) continue;
        seen.add(tpl.name);
        const on = n < PRECHECK_PER_CATEGORY && checked < PRECHECK_MAX;
        if (on) checked++;
        n++;
        out.push({ key: `${cat}:${tpl.name}`, name: tpl.name, minutes: tpl.minutes, priceDa: tpl.priceDa, categoryId: cat as CategoryId, on });
      }
    }
    return out;
  }, [salon]);

  if (!salon) return <PageLoading />;
  const rows = base.map((r) => ({ ...r, ...edits[r.key] }));
  const chosen = rows.filter((r) => r.on && r.priceDa > 0);
  const set = (key: string, patch: Partial<Row>) => setEdits((e) => ({ ...e, [key]: { ...e[key], ...patch } }));
  const groups = [...new Set(rows.map((r) => r.categoryId))];

  const goLive = async () => {
    setError(null);
    setBusy(true);
    try {
      // Une à une : l'ordre du catalogue suit celui de la liste.
      for (const r of chosen)
        if (!salon.services.some((s) => s.name.toLowerCase() === r.name.toLowerCase()))
          await create.mutateAsync({ name: r.name, durationMinutes: r.minutes, priceDa: r.priceDa, categoryId: r.categoryId, isActive: true });
      if (!salon.isPublished) await updateSalon.mutateAsync({ isPublished: true });
      clearProDraft();
      navigate('/pro', { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={14}>
      <StepBar step={3} backTo={undefined} />
      <StepTitle icon={Scissors}>
        {t('Vos prestations')}
      </StepTitle>

      {groups.map((cat) => (
        <section key={cat} className="flex flex-col gap-2">
          <span className="h3 px-1">{t(categoryLabel(cat))}</span>
          <div className="lst obs">
            {rows
              .filter((r) => r.categoryId === cat)
              .map((r) => (
                <div key={r.key} className={`obs-r${r.on ? ' on' : ''}`}>
                  <button type="button" className="obs-t" role="checkbox" aria-checked={r.on} onClick={() => set(r.key, { on: !r.on })}>
                    <span className="obs-c" aria-hidden>
                      {r.on && <I icon={Check} size={14} strokeWidth={2.8} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{t(r.name)}</b>
                      <small>{formatDuration(r.minutes)}</small>
                    </span>
                  </button>
                  <label className="obs-p" dir="ltr">
                    <input
                      inputMode="numeric"
                      value={r.priceDa || ''}
                      aria-label={`${t('Prix')} · ${t(r.name)}`}
                      onChange={(e) => set(r.key, { priceDa: Math.min(1_000_000, Number(e.target.value.replace(/\D/g, '')) || 0), on: true })}
                    />
                    <span>DA</span>
                  </label>
                </div>
              ))}
          </div>
        </section>
      ))}

      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <StepSheet
        label={chosen.length ? t('Mettre mon salon en ligne') : t('Choisissez au moins une prestation')}
        disabled={chosen.length === 0}
        busy={busy}
        onClick={() => void goLive()}
      />
    </Screen>
  );
}
