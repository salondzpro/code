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
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { FacebookLogo, InstagramLogo, SnapchatLogo, TikTokLogo } from './BrandIcons';
import {
  LABEL_COLORS,
  LABEL_TAGLINE_MAX,
  LABEL_TEXTS,
  normalizeLabelStyle,
  type LabelFont,
  type LabelLocale,
  type LabelStyle,
  LABEL_SOCIAL_MAX,
  LABEL_SOCIAL_NAMES,
  LABEL_TEMPLATES,
  normalizeLabelSocials,
  type LabelFormat,
  type LabelSocial,
  type LabelSocialId,
  type LabelTemplateId,
} from '@salondz/constants';
import { LABEL_SIZES, downloadLabel, labelPng, renderLabel, type LabelInput } from '@/lib/labels';
import { Button, I, Segmented, Toggle } from './ui';
import { t } from '@/i18n';

export function LabelStudio({
  input,
  allowed,
  defaultId,
  filename,
  socials: initialSocials,
  onSaveSocials,
  style: initialStyle,
  onSaveStyle,
}: {
  input: LabelInput;
  /** Réseaux enregistrés pour le salon (modèle « Vitrine noire »). */
  socials?: LabelSocial[];
  /** Enregistre les réseaux ; absent (administration) : modifiables pour l'aperçu seulement. */
  onSaveSocials?: (s: LabelSocial[]) => Promise<unknown>;
  /** Langue, couleur, style et phrase enregistrés pour le salon (« Vitrine noire »). */
  style?: LabelStyle;
  onSaveStyle?: (s: LabelStyle) => Promise<unknown>;
  /** Modèles proposés (réglage de la plateforme). */
  allowed: readonly LabelTemplateId[];
  defaultId: LabelTemplateId;
  /** Début du nom de fichier (le modèle et le format sont ajoutés). */
  filename: string;
}) {
  const audience = input.audience === 'women' ? 'women' : input.audience === 'men' ? 'men' : 'all';
  const list = useMemo(() => {
    // « Vitrine noire » en tête, puis les modèles du public du salon, puis ceux pour tous.
    const rank = (x: (typeof LABEL_TEMPLATES)[number]) => (x.id === 'vitrine' ? -1 : x.audience === audience ? 0 : x.audience === 'all' ? 1 : 2);
    return LABEL_TEMPLATES.filter((x) => allowed.includes(x.id)).sort((a, b) => rank(a) - rank(b));
  }, [allowed, audience]);
  const initial = list.find((x) => x.id === defaultId)?.id ?? list[0]?.id ?? 'vitrine';
  const [format, setFormat] = useState<LabelFormat>('affiche');
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [rendering, setRendering] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [fallback, setFallback] = useState(false);


  // Réseaux : saisie locale immédiate, aperçu redessiné après une courte pause de frappe.
  const [socials, setSocials] = useState<LabelSocial[]>(() => normalizeLabelSocials(initialSocials));
  // Les réseaux enregistrés arrivent UNE fois par salon (`filename` le désigne) : après, la saisie
  // locale fait foi — sinon chaque enregistrement réécrasait le champ voisin en cours de frappe.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!initialSocials || loadedFor.current === filename) return;
    loadedFor.current = filename;
    setSocials(normalizeLabelSocials(initialSocials));
  }, [initialSocials, filename]);
  const [drawnSocials, setDrawnSocials] = useState(socials);
  useEffect(() => {
    const id = window.setTimeout(() => setDrawnSocials(socials), 350);
    return () => window.clearTimeout(id);
  }, [socials]);
  // Sans réglage enregistré, l'affiche part du modèle par défaut de la plateforme.
  const presetLook = (id: LabelTemplateId, base: LabelStyle): LabelStyle => {
    const p = LABEL_TEMPLATES.find((x) => x.id === id)?.preset;
    return p ? { ...base, color: p.color, font: p.font, decor: p.decor } : base;
  };
  const [look, setLook] = useState<LabelStyle>(() =>
    initialStyle ? normalizeLabelStyle(initialStyle) : presetLook(initial, normalizeLabelStyle(null)),
  );
  const styleFor = useRef<string | null>(null);
  const lookTouched = useRef(false);
  useEffect(() => {
    if (!initialStyle || styleFor.current === filename) return;
    styleFor.current = filename;
    const v = normalizeLabelStyle(initialStyle);
    // Réglage jamais enregistré (valeurs d'origine) : on garde le modèle par défaut.
    const vierge = JSON.stringify(v) === JSON.stringify(normalizeLabelStyle(null));
    setLook(vierge ? presetLook(initial, v) : v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStyle, filename]);
  /** Le modèle affiché est celui dont la couleur et le style correspondent ; sinon « personnalisé ». */
  const tpl: LabelTemplateId | null =
    LABEL_TEMPLATES.find((x) => x.preset.color === look.color && x.preset.font === look.font && x.preset.decor === look.decor)?.id ?? null;
  const choisir = (id: LabelTemplateId) => {
    lookTouched.current = true;
    setLook((l) => presetLook(id, l));
  };
  const [drawnLook, setDrawnLook] = useState(look);
  useEffect(() => {
    const id = window.setTimeout(() => setDrawnLook(look), 350);
    return () => window.clearTimeout(id);
  }, [look]);
  const socialsKey = JSON.stringify([drawnSocials, drawnLook]);

  useEffect(() => {
    let alive = true;
    setRendering(true);
    setFailed(false);
    setResult(null);
    (async () => {
      try {
        const canvas = await renderLabel(tpl ?? 'vitrine', format, { ...input, socials: drawnSocials, style: drawnLook });
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
  }, [format, input.name, input.url, input.short, input.logoUrl, (input.categoryIds ?? []).join(','), input.audience, socialsKey]);

  const size = LABEL_SIZES[format];
  const telecharger = async () => {
    if (!preview) return;
    setSaving(true);
    setResult(null);
    try {
      const r = await downloadLabel(preview.blob, `${filename}-${tpl ?? 'perso'}-${format}.png`);
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
            onClick={() => choisir(m.id)}
            className={`lbl-chip ${tpl === m.id ? 'on' : ''}`}
          >
            <span className="lbl-sw" style={{ background: m.preset.color }} aria-hidden>
              <span style={{ background: m.preset.color === '#FFFFFF' || m.preset.color === '#F4D9E1' ? '#111214' : '#FFFFFF' }} />
            </span>
            <span className="min-w-0 text-start">
              <span className="block text-[0.857rem] font-semibold leading-tight">{t(m.nameFr)}</span>
              <span className="block truncate text-[0.714rem] text-muted">{t(m.hintFr)}</span>
            </span>
          </button>
        ))}
      </div>

      <StyleEditor value={look} onChange={setLook} onSave={onSaveStyle} touchedRef={lookTouched} />
      <SocialsEditor value={socials} onChange={setSocials} onSave={onSaveSocials} />

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

const SOCIAL_ICONS: Record<LabelSocialId, (p: { size?: number }) => React.ReactElement> = { instagram: InstagramLogo, facebook: FacebookLogo, snapchat: SnapchatLogo, tiktok: TikTokLogo };
const PLACEHOLDER: Record<LabelSocialId, string> = {
  instagram: '@votrecompte',
  facebook: 'Nom de la page',
  snapchat: 'votrecompte',
  tiktok: '@votrecompte',
};

/**
 * Réseaux imprimés en bas de la « Vitrine noire » : un nom par réseau et un interrupteur « Afficher ».
 * Enregistré en quittant le champ ou en basculant l'interrupteur (comme les notes d'une fiche
 * client), avec l'état sur la ligne même.
 */
function SocialsEditor({
  value,
  onChange,
  onSave,
}: {
  value: LabelSocial[];
  onChange: (v: LabelSocial[]) => void;
  onSave?: (v: LabelSocial[]) => Promise<unknown>;
}) {
  const [state, setState] = useState<Partial<Record<LabelSocialId, 'saving' | 'saved' | 'error'>>>({});
  const saved = useRef(JSON.stringify(value));

  const persist = async (next: LabelSocial[], id: LabelSocialId) => {
    if (!onSave) return;
    const key = JSON.stringify(next);
    if (key === saved.current) return;
    setState((s) => ({ ...s, [id]: 'saving' }));
    try {
      await onSave(next);
      saved.current = key;
      setState((s) => ({ ...s, [id]: 'saved' }));
    } catch {
      setState((s) => ({ ...s, [id]: 'error' }));
    }
  };
  const patch = (id: LabelSocialId, p: Partial<LabelSocial>) => value.map((x) => (x.id === id ? { ...x, ...p } : x));

  return (
    <section className="crd !gap-0 !py-1" aria-label={t('Vos réseaux sur l’affiche')}>
      <div className="px-3 pb-1 pt-2">
        <span className="block text-[1rem] font-semibold">{t('Vos réseaux sur l’affiche')}</span>
        <span className="p block text-[0.857rem]">{t('Saisissez vos comptes, puis choisissez ceux qui figurent sur l’affiche.')}</span>
      </div>
      {value.map((sx) => {
        const st = state[sx.id];
        const Logo = SOCIAL_ICONS[sx.id];
        return (
          <div key={sx.id} className="li !gap-3">
            <span className="flex-none" aria-hidden>
              <Logo size={28} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[0.786rem] font-medium text-muted">{LABEL_SOCIAL_NAMES[sx.id]}</span>
              <input
                className="inp !py-2"
                dir="ltr"
                value={sx.handle}
                maxLength={LABEL_SOCIAL_MAX}
                placeholder={t(PLACEHOLDER[sx.id])}
                aria-label={t('Compte {name}', { name: LABEL_SOCIAL_NAMES[sx.id] })}
                onChange={(e) => {
                  const handle = e.target.value;
                  // Saisir un nom l'affiche d'office ; le vider le retire.
                  onChange(patch(sx.id, { handle, shown: handle.trim() ? sx.shown || !sx.handle.trim() : false }));
                  setState((s) => ({ ...s, [sx.id]: undefined }));
                }}
                onBlur={() => void persist(value, sx.id)}
              />
              {st === 'error' && <span className="text-[0.786rem] text-danger">{t('Non enregistré. Réessayez.')}</span>}
            </span>
            <span className="flex w-[1.25rem] flex-none justify-center" aria-live="polite">
              {st === 'saving' && <I icon={Loader2} size={16} className="animate-spin text-muted" />}
              {st === 'saved' && <I icon={Check} size={16} className="text-ok-fg" />}
            </span>
            <Toggle
              on={sx.shown}
              disabled={!sx.handle.trim()}
              label={t('Afficher {name} sur l’affiche', { name: LABEL_SOCIAL_NAMES[sx.id] })}
              onChange={(on) => {
                const next = patch(sx.id, { shown: on });
                onChange(next);
                void persist(next, sx.id);
              }}
            />
          </div>
        );
      })}
    </section>
  );
}

const LOCALE_OPTIONS: { value: LabelLocale; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
];

/**
 * Langue de l'affiche, couleur du fond, style typographique et phrase sous « Réservation RDV ».
 * L'aperçu suit chaque geste ; l'enregistrement part une seconde après le dernier changement,
 * avec son état sous la carte.
 */
function StyleEditor({
  value,
  onChange,
  onSave,
  touchedRef,
}: {
  value: LabelStyle;
  onChange: (v: LabelStyle) => void;
  onSave?: (v: LabelStyle) => Promise<unknown>;
  /** Partagé avec le choix du modèle, qui est aussi un geste de la personne. */
  touchedRef: { current: boolean };
}) {
  const [state, setState] = useState<'saving' | 'saved' | 'error' | null>(null);
  // N'enregistre que les gestes de la personne : l'arrivée des réglages du serveur n'en est pas un.
  const touched = touchedRef;
  const saved = useRef('');
  const key = JSON.stringify(value);
  useEffect(() => {
    if (!onSave || !touched.current || key === saved.current) return;
    const id = window.setTimeout(async () => {
      setState('saving');
      try {
        await onSave(value);
        saved.current = key;
        setState('saved');
      } catch {
        setState('error');
      }
    }, 900);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = (p: Partial<LabelStyle>) => {
    touched.current = true;
    setState(null);
    onChange({ ...value, ...p });
  };
  const custom = !LABEL_COLORS.some((c) => c.hex === value.color);

  return (
    <section className="crd !gap-3" aria-label={t('Personnaliser l’affiche')}>
      <span className="block text-[1rem] font-semibold">{t('Personnaliser l’affiche')}</span>

      <div className="flex flex-col gap-1.5">
        <span className="text-[0.786rem] font-medium text-muted">{t('Langue de l’affiche')}</span>
        <Segmented label={t('Langue de l’affiche')} value={value.locale} onChange={(locale) => set({ locale })} options={LOCALE_OPTIONS} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[0.786rem] font-medium text-muted">{t('Couleur du fond')}</span>
        <div className="pills bleed" role="radiogroup" aria-label={t('Couleur du fond')}>
          {LABEL_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={value.color === c.hex}
              aria-label={t(c.nameFr)}
              title={t(c.nameFr)}
              onClick={() => set({ color: c.hex })}
              className={`lbl-color ${value.color === c.hex ? 'on' : ''}`}
              style={{ background: c.hex }}
            />
          ))}
          <label className={`lbl-color lbl-color-custom ${custom ? 'on' : ''}`} title={t('Autre couleur')} style={custom ? { background: value.color } : undefined}>
            <input
              type="color"
              value={value.color.toLowerCase()}
              aria-label={t('Autre couleur')}
              onChange={(e) => set({ color: e.target.value.toUpperCase() })}
            />
            {!custom && <span aria-hidden>+</span>}
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[0.786rem] font-medium text-muted">{t('Style')}</span>
        <Segmented<LabelFont>
          label={t('Style')}
          value={value.font}
          onChange={(font) => set({ font })}
          options={[
            { value: 'moderne', label: t('Moderne') },
            { value: 'elegant', label: t('Élégant') },
            { value: 'capitales', label: t('Capitales') },
          ]}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.857rem] font-medium">{t('Éclats décoratifs')}</span>
        <Toggle on={value.decor} onChange={(decor) => set({ decor })} label={t('Éclats décoratifs')} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.786rem] font-medium text-muted">{t('Phrase sous « Réservation RDV »')}</span>
        <input
          className="inp !py-2"
          dir="auto"
          value={value.tagline}
          maxLength={LABEL_TAGLINE_MAX}
          placeholder={LABEL_TEXTS[value.locale].tagline}
          onChange={(e) => set({ tagline: e.target.value })}
        />
        <span className="flex justify-between text-[0.714rem] text-muted">
          <span>{t('Vide : la phrase d’origine, dans la langue de l’affiche.')}</span>
          <span dir="ltr">
            {value.tagline.length}/{LABEL_TAGLINE_MAX}
          </span>
        </span>
      </label>

      {state && (
        <p className={`flex items-center gap-1.5 text-[0.786rem] ${state === 'error' ? 'text-danger' : state === 'saved' ? 'text-ok-fg' : 'text-muted'}`} role="status">
          {state === 'saving' && <I icon={Loader2} size={14} className="animate-spin" />}
          {state === 'saved' && <I icon={Check} size={14} />}
          {state === 'saving' ? t('Enregistrement…') : state === 'saved' ? t('Personnalisation enregistrée.') : t('Non enregistré. Réessayez.')}
        </p>
      )}
    </section>
  );
}
