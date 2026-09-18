/**
 * Démonstration ENTIÈREMENT dans le navigateur (18 sept. 2026) : aucun compte, aucune requête, aucune
 * donnée côté serveur. Le compte de démonstration ouvert est mémorisé ici (localStorage) ; le monde
 * (salons, rendez-vous, notifications) vit dans `world.ts` et répond aux appels de l'application via
 * `fetch.ts`, qui remplace `fetch` tant qu'une démonstration est ouverte. Chaque appareil a donc sa
 * propre démonstration, indépendante des autres et du serveur.
 */
import { DEMO_ACCOUNTS, demoAccountFor, type DemoAccount, type DemoAccountKey } from '@salondz/constants';

const KEY = 'salondz:demo';

/** Identifiants stables des quatre comptes (jamais des comptes réels). */
export const DEMO_USER_IDS: Record<DemoAccountKey, string> = {
  hommes: '0d0e0000-0000-4000-8000-000000000001',
  femmes: '0d0e0000-0000-4000-8000-000000000002',
  clienthomme: '0d0e0000-0000-4000-8000-000000000003',
  clientfemme: '0d0e0000-0000-4000-8000-000000000004',
};

export function currentDemo(): DemoAccount | null {
  try {
    const k = localStorage.getItem(KEY);
    return DEMO_ACCOUNTS.find((a) => a.key === k) ?? null;
  } catch {
    return null;
  }
}

export const isDemo = (): boolean => currentDemo() !== null;

export function startDemo(identifier: string): DemoAccount {
  const acct = demoAccountFor(identifier);
  if (!acct) throw new Error('Compte de démonstration inconnu.');
  localStorage.setItem(KEY, acct.key);
  return acct;
}

export function stopDemo(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
}

/** Une démonstration a-t-elle déjà tourné sur cet appareil (monde enregistré) ? */
export function hasDemoWorld(): boolean {
  try {
    return localStorage.getItem('salondz:demo:world') !== null;
  } catch {
    return false;
  }
}

/**
 * Repartir d'une démonstration neuve : fermer la session ET vider le monde. Le monde vit dans
 * `world.ts` (qui importe ce fichier) : c'est donc `resetWorld` qu'on appelle, jamais un effacement
 * direct du stockage, sinon le monde déjà chargé en mémoire resterait en place.
 */
