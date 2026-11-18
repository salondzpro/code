/**
 * PROGRAMME FIDÉLITÉ (18 nov. 2026, demande du propriétaire) — une CARTE À TAMPONS que le pro règle
 * en quelques touchers, et que Salon DZ met en avant auprès des clients.
 *
 * Règles (les mêmes côté API, site et démonstration — tout passe par `loyaltyProgress`) :
 *   - un tampon par rendez-vous TERMINÉ, pris SUR SALON DZ (`source = 'online'`), un seul par jour ;
 *   - la Nᵉ visite est la récompense, puis la carte repart à zéro ;
 *   - « premier tampon offert » : la toute première carte commence à 1 ;
 *   - les tampons tombent si l'on ne revient pas pendant `validityMonths` ;
 *   - seules les visites faites APRÈS l'activation du programme comptent.
 * Rien n'est stocké en plus : la progression se recalcule à partir des rendez-vous.
 */
import { tr } from './i18n';
import { formatDA } from './money';

export type LoyaltyRewardKind = 'free' | 'percent' | 'amount';

export interface LoyaltyProgram {
  enabled: boolean;
  /** La visite récompensée (la 6ᵉ, la 10ᵉ…). */
  visits: number;
  rewardKind: LoyaltyRewardKind;
  /** % pour `percent`, DA pour `amount`, plafond en DA pour `free` (0 = sans plafond). */
  rewardValue: number;
  /** La première carte commence avec un tampon. */
  welcome: boolean;
  validityMonths: number;
  /** Première activation : les visites d'avant ne comptent pas. */
  startedAt: string | null;
  /** Dernière annonce envoyée aux clients du salon (une au plus par mois). */
  announcedAt: string | null;
}

export const LOYALTY_VISITS = [5, 6, 8, 10] as const;
export const LOYALTY_VISITS_MIN = 3;
export const LOYALTY_VISITS_MAX = 20;
export const LOYALTY_VALIDITY = [6, 12] as const;
export const LOYALTY_ANNOUNCE_EVERY_DAYS = 30;

export const DEFAULT_LOYALTY: LoyaltyProgram = {
  enabled: false,
  visits: 6,
  rewardKind: 'free',
  rewardValue: 0,
  welcome: true,
  validityMonths: 6,
  startedAt: null,
  announcedAt: null,
};

export function normalizeLoyalty(x: unknown): LoyaltyProgram {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<LoyaltyProgram>;
  const visits = Math.round(Number(o.visits));
  const kind: LoyaltyRewardKind = o.rewardKind === 'percent' || o.rewardKind === 'amount' ? o.rewardKind : 'free';
  let value = Math.max(0, Math.round(Number(o.rewardValue) || 0));
  if (kind === 'percent') value = Math.min(100, Math.max(5, value || 50));
  if (kind === 'amount') value = Math.min(100_000, value || 500);
  return {
    enabled: !!o.enabled,
    visits: Number.isFinite(visits) ? Math.min(LOYALTY_VISITS_MAX, Math.max(LOYALTY_VISITS_MIN, visits)) : DEFAULT_LOYALTY.visits,
    rewardKind: kind,
    rewardValue: value,
    welcome: o.welcome !== false,
    validityMonths: o.validityMonths === 12 ? 12 : 6,
    startedAt: typeof o.startedAt === 'string' ? o.startedAt : null,
    announcedAt: typeof o.announcedAt === 'string' ? o.announcedAt : null,
  };
}

/** « Prestation offerte », « −50 % », « −500 DA ». */
export function loyaltyReward(p: Pick<LoyaltyProgram, 'rewardKind' | 'rewardValue'>): string {
  if (p.rewardKind === 'percent') return tr('−{n} %', { n: p.rewardValue });
  if (p.rewardKind === 'amount') return tr('−{montant}', { montant: formatDA(p.rewardValue) });
  return p.rewardValue > 0 ? tr('Offerte jusqu’à {montant}', { montant: formatDA(p.rewardValue) }) : tr('Offerte');
}

