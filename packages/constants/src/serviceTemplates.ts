/**
 * Prestations types par catégorie : suggestions à l'inscription d'un professionnel (et dans le catalogue),
 * pour partir d'un nom, d'une durée et d'un prix courants en Algérie plutôt que d'une page blanche.
 * Durées et prix calés sur la pratique algérienne (barbier : coupe 15 min, barbe 10 min, coupe + barbe 25 min ;
 * prix indicatifs en DA que le pro ajuste).
 */
import type { CategoryId } from './categories';

export interface ServiceTemplate {
  name: string;
  minutes: number;
  priceDa: number;
}

export const SERVICE_TEMPLATES: Partial<Record<CategoryId, ServiceTemplate[]>> = {
  // ---- Pour Hommes ----
  coiffure: [
    { name: 'Coupe homme', minutes: 15, priceDa: 300 },
    { name: 'Coupe + barbe', minutes: 25, priceDa: 500 },
    { name: 'Coupe enfant', minutes: 15, priceDa: 200 },
    { name: 'Dégradé', minutes: 20, priceDa: 400 },
    { name: 'Shampoing + coiffage', minutes: 10, priceDa: 100 },
  ],
  barbe: [
    { name: 'Taille de barbe', minutes: 10, priceDa: 200 },
    { name: 'Rasage traditionnel', minutes: 15, priceDa: 250 },
    { name: 'Contour + soin de barbe', minutes: 15, priceDa: 300 },
  ],
  lissage: [
    { name: 'Lissage kératine', minutes: 60, priceDa: 3000 },
    { name: 'Lissage brésilien', minutes: 90, priceDa: 4000 },
    { name: 'Botox capillaire', minutes: 45, priceDa: 2500 },
  ],
  'coloration-meches': [
    { name: 'Coloration', minutes: 30, priceDa: 800 },
    { name: 'Mèches', minutes: 45, priceDa: 1500 },
    { name: 'Décoloration', minutes: 45, priceDa: 2000 },
  ],
  'soins-peau': [
    { name: 'Nettoyage de peau', minutes: 30, priceDa: 1000 },
    { name: 'Masque visage', minutes: 15, priceDa: 500 },
    { name: 'Gommage + masque', minutes: 25, priceDa: 800 },
  ],
  tresses: [
    { name: 'Tresses simples', minutes: 45, priceDa: 1500 },
    { name: 'Braids complètes', minutes: 90, priceDa: 3000 },
  ],
  // ---- Pour Femmes ----
  'coiffure-lissage': [
    { name: 'Coupe femme', minutes: 30, priceDa: 800 },
    { name: 'Brushing', minutes: 20, priceDa: 500 },
    { name: 'Coloration femme', minutes: 45, priceDa: 2000 },
    { name: 'Mèches / balayage', minutes: 75, priceDa: 3500 },
    { name: 'Lissage kératine femme', minutes: 90, priceDa: 4500 },
    { name: 'Chignon / coiffure de soirée', minutes: 45, priceDa: 2500 },
  ],
  ongles: [
    { name: 'Pose gel', minutes: 45, priceDa: 2000 },
    { name: 'Pose capsules', minutes: 60, priceDa: 2500 },
    { name: 'Remplissage gel', minutes: 30, priceDa: 1200 },
    { name: 'Dépose', minutes: 15, priceDa: 300 },
    { name: 'Nail art', minutes: 20, priceDa: 500 },
  ],
  manucure: [
    { name: 'Manucure classique', minutes: 20, priceDa: 600 },
    { name: 'Pédicure', minutes: 30, priceDa: 1000 },
    { name: 'Vernis semi-permanent', minutes: 30, priceDa: 1000 },
  ],
  cils: [
    { name: 'Extensions de cils cil à cil', minutes: 60, priceDa: 3000 },
    { name: 'Extensions volume russe', minutes: 90, priceDa: 4500 },
    { name: 'Remplissage cils', minutes: 40, priceDa: 1800 },
    { name: 'Rehaussement de cils', minutes: 30, priceDa: 1800 },
  ],
  sourcils: [
    { name: 'Restructuration des sourcils', minutes: 10, priceDa: 300 },
    { name: 'Teinture des sourcils', minutes: 15, priceDa: 500 },
    { name: 'Brow lift', minutes: 30, priceDa: 1800 },
    { name: 'Microblading', minutes: 90, priceDa: 8000 },
  ],
  soins: [
    { name: 'Soin du visage', minutes: 30, priceDa: 1500 },
    { name: 'Nettoyage de peau', minutes: 30, priceDa: 1000 },
    { name: 'Hydrafacial', minutes: 45, priceDa: 3500 },
  ],
  maquillage: [
    { name: 'Maquillage soirée', minutes: 30, priceDa: 2000 },
    { name: 'Maquillage mariée', minutes: 60, priceDa: 8000 },
  ],
  epilation: [
    { name: 'Épilation jambes complètes', minutes: 30, priceDa: 1000 },
    { name: 'Épilation visage', minutes: 10, priceDa: 300 },
    { name: 'Épilation intégrale', minutes: 45, priceDa: 2000 },
  ],
  laser: [
    { name: 'Laser aisselles', minutes: 10, priceDa: 1500 },
    { name: 'Laser jambes complètes', minutes: 30, priceDa: 4500 },
    { name: 'Laser visage', minutes: 15, priceDa: 2000 },
  ],
};

/** Suggestions pour un salon, dans l'ordre de ses catégories, sans doublon de nom. */
export function serviceTemplatesFor(categoryIds: readonly string[]): (ServiceTemplate & { categoryId: CategoryId })[] {
  const out: (ServiceTemplate & { categoryId: CategoryId })[] = [];
  const seen = new Set<string>();
  for (const id of categoryIds) {
    for (const tpl of SERVICE_TEMPLATES[id as CategoryId] ?? []) {
      if (seen.has(tpl.name)) continue;
      seen.add(tpl.name);
      out.push({ ...tpl, categoryId: id as CategoryId });
    }
  }
  return out;
}
