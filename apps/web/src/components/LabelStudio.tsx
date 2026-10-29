/**
 * ATELIER D'ÉTIQUETTES (29 oct. 2026) — partagé par l'espace pro (`/pro/qr`) et l'administration
 * (`/admin/etiquettes`). On choisit un format (affiche A5 ou autocollant carré) et un modèle parmi
 * ceux que la plateforme propose ; l'aperçu EST le fichier imprimé (même rendu, même résolution),
 * et « Télécharger » enregistre le PNG à 300 ppp.
 *
 * Les modèles du public du salon passent en tête (un salon pour femmes voit d'abord « Élégance » et
 * « Nude »), puis ceux qui conviennent à tous ; le modèle par défaut de la plateforme est présélectionné
 * quand il convient au salon.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, Download } from 'lucide-react';
import { LABEL_TEMPLATES, type LabelFormat, type LabelTemplateId } from '@salondz/constants';
import { LABEL_SIZES, downloadLabel, labelPng, renderLabel, type LabelInput } from '@/lib/labels';
import { Button, I, Segmented } from './ui';
import { t } from '@/i18n';

/** Deux couleurs par modèle, pour le reconnaître avant même l'aperçu. */
const SWATCH: Record<LabelTemplateId, [string, string]> = {
  elegance: ['#F5DFE7', '#B83D6E'],
  nude: ['#EADFD2', '#A47A45'],
  noir: ['#141517', '#C8A15A'],
  ardoise: ['#24323C', '#5FD0B0'],
  categorie: ['#E8EEFF', '#3C5FC4'],
  minimal: ['#FFFFFF', '#111214'],
  marque: ['#111214', '#3DDC97'],
};

export function LabelStudio({
  input,
  allowed,
  defaultId,
  filename,
}: {
  input: LabelInput;
  /** Modèles proposés (réglage de la plateforme). */
  allowed: readonly LabelTemplateId[];
  defaultId: LabelTemplateId;
  /** Début du nom de fichier (le modèle et le format sont ajoutés). */
  filename: string;
}) {
  const audience = input.audience === 'women' ? 'women' : input.audience === 'men' ? 'men' : 'all';
  const list = useMemo(() => {
    const rank = (a: string) => (a === audience ? 0 : a === 'all' ? 1 : 2);
    return LABEL_TEMPLATES.filter((x) => allowed.includes(x.id)).sort((a, b) => rank(a.audience) - rank(b.audience));
  }, [allowed, audience]);
  const initial = list.find((x) => x.id === defaultId && (x.audience === 'all' || x.audience === audience))?.id ?? list[0]?.id ?? 'minimal';
  const [tpl, setTpl] = useState<LabelTemplateId>(initial);
  const [format, setFormat] = useState<LabelFormat>('affiche');
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [rendering, setRendering] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => setTpl(initial), [initial]);

  useEffect(() => {
    let alive = true;
    setRendering(true);
    setFailed(false);
    setResult(null);
    (async () => {
      try {
        const canvas = await renderLabel(tpl, format, input);
        const blob = await labelPng(canvas);
        if (!alive) return;
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return { url: URL.createObjectURL(blob), blob };
        });
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setRendering(false);
      }
    })();
    return () => {
      alive = false;
    };
    // `input` est recréé à chaque rendu chez l'appelant : on suit son CONTENU.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl, format, input.name, input.url, input.short, input.logoUrl, (input.categoryIds ?? []).join(','), input.audience]);

  const size = LABEL_SIZES[format];
  const telecharger = async () => {
    if (!preview) return;
    setSaving(true);
    setResult(null);
    try {
      const r = await downloadLabel(preview.blob, `${filename}-${tpl}-${format}.png`);
      if (r === 'fallback') setFallback(true);
      else setResult({ ok: true, text: t('Étiquette enregistrée.') });
    } catch {
      setResult({ ok: false, text: t('L’enregistrement n’a pas abouti. Réessayez.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label={t('Format')}
        value={format}
        onChange={setFormat}
        options={[
          { value: 'affiche', label: t('Affiche A5') },
          { value: 'carre', label: t('Autocollant carré') },
        ]}
      />
      <div className="pills bleed" role="radiogroup" aria-label={t('Modèle')}>
        {list.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={tpl === m.id}
            onClick={() => setTpl(m.id)}
            className={`lbl-chip ${tpl === m.id ? 'on' : ''}`}
          >
            <span className="lbl-sw" style={{ background: SWATCH[m.id][0] }} aria-hidden>
              <span style={{ background: SWATCH[m.id][1] }} />
            </span>
            <span className="min-w-0 text-start">
              <span className="block text-[0.857rem] font-semibold leading-tight">{t(m.nameFr)}</span>
              <span className="block truncate text-[0.714rem] text-muted">{t(m.hintFr)}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="lbl-stage" style={{ aspectRatio: `${size.w} / ${size.h}` }}>
        {preview && <img src={preview.url} alt={t('Aperçu de l’étiquette')} className={rendering ? 'opacity-60' : ''} />}
        {!preview && !failed && <div className="sk h-full w-full" />}
        {failed && <p className="p p-6 text-center">{t('L’aperçu n’a pas pu être dessiné. Rechargez la page.')}</p>}
      </div>
      <p className="text-center text-[0.786rem] text-muted" dir="ltr">
        PNG · {size.w} × {size.h} px · 300 ppp · {size.mm}
      </p>

      <Button onClick={() => void telecharger()} loading={saving} disabled={!preview || rendering}>
        <I icon={result?.ok ? Check : Download} size={18} /> {t('Télécharger en haute qualité')}
      </Button>
      {result && (
        <p className={`text-center text-[0.857rem] ${result.ok ? 'text-ok-fg' : 'text-danger'}`} role="status">
          {result.text}
        </p>
      )}
      {fallback && preview && (
        <p className="rounded-[var(--radius-card)] border border-line bg-surface p-3 text-[0.857rem]" role="status">
          {t('Pour l’enregistrer sur ce téléphone : appuyez longuement sur l’aperçu, puis « Enregistrer l’image ». La prochaine mise à jour de l’application le fera en un geste.')}
        </p>
      )}
    </div>
  );
}
