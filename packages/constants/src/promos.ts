/**
 * PROMOTIONS SUR LES PRESTATIONS (18 nov. 2026, demande du propriétaire) — le pro choisit une ou
 * plusieurs prestations, une réduction (% ou DA) et une durée ; un tag s'affiche sur la carte du salon
 * (place de marché) et sur les prestations concernées. Le prix du rendez-vous enregistré ne change pas :
 * la réduction s'affiche au client et au pro, qui la déduit à l'encaissement (comme la fidélité).
 *
 * CRÉDIT CLIENT (même jour) : le pro tient un dossier de crédit par client (sommes dues, encaissements).
 * Tant qu'un solde reste dû, le client ne peut ni changer son identité (nom, numéro, genre, photo) ni
 * supprimer son compte — l'e-mail et le mot de passe restent modifiables, pour sa sécurité.
 */
import { tr } from './i18n';
import { formatDA } from './money';

export type PromoKind = 'percent' | 'amount';

export interface ServicePromo {
  id: string;
  serviceIds: string[];
  kind: PromoKind;
  value: number;
  startsAt: string;
  endsAt: string;
}

export const PROMO_PRESETS: { kind: PromoKind; value: number }[] = [
  { kind: 'percent', value: 10 },
  { kind: 'percent', value: 20 },
  { kind: 'percent', value: 30 },
  { kind: 'percent', value: 50 },
  { kind: 'amount', value: 200 },
  { kind: 'amount', value: 500 },
];
/** Durées proposées, en jours. */
export const PROMO_DURATIONS = [7, 14, 30] as const;
export const PROMO_MAX_PER_SALON = 20;

export const promoLabel = (p: Pick<ServicePromo, 'kind' | 'value'>): string =>
  p.kind === 'percent' ? tr('−{n} %', { n: p.value }) : tr('−{montant}', { montant: formatDA(p.value) });

export const promoActive = (p: Pick<ServicePromo, 'startsAt' | 'endsAt'>, at: Date = new Date()): boolean =>
  at.getTime() >= new Date(p.startsAt).getTime() && at.getTime() <= new Date(p.endsAt).getTime();

/** Prix après réduction (jamais négatif). */
export const promoPrice = (priceDa: number, p: Pick<ServicePromo, 'kind' | 'value'>): number =>
  Math.max(0, p.kind === 'percent' ? Math.round(priceDa * (1 - p.value / 100)) : priceDa - p.value);

/** La meilleure promotion active d'une prestation (la plus forte réduction sur son prix). */
export function promoFor(serviceId: string, priceDa: number, promos: ServicePromo[], at: Date = new Date()): ServicePromo | null {
  let best: ServicePromo | null = null;
  for (const p of promos) {
    if (!p.serviceIds.includes(serviceId) || !promoActive(p, at)) continue;
    if (!best || promoPrice(priceDa, p) < promoPrice(priceDa, best)) best = p;
  }
  return best;
}

/** Réduction totale sur un ensemble de prestations (rendez-vous à plusieurs prestations). */
export function promoDiscount(lines: { serviceId: string | null; priceDa: number }[], promos: ServicePromo[], at: Date = new Date()): number {
  let total = 0;
  for (const l of lines) {
    if (!l.serviceId) continue;
    const p = promoFor(l.serviceId, l.priceDa, promos, at);
    if (p) total += l.priceDa - promoPrice(l.priceDa, p);
  }
  return total;
}

/** Ce que l'API publie : les promotions en cours d'un salon. */
export interface SalonPromos {
  salonId: string;
  promos: ServicePromo[];
}

// ---------------------------------------------------------------------------------------------
// Crédit client
// ---------------------------------------------------------------------------------------------
export type CreditKind = 'debt' | 'payment';

export interface CreditEntry {
  id: string;
  kind: CreditKind;
  amount: number;
  note: string | null;
  at: string;
}

export interface CreditFile {
  clientKey: string;
  clientId: string | null;
  name: string;
  phone: string | null;
  entries: CreditEntry[];
}

/** Solde dû (sommes dues − encaissements), jamais négatif. */
export const creditBalance = (entries: Pick<CreditEntry, 'kind' | 'amount'>[]): number =>
  Math.max(0, entries.reduce((a, e) => a + (e.kind === 'debt' ? e.amount : -e.amount), 0));

/** Côté client : un crédit en cours chez un salon. */
export interface ClientCredit {
  salonId: string;
  salonName: string;
  balance: number;
}

/** Côté pro : la liste des crédits ouverts. */
export interface SalonCreditRow {
  clientKey: string;
  name: string;
  phone: string | null;
  balance: number;
  lastAt: string | null;
}
