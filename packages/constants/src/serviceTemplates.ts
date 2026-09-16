/**
 * Prestations types par catégorie : suggestions à l'inscription d'un professionnel (et dans le catalogue),
 * pour partir d'un nom, d'une durée et d'un prix courants en Algérie plutôt que d'une page blanche.
 * Prix indicatifs en DA (le pro les ajuste), durées en minutes.
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
    { name: 'Coupe homme', minutes: 30, priceDa: 800 },
    { name: 'Coupe + barbe', minutes: 45, priceDa: 1200 },
    { name: 'Coupe enfant', minutes: 20, priceDa: 500 },
    { name: 'Dégradé', minutes: 30, priceDa: 900 },
    { name: 'Shampoing + coiffage', minutes: 15, priceDa: 300 },
  ],
  barbe: [
    { name: 'Taille de barbe', minutes: 20, priceDa: 500 },
    { name: 'Rasage traditionnel', minutes: 25, priceDa: 600 },
    { name: 'Contour + soin de barbe', minutes: 30, priceDa: 800 },
  ],
  lissage: [
    { name: 'Lissage kératine', minutes: 90, priceDa: 4000 },
    { name: 'Lissage brésilien', minutes: 120, priceDa: 5000 },
    { name: 'Botox capillaire', minutes: 60, priceDa: 3000 },
  ],
  'coloration-meches': [
    { name: 'Coloration', minutes: 45, priceDa: 1500 },
    { name: 'Mèches', minutes: 60, priceDa: 2000 },
    { name: 'Décoloration', minutes: 60, priceDa: 2500 },
  ],
  'soins-peau': [
    { name: 'Nettoyage de peau', minutes: 45, priceDa: 2000 },
    { name: 'Masque visage', minutes: 30, priceDa: 1000 },
    { name: 'Gommage + masque', minutes: 40, priceDa: 1500 },
  ],
  tresses: [
    { name: 'Tresses simples', minutes: 60, priceDa: 2000 },
    { name: 'Braids complètes', minutes: 120, priceDa: 4000 },
  ],
  // ---- Pour Femmes ----
  'coiffure-lissage': [
    { name: 'Coupe femme', minutes: 45, priceDa: 1500 },
    { name: 'Brushing', minutes: 30, priceDa: 1000 },
    { name: 'Coloration', minutes: 60, priceDa: 3000 },
    { name: 'Mèches / balayage', minutes: 90, priceDa: 5000 },
    { name: 'Lissage kératine', minutes: 120, priceDa: 6000 },
    { name: 'Chignon / coiffure de soirée', minutes: 60, priceDa: 3500 },
  ],
  ongles: [
    { name: 'Pose gel', minutes: 60, priceDa: 2500 },
    { name: 'Pose capsules', minutes: 75, priceDa: 3000 },
    { name: 'Remplissage gel', minutes: 45, priceDa: 1800 },
    { name: 'Dépose', minutes: 20, priceDa: 500 },
    { name: 'Nail art', minutes: 30, priceDa: 800 },
  ],
  manucure: [
    { name: 'Manucure classique', minutes: 30, priceDa: 1000 },
    { name: 'Pédicure', minutes: 45, priceDa: 1500 },
    { name: 'Vernis semi-permanent', minutes: 40, priceDa: 1500 },
  ],
  cils: [
    { name: 'Extensions de cils cil à cil', minutes: 90, priceDa: 4000 },
    { name: 'Extensions volume russe', minutes: 120, priceDa: 6000 },
    { name: 'Remplissage cils', minutes: 60, priceDa: 2500 },
    { name: 'Rehaussement de cils', minutes: 45, priceDa: 2500 },
  ],
  sourcils: [
    { name: 'Restructuration des sourcils', minutes: 20, priceDa: 500 },
    { name: 'Teinture des sourcils', minutes: 20, priceDa: 800 },
    { name: 'Brow lift', minutes: 45, priceDa: 2500 },
    { name: 'Microblading', minutes: 120, priceDa: 12000 },
  ],
  soins: [
    { name: 'Soin du visage', minutes: 45, priceDa: 2500 },
    { name: 'Nettoyage de peau', minutes: 45, priceDa: 2000 },
    { name: 'Hydrafacial', minutes: 60, priceDa: 5000 },
  ],
  maquillage: [
    { name: 'Maquillage soirée', minutes: 45, priceDa: 3000 },
    { name: 'Maquillage mariée', minutes: 90, priceDa: 10000 },
  ],
  epilation: [
    { name: 'Épilation jambes complètes', minutes: 40, priceDa: 1500 },
    { name: 'Épilation visage', minutes: 20, priceDa: 500 },
    { name: 'Épilation intégrale', minutes: 60, priceDa: 3000 },
  ],
  laser: [
    { name: 'Laser aisselles', minutes: 15, priceDa: 2000 },
    { name: 'Laser jambes complètes', minutes: 45, priceDa: 6000 },
    { name: 'Laser visage', minutes: 20, priceDa: 2500 },
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
