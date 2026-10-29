/**
 * Modèles d'étiquettes proposés aux professionnels (`app_settings.label_templates`, JSON). Une
 * valeur absente, illisible ou qui citerait un modèle disparu retombe sur le réglage d'origine :
 * l'écran d'un professionnel ne doit jamais rester sans modèle.
 */
import { DEFAULT_LABEL_SETTINGS, LABEL_TEMPLATE_IDS, type LabelSettings, type LabelTemplateId } from '@salondz/constants';
import { db } from './supabase';

export const LABEL_SETTINGS_KEY = 'label_templates';

const known = (id: unknown): id is LabelTemplateId => LABEL_TEMPLATE_IDS.includes(id as LabelTemplateId);

export async function readLabelSettings(): Promise<LabelSettings> {
  const res = await db.from('app_settings').select('value').eq('key', LABEL_SETTINGS_KEY).maybeSingle();
  if (res.error || !res.data?.value) return DEFAULT_LABEL_SETTINGS;
  try {
    const v = JSON.parse(res.data.value as string) as Partial<LabelSettings>;
    const enabled = (v.enabled ?? []).filter(known);
    if (!enabled.length) return DEFAULT_LABEL_SETTINGS;
    const defaultId = known(v.defaultId) && enabled.includes(v.defaultId) ? v.defaultId : enabled[0]!;
    return { enabled, defaultId };
  } catch {
    return DEFAULT_LABEL_SETTINGS;
  }
}

export async function writeLabelSettings(s: LabelSettings): Promise<void> {
  const res = await db
    .from('app_settings')
    .upsert({ key: LABEL_SETTINGS_KEY, value: JSON.stringify(s), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (res.error) throw res.error;
}
