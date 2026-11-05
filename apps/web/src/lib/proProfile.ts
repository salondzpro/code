/**
 * Le métier d'un professionnel, lu sur ses prestations : il décide des images et de la question que ses
 * clients lui posent en message. Ses propres photos passent toujours d'abord ; les photos de métier ne
 * servent que s'il n'en a pas encore.
 */
import type { SalonOwnerView } from '@salondz/types';
import { t } from '@/i18n';

export type ProProfile = 'barbier' | 'coiffure' | 'onglerie' | 'esthetique' | 'spa';

const BY_CATEGORY: Record<string, ProProfile> = {
  ongles: 'onglerie',
  onglerie: 'onglerie',
  manucure: 'onglerie',
  cils: 'esthetique',
  sourcils: 'esthetique',
  soins: 'esthetique',
  'soins-peau': 'esthetique',
  laser: 'esthetique',
  esthetique: 'esthetique',
  maquillage: 'esthetique',
  epilation: 'esthetique',
  'spa-hammam': 'spa',
};

const STOCK: Record<ProProfile, string[]> = {
  barbier: ['h-coupe-barbe', 'h-barbe', 'h-coupe', 'h-tracage'],
  coiffure: ['f-brushing', 'f-coloration', 'f-coupe', 'f-balayage'],
  onglerie: ['f-pose-gel', 'f-nail-art', 'f-manucure', 'f-semi-permanent'],
  esthetique: ['f-nettoyage-peau', 'f-sourcils', 'f-soin-hydratant', 'f-extension-cils'],
  spa: ['f-soin-hydratant', 'f-nettoyage-peau', 'f-pedicure', 'f-manucure'],
};

export function proProfile(salon: SalonOwnerView): ProProfile {
  if (salon.genderTarget === 'men') return 'barbier';
  const ids = [...salon.services.filter((s) => s.isActive).map((s) => s.categoryId), ...salon.categoryIds];
  const count = new Map<ProProfile, number>();
  for (const id of ids) {
    const p = id ? BY_CATEGORY[id] : undefined;
    if (p) count.set(p, (count.get(p) ?? 0) + 1);
  }
  const others = ids.filter((id) => id && !BY_CATEGORY[id]).length;
  const [best] = [...count.entries()].sort((a, b) => b[1] - a[1]);
  return best && best[1] > others ? best[0] : 'coiffure';
}

/** Ses photos d'abord, puis celles de ses prestations ; à défaut, celles de son métier. */
export function profilePhotos(salon: SalonOwnerView): string[] {
  const own = [
    salon.coverUrl,
    ...salon.photos.map((p) => p.url),
    ...salon.works.map((p) => p.url),
    ...salon.services.flatMap((s) => (s.photos ?? []).map((p) => p.url)),
  ].filter((u): u is string => !!u);
  const unique = [...new Set(own)];
  return unique.length ? unique : STOCK[proProfile(salon)].map((k) => `/demo/${k}.webp`);
}

/** La question qu'on lui pose le plus souvent en message. */
export function profileQuestion(profile: ProProfile): string {
  switch (profile) {
    case 'barbier':
      return t('Kayen place ce soir ?');
    case 'onglerie':
      return t("C'est combien la pose ?");
    case 'esthetique':
      return t('Vous avez de la place pour un soin ?');
    case 'spa':
      return t('Vous êtes libres ce week-end ?');
    default:
      return t('Tu as de la place samedi ?');
  }
}
