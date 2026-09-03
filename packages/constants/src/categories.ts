/** Catégories de salons — clés stables (aussi seedées dans la table `categories`). */
export const CATEGORY_IDS = [
  'coiffure-homme',
  'coiffure-femme',
  'barbier',
  'esthetique',
  'onglerie',
  'maquillage',
  'epilation',
  'spa-hammam',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CategoryDef {
  id: CategoryId;
  labelFr: string;
  labelAr: string;
  /** Nom d'icône (lucide) — le design peut le remplacer par une illustration. */
  icon: string;
  sortOrder: number;
}

export const CATEGORIES: readonly CategoryDef[] = [
  { id: 'coiffure-homme', labelFr: 'Coiffure homme', labelAr: 'حلاقة رجال', icon: 'scissors', sortOrder: 1 },
  { id: 'coiffure-femme', labelFr: 'Coiffure femme', labelAr: 'تصفيف شعر نساء', icon: 'sparkles', sortOrder: 2 },
  { id: 'barbier', labelFr: 'Barbier', labelAr: 'حلاق لحية', icon: 'brush', sortOrder: 3 },
  { id: 'esthetique', labelFr: 'Esthétique', labelAr: 'تجميل', icon: 'flower', sortOrder: 4 },
  { id: 'onglerie', labelFr: 'Onglerie', labelAr: 'أظافر', icon: 'hand', sortOrder: 5 },
  { id: 'maquillage', labelFr: 'Maquillage', labelAr: 'مكياج', icon: 'palette', sortOrder: 6 },
  { id: 'epilation', labelFr: 'Épilation', labelAr: 'إزالة الشعر', icon: 'feather', sortOrder: 7 },
  { id: 'spa-hammam', labelFr: 'Spa & Hammam', labelAr: 'سبا وحمام', icon: 'droplets', sortOrder: 8 },
];

export const CATEGORY_BY_ID: ReadonlyMap<string, CategoryDef> = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryLabel(id: string, locale: 'fr' | 'ar' = 'fr'): string {
  const c = CATEGORY_BY_ID.get(id);
  if (!c) return id;
  return locale === 'ar' ? c.labelAr : c.labelFr;
}
