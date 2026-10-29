/**
 * Modèles d'étiquettes proposés aux professionnels (`app_settings.label_templates`, JSON). Une
 * valeur absente, illisible ou qui citerait un modèle disparu retombe sur le réglage d'origine :
 * l'écran d'un professionnel ne doit jamais rester sans modèle.
 */
import {
  DEFAULT_LABEL_SETTINGS,
  LABEL_TEMPLATE_IDS,
  normalizeLabelSocials,
  type LabelSettings,
  type LabelSocial,
  type LabelTemplateId,
} from '@salondz/constants';
import { db } from './supabase';

export const LABEL_SETTINGS_KEY = 'label_templates';

/** Modèles du premier lot (29 oct. 2026), d'avant le champ `seen`. */
const FIRST_TEMPLATES = ['elegance', 'nude', 'noir', 'ardoise', 'categorie', 'minimal', 'marque'];

const known = (id: unknown): id is LabelTemplateId => LABEL_TEMPLATE_IDS.includes(id as LabelTemplateId);

export async function readLabelSettings(): Promise<LabelSettings> {
  const res = await db.from('app_settings').select('value').eq('key', LABEL_SETTINGS_KEY).maybeSingle();
  if (res.error || !res.data?.value) return DEFAULT_LABEL_SETTINGS;
  try {
    const v = JSON.parse(res.data.value as string) as Partial<LabelSettings> & { seen?: string[] };
    // Un modèle ajouté APRÈS l'enregistrement du réglage est proposé d'office : l'administrateur ne
    // l'a jamais vu, il ne l'a donc pas refusé. `seen` = les modèles qui existaient à l'enregistrement.
    const seen = v.seen ?? FIRST_TEMPLATES;
    const fresh = LABEL_TEMPLATE_IDS.filter((id) => !seen.includes(id));
    const enabled = LABEL_TEMPLATE_IDS.filter((id) => (v.enabled ?? []).includes(id) || fresh.includes(id));
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
    .upsert({ key: LABEL_SETTINGS_KEY, value: JSON.stringify({ ...s, seen: LABEL_TEMPLATE_IDS }), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (res.error) throw res.error;
}

/** Réseaux sociaux imprimés sur l'étiquette « Vitrine noire », par salon. */
const socialsKey = (salonId: string) => `label_socials:${salonId}`;

export async function readLabelSocials(salonId: string): Promise<LabelSocial[]> {
  const res = await db.from('app_settings').select('value').eq('key', socialsKey(salonId)).maybeSingle();
  if (res.error || !res.data?.value) return normalizeLabelSocials([]);
  try {
    return normalizeLabelSocials(JSON.parse(res.data.value as string));
  } catch {
    return normalizeLabelSocials([]);
  }
}

export async function writeLabelSocials(salonId: string, socials: LabelSocial[]): Promise<LabelSocial[]> {
  const clean = normalizeLabelSocials(socials);
  const res = await db
    .from('app_settings')
    .upsert({ key: socialsKey(salonId), value: JSON.stringify(clean), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (res.error) throw res.error;
  return clean;
}