/** LA phrase du programme, partout : « 6ᵉ visite offerte », « 5ᵉ visite à −50 % ». */
export function loyaltyHeadline(p: Pick<LoyaltyProgram, 'visits' | 'rewardKind' | 'rewardValue'>): string {
  if (p.rewardKind === 'percent') return tr('{n}ᵉ visite à −{v} %', { n: p.visits, v: p.rewardValue });
  if (p.rewardKind === 'amount') return tr('{n}ᵉ visite : −{montant}', { n: p.visits, montant: formatDA(p.rewardValue) });
  return tr('{n}ᵉ visite offerte', { n: p.visits });
}

/** Montant déduit d'une visite de `priceDa` (pour l'afficher au client et au pro). */
export function loyaltyDiscount(p: Pick<LoyaltyProgram, 'rewardKind' | 'rewardValue'>, priceDa: number): number {
  if (p.rewardKind === 'percent') return Math.round((priceDa * p.rewardValue) / 100);
  if (p.rewardKind === 'amount') return Math.min(priceDa, p.rewardValue);
  return p.rewardValue > 0 ? Math.min(priceDa, p.rewardValue) : priceDa;
}

export interface LoyaltyProgress {
  /** Tampons sur la carte en cours (0 … visits − 1). */
  stamps: number;
  /** La prochaine visite est la récompense. */
  nextIsReward: boolean;
  /** Récompenses déjà obtenues. */
  rewards: number;
  /** Les tampons tombent à cette date sans nouvelle visite (null s'il n'y a rien à perdre). */
  expiresAt: string | null;
}

const addMonths = (d: Date, m: number) => {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + m);
  return x;
};

/**
 * Progression d'un client, d'après les dates de ses visites qui comptent (rendez-vous terminés, pris
 * sur Salon DZ, triés ou non). `before` : ne compter que les visites antérieures (pour savoir si un
 * rendez-vous à venir est la récompense).
 */
export function loyaltyProgress(p: LoyaltyProgram, visitIsoDates: string[], now: Date = new Date(), before?: string): LoyaltyProgress {
  const start = p.startedAt ? new Date(p.startedAt).getTime() : 0;
  const limit = before ? new Date(before).getTime() : Infinity;
  // Un tampon par jour (heure d'Alger) au plus.
  const seen = new Set<string>();
  const days = visitIsoDates
    .map((iso) => new Date(iso))
    .filter((d) => d.getTime() >= start && d.getTime() < limit)
    .sort((a, b) => a.getTime() - b.getTime())
    .filter((d) => {
      const k = d.toLocaleDateString('en-CA', { timeZone: 'Africa/Algiers' });
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  let stamps = p.welcome ? 1 : 0;
  let rewards = 0;
  let last: Date | null = null;
  for (const d of days) {
    if (last && d.getTime() > addMonths(last, p.validityMonths).getTime()) stamps = 0;
    if (stamps >= p.visits - 1) {
      stamps = 0;
      rewards += 1;
    } else {
      stamps += 1;
    }
    last = d;
  }
  const ref = before ? new Date(before) : now;
  if (last && ref.getTime() > addMonths(last, p.validityMonths).getTime()) stamps = 0;
  return {
    stamps,
    nextIsReward: stamps >= p.visits - 1,
    rewards,
    expiresAt: last && stamps > 0 ? addMonths(last, p.validityMonths).toISOString() : null,
  };
}

/** Ce que l'API rend d'un programme actif, côté public (place de marché, page du salon). */
export interface LoyaltyPublic {
  salonId: string;
  visits: number;
  rewardKind: LoyaltyRewardKind;
  rewardValue: number;
  welcome: boolean;
  validityMonths: number;
}

/** La carte d'un client chez un salon. */
export interface LoyaltyCard extends LoyaltyProgress {
  program: LoyaltyPublic;
  salon: { id: string; slug: string; name: string; logoUrl: string | null; coverUrl: string | null; city: string | null };
}
