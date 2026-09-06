/**
 * Catégories de salons — clés stables (seedées dans la table `categories`, migration 0004).
 * Le design sépare strictement deux marchés : « Pour Hommes » et « Pour Femmes » ;
 * les catégories sont des filtres propres à chaque marché.
 */
export const MARKETS = ['men', 'women'] as const;
export type Market = (typeof MARKETS)[number];
export const MARKET_LABELS_FR: Record<Market, string> = { men: 'Pour Hommes', women: 'Pour Femmes' };

export const CATEGORY_IDS = [
  // Pour Hommes
  'coiffure',
  'lissage',
  'coloration-meches',
  'soins-peau',
  'tresses',
  // Pour Femmes
  'manucure',
  'ongles',
  'coiffure-lissage',
  'cils',
  'soins',
  'laser',
  // Anciennes clés (salons créés avant le design) — toujours acceptées
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
  /** Nom d'icône (lucide). */
  icon: string;
  sortOrder: number;
  market: Market;
  /** Couleur d'agenda du design (c-hair, c-barb, c-nail, c-lash, c-skin, c-lasr). */
  tone: 'hair' | 'barb' | 'nail' | 'lash' | 'skin' | 'lasr';
  /** Clé historique, masquée dans les listes de choix. */
  legacy?: boolean;
}

export const CATEGORIES: readonly CategoryDef[] = [
  { id: 'coiffure', labelFr: 'Coiffure', labelAr: 'حلاقة', icon: 'scissors', sortOrder: 10, market: 'men', tone: 'barb' },
  { id: 'lissage', labelFr: 'Lissage', labelAr: 'تمليس', icon: 'wand', sortOrder: 11, market: 'men', tone: 'hair' },
  { id: 'coloration-meches', labelFr: 'Coloration & mèches', labelAr: 'صبغة وخصل', icon: 'palette', sortOrder: 12, market: 'men', tone: 'hair' },
  { id: 'soins-peau', labelFr: 'Soins & nettoyage de la peau', labelAr: 'العناية بالبشرة وتنظيفها', icon: 'sparkles', sortOrder: 13, market: 'men', tone: 'skin' },
  { id: 'tresses', labelFr: 'Tresses / braids', labelAr: 'ضفائر', icon: 'brush', sortOrder: 14, market: 'men', tone: 'hair' },
  { id: 'manucure', labelFr: 'Manucure, mains & pieds', labelAr: 'مانيكير، يدين وقدمين', icon: 'hand', sortOrder: 20, market: 'women', tone: 'nail' },
  { id: 'ongles', labelFr: 'Ongles', labelAr: 'أظافر', icon: 'hand', sortOrder: 21, market: 'women', tone: 'nail' },
  { id: 'coiffure-lissage', labelFr: 'Coiffure & lissage', labelAr: 'تصفيف وتمليس', icon: 'scissors', sortOrder: 22, market: 'women', tone: 'hair' },
  { id: 'cils', labelFr: 'Cils', labelAr: 'رموش', icon: 'eye', sortOrder: 23, market: 'women', tone: 'lash' },
  { id: 'soins', labelFr: 'Soins', labelAr: 'عناية', icon: 'flower', sortOrder: 24, market: 'women', tone: 'skin' },
  { id: 'laser', labelFr: 'Laser', labelAr: 'ليزر', icon: 'zap', sortOrder: 25, market: 'women', tone: 'lasr' },
  { id: 'coiffure-homme', labelFr: 'Coiffure homme', labelAr: 'حلاقة رجال', icon: 'scissors', sortOrder: 90, market: 'men', tone: 'barb', legacy: true },
  { id: 'barbier', labelFr: 'Barbier', labelAr: 'حلاق لحية', icon: 'brush', sortOrder: 91, market: 'men', tone: 'barb', legacy: true },
  { id: 'coiffure-femme', labelFr: 'Coiffure femme', labelAr: 'تصفيف شعر نساء', icon: 'sparkles', sortOrder: 92, market: 'women', tone: 'hair', legacy: true },
  { id: 'esthetique', labelFr: 'Esthétique', labelAr: 'تجميل', icon: 'flower', sortOrder: 93, market: 'women', tone: 'skin', legacy: true },
  { id: 'onglerie', labelFr: 'Onglerie', labelAr: 'أظافر', icon: 'hand', sortOrder: 94, market: 'women', tone: 'nail', legacy: true },
  { id: 'maquillage', labelFr: 'Maquillage', labelAr: 'مكياج', icon: 'palette', sortOrder: 95, market: 'women', tone: 'skin', legacy: true },
  { id: 'epilation', labelFr: 'Épilation', labelAr: 'إزالة الشعر', icon: 'feather', sortOrder: 96, market: 'women', tone: 'lasr', legacy: true },
  { id: 'spa-hammam', labelFr: 'Spa & Hammam', labelAr: 'سبا وحمام', icon: 'droplets', sortOrder: 97, market: 'women', tone: 'skin', legacy: true },
];

export const CATEGORY_BY_ID: ReadonlyMap<string, CategoryDef> = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Catégories proposées dans les filtres et l'onboarding d'un marché (sans les clés historiques). */
export function categoriesForMarket(market: Market): CategoryDef[] {
  return CATEGORIES.filter((c) => c.market === market && !c.legacy);
}

export function categoryLabel(id: string, locale: 'fr' | 'ar' = 'fr'): string {
  const c = CATEGORY_BY_ID.get(id);
  if (!c) return id;
  return locale === 'ar' ? c.labelAr : c.labelFr;
}

/** Couleur d'agenda d'une prestation d'après sa catégorie (défaut : barb). */
export function categoryTone(id: string | null | undefined): CategoryDef['tone'] {
  return (id && CATEGORY_BY_ID.get(id)?.tone) || 'barb';
}

/** Marché d'un salon d'après sa cible (unisexe → les deux). */
export function salonMarkets(genderTarget: 'men' | 'women' | 'unisex'): Market[] {
  return genderTarget === 'unisex' ? ['men', 'women'] : [genderTarget];
}
