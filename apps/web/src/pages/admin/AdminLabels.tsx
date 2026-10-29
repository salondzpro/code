/**
 * Administration — étiquettes à imprimer (29 oct. 2026).
 *
 * Deux choses, dans cet ordre :
 *   1. QUELS modèles la plateforme propose aux professionnels, et lequel est présenté d'abord
 *      (`PUT /v1/admin/label-settings`, niveau `owner`, une ligne au journal) ;
 *   2. télécharger l'étiquette d'UN professionnel, dans n'importe quel modèle — pour la lui
 *      imprimer, ou la lui envoyer quand il ne sait pas la récupérer lui-même.
 */
import { useEffect, useState } from 'react';
import { Check, Search } from 'lucide-react';
import {
  pagesItems,
  useAdminLabelSettings,
  useAdminMe,
  useAdminSalonLabelSocials,
  useAdminSalonLabelStyle,
  useAdminSalons,
  useSalon,
  useSaveLabelSettings,
} from '@salondz/api-client';
import { DEFAULT_LABEL_SETTINGS, LABEL_TEMPLATES, LABEL_TEMPLATE_IDS, type LabelTemplateId } from '@salondz/constants';
import { Button, I, Skeleton, Toggle } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { LabelStudio } from '@/components/LabelStudio';
import { ErrorMessage, errorText } from '@/components/ErrorMessage';
import { usePublicUrl } from '@/pages/pro/Link';
import { t } from '@/i18n';

const AUDIENCE: Record<string, string> = { women: 'Femmes', men: 'Hommes', all: 'Tous' };

