/**
 * ABONNEMENTS DES PROFESSIONNELS (20 nov. 2026, demande du propriétaire). Les clientes ne paient
 * jamais. Trois offres : Gratuit (tag « Free » sur le compte), Pro et Max (identifiants `free`, `pro`, `salon`). Lancement
 * « Black Friday » : −40 % À VIE pour tout pro inscrit avant la fin de `PLAN_PROMO_END`.
 *
 * L'abonnement d'un salon est posé par le SUPER ADMIN (`/admin/abonnements`) après paiement
 * (BaridiMob / CCP) ; sans réglage, un salon est en Découverte. Le pro choisit son offre en écrivant
 * sur WhatsApp (`SUPPORT_WHATSAPP`) : plus direct que tout formulaire.
 */
export type PlanId = 'free' | 'pro' | 'salon';

export interface PlanDef {
  id: PlanId;
  /** Nom affiché (traduit par l'écran). */
  name: string;
  /** Prix normal, en dinars par mois. */
  price: number;
  /** Prix de lancement (Black Friday), en dinars par mois. */
  promo: number;
  /** Prix à l'année au tarif de lancement (2 mois offerts). */
  yearly: number;
  /** Pour qui, une ligne. */
  tagline: string;
  /** Ce que l'offre donne, du plus utile au moins utile. */
  features: string[];
}

export const PLANS: PlanDef[] = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    promo: 0,
    yearly: 0,
    tagline: 'Pour démarrer seul(e)',
    features: ['Réservations en ligne illimitées', 'Agenda, demandes et rappels', 'Page publique, lien bio et QR code', 'Visible sur la place de marché', 'Stories et vidéo de réservation'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 1320,
    promo: 790,
    yearly: 7900,
    tagline: 'Coiffeur ou esthéticienne indépendant(e)',
    features: [
      'Tout Gratuit',
      'Mis en avant dans votre ville',
      'Versement à la réservation (CCP)',
      'Programme fidélité',
      'Promotions sur vos prestations',
      'Crédit client',
    ],
  },
  {
    id: 'salon',
    name: 'Max',
    price: 1650,
    promo: 990,
    yearly: 9900,
    tagline: 'Salon avec une équipe',
    features: ['Tout Pro', 'Équipe : jusqu’à 8 personnes', 'Un agenda par personne', 'En tête de votre ville'],
  },
];

/** Personnes actives au plus dans l'équipe avec l'offre Max (Gratuit et Pro : une). */
export const PLAN_TEAM_MAX = 8;

/** Dernier jour du tarif de lancement (inclus, heure d'Alger). */
export const PLAN_PROMO_END = '2026-11-30';

/** Le numéro WhatsApp du support professionnel (questions, choix d'une offre). */
export const SUPPORT_WHATSAPP = '+33603044618';

/** Lien WhatsApp avec un message déjà écrit. */
export function supportWhatsAppUrl(text?: string): string {
  const n = SUPPORT_WHATSAPP.replace(/\D/g, '');
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function planById(id: string | null | undefined): PlanDef {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]!;
}
