/**
 * PROGRAMME FIDÉLITÉ (18 nov. 2026, demande du propriétaire) — UN programme par salon, au choix :
 *   - `visits` : PAR PASSAGE — après N visites, un cadeau ;
 *   - `points` : PAR POINTS — 1 point par tranche de 100 DA dépensés, un cadeau à N points ;
 *   - `promo`  : CODE PROMO — un code que le pro partage (Instagram, WhatsApp), une fois par client.
 * Le cadeau : un POURCENTAGE du total ou un MONTANT FIXE, à partir d'un achat minimum (`minSpend`),
 * valable `giftMonths` mois (1 à 6) une fois gagné (pour un code : depuis sa création).
 *
 * Règles communes à l'API, au site et à la démonstration — tout passe par `loyaltyState` :
 *   - seuls comptent les rendez-vous TERMINÉS pris SUR SALON DZ, après l'activation ;
 *   - par passage : une visite par jour au plus ;
 *   - un seul cadeau en attente à la fois ; il s'utilise sur une visite d'au moins `minSpend` ;
 *   - un cadeau non utilisé à temps est perdu.
 * Rien n'est stocké en plus : la progression se recalcule à partir des rendez-vous.
 */
import { tr } from './i18n';
import { formatDA } from './money';

export type LoyaltyMode = 'visits' | 'points' | 'promo';
export type LoyaltyRewardKind = 'percent' | 'amount';

export interface LoyaltyProgram {
  enabled: boolean;
  mode: LoyaltyMode;
  /** Visites (passage) ou points à atteindre. */
  threshold: number;
  rewardKind: LoyaltyRewardKind;
  /** % du total ou montant en DA. */
  rewardValue: number;
  /** Achat minimum pour profiter du cadeau (0 = aucun). */
  minSpend: number;
  /** Validité du cadeau, en mois (1 à 6). */
  giftMonths: number;
  /** Code promo (mode `promo`), en majuscules. */
  code: string | null;
  /** Première activation : les visites d'avant ne comptent pas. */
  startedAt: string | null;
  /** Création du code en vigueur (sa validité part de là). */
  codeSince: string | null;
  /** Dernière annonce aux clients du salon (une par mois au plus). */
  announcedAt: string | null;
}

/** 1 point par tranche de 100 DA. */
export const LOYALTY_DA_PER_POINT = 100;
export const LOYALTY_VISIT_PRESETS = [3, 5, 8, 10] as const;
export const LOYALTY_POINT_PRESETS = [50, 100, 200] as const;
export const LOYALTY_REWARD_PRESETS: { kind: LoyaltyRewardKind; value: number }[] = [
  { kind: 'percent', value: 10 },
  { kind: 'percent', value: 20 },
  { kind: 'percent', value: 50 },
  { kind: 'amount', value: 500 },
  { kind: 'amount', value: 1000 },
  { kind: 'amount', value: 2000 },
];
export const LOYALTY_MIN_SPEND_PRESETS = [0, 2000, 5000] as const;
export const LOYALTY_GIFT_MONTHS = [1, 3, 6] as const;
export const LOYALTY_ANNOUNCE_EVERY_DAYS = 30;
export const LOYALTY_CODE = /^[A-Z0-9]{3,12}$/;

export const DEFAULT_LOYALTY: LoyaltyProgram = {
  enabled: false,
  mode: 'visits',
  threshold: 5,
  rewardKind: 'percent',
  rewardValue: 20,
  minSpend: 0,
  giftMonths: 3,
  code: null,
  startedAt: null,
  codeSince: null,
  announcedAt: null,
};

export const normalizeCode = (c: unknown): string | null => {
  const v = typeof c === 'string' ? c.trim().toUpperCase().replace(/\s+/g, '') : '';
  return LOYALTY_CODE.test(v) ? v : null;
};

export function normalizeLoyalty(x: unknown): LoyaltyProgram {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<LoyaltyProgram> & { visits?: number; validityMonths?: number };
  const mode: LoyaltyMode = o.mode === 'points' || o.mode === 'promo' ? o.mode : 'visits';
  const kind: LoyaltyRewardKind = o.rewardKind === 'amount' ? 'amount' : 'percent';
  let value = Math.round(Number(o.rewardValue) || 0);
  value = kind === 'percent' ? Math.min(100, Math.max(5, value || 20)) : Math.min(100_000, Math.max(100, value || 500));
  const raw = Math.round(Number(o.threshold ?? o.visits) || 0);
  const threshold = mode === 'points' ? Math.min(2000, Math.max(10, raw || 100)) : Math.min(20, Math.max(2, raw || 5));
  return {
    enabled: !!o.enabled,
    mode,
    threshold,
    rewardKind: kind,
    rewardValue: value,
    minSpend: Math.min(1_000_000, Math.max(0, Math.round(Number(o.minSpend) || 0))),
    giftMonths: Math.min(6, Math.max(1, Math.round(Number(o.giftMonths) || 3))),
    code: normalizeCode(o.code),
    startedAt: typeof o.startedAt === 'string' ? o.startedAt : null,
    codeSince: typeof o.codeSince === 'string' ? o.codeSince : null,
    announcedAt: typeof o.announcedAt === 'string' ? o.announcedAt : null,
  };
}

type Rew = Pick<LoyaltyProgram, 'rewardKind' | 'rewardValue'>;
type Head = Pick<LoyaltyProgram, 'mode' | 'threshold' | 'rewardKind' | 'rewardValue'>;