export function AdminLabels() {
  const me = useAdminMe();
  const owner = me.data?.level === 'owner';
  const settings = useAdminLabelSettings();
  const save = useSaveLabelSettings();
  const [enabled, setEnabled] = useState<LabelTemplateId[]>([]);
  const [defaultId, setDefaultId] = useState<LabelTemplateId>(DEFAULT_LABEL_SETTINGS.defaultId);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    setEnabled(settings.data.enabled);
    setDefaultId(settings.data.defaultId);
  }, [settings.data]);

  const toggle = (id: LabelTemplateId, on: boolean) => {
    setMsg(null);
    setEnabled((cur) => {
      const next = on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id);
      if (!next.includes(defaultId) && next[0]) setDefaultId(next[0]);
      return LABEL_TEMPLATE_IDS.filter((x) => next.includes(x));
    });
  };

  const changed =
    !!settings.data &&
    (settings.data.defaultId !== defaultId || settings.data.enabled.join() !== enabled.join());

  const enregistrer = () => {
    setMsg(null);
    save.mutate(
      { enabled, defaultId },
      {
        onSuccess: () => setMsg({ ok: true, text: t('Modèles enregistrés : les professionnels les voient dès maintenant.') }),
        onError: (e) => setMsg({ ok: false, text: errorText(e) }),
      },
    );
  };

  // Étiquette d'un professionnel
  const [q, setQ] = useState('');
  const [needle, setNeedle] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setNeedle(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);
  const salons = useAdminSalons({ q: needle || undefined });
  const rows = pagesItems(salons.data).slice(0, 6);
  const [slug, setSlug] = useState<string | null>(null);
  const salon = useSalon(slug ?? '');
  const { url, short } = usePublicUrl(slug ?? '');
  const socials = useAdminSalonLabelSocials(salon.data?.id ?? null);
  const look = useAdminSalonLabelStyle(salon.data?.id ?? null);

  return (
    <Screen gap={14} width="page">
      <div>
        <h1 className="h1">{t('Étiquettes à imprimer')}</h1>
        <p className="p mt-1">{t('Les modèles proposés aux professionnels, et l’étiquette de chacun.')}</p>
      </div>

      <section className="crd !gap-0 !py-1" aria-labelledby="lbl-models">
        <div className="li !items-start">
          <span>
            <span id="lbl-models" className="block text-[1rem] font-semibold">{t('Modèles proposés')}</span>
            <span className="p block text-[0.857rem]">{t('Un professionnel ne voit que les modèles allumés. Le modèle par défaut est présenté d’abord.')}</span>
          </span>
        </div>
        {settings.isPending ? (
          <Skeleton className="m-3 h-[12rem]" />
        ) : settings.isError ? (
          <ErrorMessage error={settings.error} retry={() => void settings.refetch()} />
        ) : (
          LABEL_TEMPLATES.map((m) => {
            const on = enabled.includes(m.id);
            return (
              <div key={m.id} className="li">
                <span className="min-w-0">
                  <span className="block text-[1rem] font-semibold">
                    {t(m.nameFr)} <span className="text-[0.786rem] font-medium text-muted">· {t(AUDIENCE[m.audience]!)}</span>
                  </span>
                  <span className="p block text-[0.857rem]">{t(m.hintFr)}</span>
                </span>
                <span className="flex flex-none items-center gap-3">
                  <label className={`flex items-center gap-1.5 text-[0.857rem] ${on ? '' : 'opacity-40'}`}>
                    <input
                      type="radio"
                      name="lbl-default"
                      checked={defaultId === m.id}
                      disabled={!on || !owner}
                      onChange={() => {
                        setMsg(null);
                        setDefaultId(m.id);
                      }}
                    />
                    {t('Par défaut')}
                  </label>
                  <Toggle
                    on={on}
                    disabled={!owner || (on && enabled.length === 1)}
                    onChange={(v) => toggle(m.id, v)}
                    label={t('Proposer {name}', { name: t(m.nameFr) })}
                  />
                </span>
              </div>
            );
          })
        )}
        <div className="flex flex-col gap-2 p-3">
          {!owner && me.data && (
            <p className="text-[0.857rem] text-muted">{t('Seul un administrateur de niveau « owner » peut changer ce réglage.')}</p>
          )}
          <Button onClick={enregistrer} loading={save.isPending} disabled={!owner || !changed || enabled.length === 0}>
            <I icon={Check} size={18} /> {t('Enregistrer les modèles')}
          </Button>
          {msg && (
            <p className={`text-[0.857rem] ${msg.ok ? 'text-ok-fg' : 'text-danger'}`} role="status">
              {msg.text}
            </p>
          )}
        </div>
      </section>

      <section className="crd !gap-3" aria-labelledby="lbl-salon">
        <div>
          <span id="lbl-salon" className="block text-[1rem] font-semibold">{t('Étiquette d’un professionnel')}</span>
          <span className="p block text-[0.857rem]">{t('Tous les modèles sont disponibles ici, même ceux qui ne sont pas proposés.')}</span>
        </div>
        <label className="search">
          <I icon={Search} size={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Nom du salon')} aria-label={t('Rechercher un salon')} />
        </label>
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`lbl-chip !max-w-none justify-between ${slug === r.slug ? 'on' : ''}`}
              onClick={() => setSlug(r.slug)}
            >
              <span className="min-w-0 text-start">
                <span className="block truncate text-[1rem] font-semibold">{r.name}</span>
                <span className="block text-[0.786rem] text-muted">{r.city}</span>
              </span>
              {slug === r.slug && <I icon={Check} size={18} />}
            </button>
          ))}
        </div>
        {slug && salon.data && (
          <LabelStudio
            input={{
              name: salon.data.name,
              url,
              short,
              logoUrl: salon.data.logoUrl ?? salon.data.coverUrl,
              categoryIds: salon.data.categoryIds,
              audience: salon.data.genderTarget,
            }}
            allowed={LABEL_TEMPLATE_IDS}
            defaultId={settings.data?.defaultId ?? DEFAULT_LABEL_SETTINGS.defaultId}
            filename={`salondz-${salon.data.slug}`}
            socials={socials.data}
            style={look.data}
          />
        )}
        {slug && salon.isPending && <Skeleton className="h-[20rem] w-full" />}
      </section>
    </Screen>
  );
}
