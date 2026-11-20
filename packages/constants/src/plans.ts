/**
 * ABONNEMENTS DES PROFESSIONNELS (20 nov. 2026, demande du propriétaire). Les clientes ne paient
 * jamais. Trois offres : Découverte (gratuite, tag « Free » sur le compte), Pro et Salon. Lancement
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
    name: 'Découverte',
    price: 0,
    promo: 0,
    yearly: 0,
    tagline: 'Pour démarrer seul(e)',
    features: ['30 réservations en ligne par mois', 'Agenda, demandes et rappels', 'Page publique, lien bio et QR code', 'Visible sur la place de marché'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 1320,
    promo: 790,
    yearly: 7900,
    tagline: 'Coiffeur ou esthéticienne indépendant(e)',
    features: [
      'Réservations illimitées',
      'Mis en avant dans votre ville',
      'Versement à la réservation (CCP)',
      'Fidélité, promotions et crédit client',
      'Stories et vidéo illimitées',
      'Support WhatsApp prioritaire',
    ],
  },
  {
    id: 'salon',
    name: 'Salon',
    price: 1650,
    promo: 990,
    yearly: 9900,
    tagline: 'Salon avec une équipe',
    features: [
      'Tout Pro, pour toute l’équipe',
      'Jusqu’à 8 agendas',
      'En tête de votre ville',
      'Chiffre d’affaires sur tout l’historique',
      'Installation sur place à Alger',
    ],
  },
];

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