/** « −20 % » ou « −1 000 DA ». */
export const loyaltyReward = (p: Rew): string =>
  p.rewardKind === 'percent' ? tr('−{n} %', { n: p.rewardValue }) : tr('−{montant}', { montant: formatDA(p.rewardValue) });

/** LA phrase du programme, partout : « −20 % après 5 visites », « −1 000 DA à 100 points », « Code promo −10 % ». */
export function loyaltyHeadline(p: Head): string {
  const r = loyaltyReward(p);
  if (p.mode === 'promo') return tr('Code promo {recompense}', { recompense: r });
  if (p.mode === 'points') return tr('{recompense} à {n} points', { recompense: r, n: p.threshold });
  return tr('{recompense} après {n} visites', { recompense: r, n: p.threshold });
}

/** Condition d'achat : « dès 2 000 DA », ou rien. */
export const loyaltyCondition = (p: Pick<LoyaltyProgram, 'minSpend'>): string | null =>
  p.minSpend > 0 ? tr('dès {montant}', { montant: formatDA(p.minSpend) }) : null;

/** Montant déduit d'une visite de `priceDa`. */
export function loyaltyDiscount(p: Rew, priceDa: number): number {
  if (p.rewardKind === 'percent') return Math.round((priceDa * p.rewardValue) / 100);
  return Math.min(priceDa, p.rewardValue);
}

export const pointsFor = (priceDa: number) => Math.floor(Math.max(0, priceDa) / LOYALTY_DA_PER_POINT);

/** Une visite qui compte : date de début et montant du rendez-vous. */
export interface LoyaltyVisit {
  at: string;
  amount: number;
}

export interface LoyaltyState {
  /** Visites ou points accumulés vers le prochain cadeau (0 … threshold). */
  progress: number;
  threshold: number;
  /** Un cadeau attend d'être utilisé (jusqu'à `giftExpiresAt`). */
  giftAvailable: boolean;
  giftExpiresAt: string | null;
  /** Cadeaux déjà utilisés. */
  rewards: number;
}

const addMonths = (iso: string, m: number) => {
  const x = new Date(iso);
  x.setMonth(x.getMonth() + m);
  return x.toISOString();
};

/**
 * État d'un client chez un salon (modes `visits` et `points`). `before` : ne compter que les visites
 * antérieures — pour savoir si un rendez-vous à venir profitera du cadeau.
 */
export function loyaltyState(p: LoyaltyProgram, visits: LoyaltyVisit[], now: Date = new Date(), before?: string): LoyaltyState {
  const start = p.startedAt ? new Date(p.startedAt).getTime() : 0;
  const limit = before ? new Date(before).getTime() : Infinity;
  const seen = new Set<string>();
  const list = visits
    .filter((v) => {
      const t = new Date(v.at).getTime();
      return t >= start && t < limit;
    })
    .sort((a, b) => a.at.localeCompare(b.at))
    .filter((v) => {
      if (p.mode !== 'visits') return true;
      const k = new Date(v.at).toLocaleDateString('en-CA', { timeZone: 'Africa/Algiers' });
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  let progress = 0;
  let gift: string | null = null; // date d'expiration du cadeau en attente
  let rewards = 0;
  for (const v of list) {
    if (gift && v.at > gift) gift = null;
    if (gift && v.amount >= p.minSpend) {
      gift = null;
      rewards += 1;
    }
    progress += p.mode === 'points' ? pointsFor(v.amount) : 1;
    if (progress >= p.threshold) {
      if (!gift) {
        gift = addMonths(v.at, p.giftMonths);
        progress -= p.threshold;
      } else {
        progress = p.threshold;
      }
    }
  }
  const ref = (before ? new Date(before) : now).toISOString();
  if (gift && ref > gift) gift = null;
  return { progress: Math.min(progress, p.threshold), threshold: p.threshold, giftAvailable: !!gift, giftExpiresAt: gift, rewards };
}

/** Le code promo est-il valable à cette date ? */
export function promoValid(p: LoyaltyProgram, at: Date = new Date()): boolean {
  if (!p.enabled || p.mode !== 'promo' || !p.code) return false;
  const since = p.codeSince ?? p.startedAt;
  return !since || at.getTime() <= new Date(addMonths(since, p.giftMonths)).getTime();
}

export const promoExpiresAt = (p: LoyaltyProgram): string | null => {
  const since = p.codeSince ?? p.startedAt;
  return since ? addMonths(since, p.giftMonths) : null;
};

/** Ce que l'API rend d'un programme actif, côté public (jamais le code promo). */
export interface LoyaltyPublic {
  salonId: string;
  mode: LoyaltyMode;
  threshold: number;
  rewardKind: LoyaltyRewardKind;
  rewardValue: number;
  minSpend: number;
  giftMonths: number;
}

/** La carte d'un client chez un salon (« Ma fidélité »). */
export interface LoyaltyCard extends LoyaltyState {
  program: LoyaltyPublic;
  salon: { id: string; slug: string; name: string; logoUrl: string | null; coverUrl: string | null; city: string | null };
}

/** Un client proche d'un cadeau (côté pro). */
export interface LoyaltyClientRow extends LoyaltyState {
  key: string;
  name: string;
  phone: string | null;
}

/** Plus c'est proche d'un cadeau, plus c'est haut : cadeau en attente d'abord, puis la progression. */
export const loyaltyCloseness = (s: Pick<LoyaltyState, 'giftAvailable' | 'progress' | 'threshold'>) =>
  s.giftAvailable ? 2 : s.progress / Math.max(1, s.threshold);
