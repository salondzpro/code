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
import { Check, Scissors, X } from 'lucide-react';
import { useProSalon, useProSalonMutations, useProServiceMutations } from '@salondz/api-client';
import { SERVICE_TEMPLATES, categoriesForMarket, categoryLabel, type CategoryId, type Market } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { BottomSheet, Button, Dim, Field, I, Input } from '@/components/ui';
import { ICONE } from '@/lib/actionIcons';
import { PageLoading } from '@/components/PageLoading';
import { errorText } from '@/components/ErrorMessage';
import { clearProDraft } from '@/lib/proDraft';
import { StepBar, StepSheet, StepTitle } from './Shared';
import { t } from '@/i18n';

type Row = { key: string; name: string; minutes: number; priceDa: number; categoryId: CategoryId; on: boolean; custom?: boolean };

/** Durées proposées (minutes) : celles du métier, d'un toucher. */
const DUREES = [10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

/** Cochées d'office : les deux premières de chaque spécialité, six au plus en tout. */
const PRECHECK_PER_CATEGORY = 2;
const PRECHECK_MAX = 6;

export function StepServices() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const { create } = useProServiceMutations();
  const { updateSalon } = useProSalonMutations();
  const [edits, setEdits] = useState<Record<string, Partial<Row>>>({});
  // Prestations PERSONNALISÉES ajoutées à l'inscription (20 nov. 2026, demande du propriétaire).
  const [customs, setCustoms] = useState<Row[]>([]);
  const [ajout, setAjout] = useState(false);
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
  const rows = [...base, ...customs].map((r) => ({ ...r, ...edits[r.key] }));
  const chosen = rows.filter((r) => r.on && r.priceDa > 0);
  const set = (key: string, patch: Partial<Row>) => setEdits((e) => ({ ...e, [key]: { ...e[key], ...patch } }));
  const groups = [...new Set(rows.map((r) => r.categoryId))];
  const cats = salon.categoryIds as CategoryId[];

  const goLive = async () => {
    setError(null);
    setBusy(true);
    try {
      // EN PARALLÈLE (22 nov. 2026, audit : une à une, la mise en ligne prenait plusieurs secondes sur
      // un réseau lent) ; l'ordre du catalogue suit celui de la liste grâce à `sortOrder`.
      const base0 = salon.services.length;
      const aCreer = chosen.filter((r) => !salon.services.some((s) => s.name.toLowerCase() === r.name.toLowerCase()));
      await Promise.all(
        aCreer.map((r, i) =>
          create.mutateAsync({ name: r.name, durationMinutes: r.minutes, priceDa: r.priceDa, categoryId: r.categoryId, isActive: true, sortOrder: base0 + i }),
        ),
      );
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
                      <b className="block truncate">{r.custom ? r.name : t(r.name)}</b>
                    </span>
                  </button>
                  <select
                    className="obs-d"
                    value={r.minutes}
                    aria-label={`${t('Durée')} · ${r.custom ? r.name : t(r.name)}`}
                    onChange={(e) => set(r.key, { minutes: Number(e.target.value), on: true })}
                  >
                    {[...new Set([...DUREES, r.minutes])].sort((a, b) => a - b).map((m) => (
                      <option key={m} value={m}>
                        {formatDuration(m)}
                      </option>
                    ))}
                  </select>
                  <label className="obs-p" dir="ltr">
                    <input
                      inputMode="numeric"
                      value={r.priceDa || ''}
                      aria-label={`${t('Prix')} · ${t(r.name)}`}
                      onChange={(e) => set(r.key, { priceDa: Math.min(1_000_000, Number(e.target.value.replace(/\D/g, '')) || 0), on: true })}
                    />
                    <span>DA</span>
                  </label>
                  {r.custom && (
                    <button type="button" className="obs-x" aria-label={`${t('Retirer')} · ${r.name}`} onClick={() => setCustoms((c) => c.filter((x) => x.key !== r.key))}>
                      <I icon={X} size={16} />
                    </button>
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}

      <Button variant="g" icon={ICONE.ajouter} onClick={() => setAjout(true)}>
        {t('Ajouter une prestation')}
      </Button>
      {ajout && (
        <AjoutPrestation
          cats={cats}
          onClose={() => setAjout(false)}
          onAdd={(r) => {
            setCustoms((c) => [...c, { ...r, key: `custom:${Date.now()}`, on: true, custom: true }]);
            setAjout(false);
          }}
        />
      )}

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

/** Fenêtre « Ajouter une prestation » : nom, durée, prix, et la spécialité si le salon en a plusieurs. */
function AjoutPrestation({
  cats,
  onClose,
  onAdd,
}: {
  cats: CategoryId[];
  onClose: () => void;
  onAdd: (r: { name: string; minutes: number; priceDa: number; categoryId: CategoryId }) => void;
}) {
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [prix, setPrix] = useState('');
  const [cat, setCat] = useState<CategoryId>(cats[0]!);
  const priceDa = Math.min(1_000_000, Number(prix.replace(/\D/g, '')) || 0);
  const ok = name.trim().length >= 2 && priceDa > 0;
  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal>
        <div className="flex flex-col gap-3">
          <b className="text-[1.143rem]">{t('Nouvelle prestation')}</b>
          <Field label={t('Nom')} htmlFor="ob-sv-n">
            <Input id="ob-sv-n" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Ex. Coupe + brushing')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Durée')} htmlFor="ob-sv-d">
              <select id="ob-sv-d" className="inp" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {DUREES.map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('Prix (DA)')} htmlFor="ob-sv-p">
              <Input id="ob-sv-p" inputMode="numeric" dir="ltr" value={prix} onChange={(e) => setPrix(e.target.value.replace(/\D/g, ''))} placeholder="1500" />
            </Field>
          </div>
          {cats.length > 1 && (
            <Field label={t('Spécialité')} htmlFor="ob-sv-c">
              <select id="ob-sv-c" className="inp" value={cat} onChange={(e) => setCat(e.target.value as CategoryId)}>
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {t(categoryLabel(c))}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Button icon={ICONE.ajouter} disabled={!ok} onClick={() => onAdd({ name: name.trim(), minutes, priceDa, categoryId: cat })}>
            {t('Ajouter')}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
