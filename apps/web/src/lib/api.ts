import { createApiClient } from '@salondz/api-client';
import { env } from './env';
import { supabase } from './supabase';
import { isDemo } from '@/demo/session';
import { actingAsToken } from './actingAs';
import { APPLI } from './flavor';

export const api = createApiClient({
  baseUrl: env.apiUrl,
  timeoutMs: 15_000,
  // Séparation stricte (16 nov. 2026) : chaque application s'annonce, le serveur refuse tout compte
  // de l'autre côté. Le site, qui sert les deux portails, ne s'annonce pas.
  app: APPLI ?? undefined,
  /**
   * Démonstration : tout est servi dans le navigateur (aucune requête ne part). Le moteur
   * (monde, règles, routeur) est chargé À LA DEMANDE : un visiteur ordinaire ne télécharge
   * jamais ce code.
   */
  fetch: async (input, init) => {
    if (!isDemo()) return fetch(input, init);
    const { demoFetch } = await import('@/demo/fetch');
    return demoFetch(input, init);
  },
  /**
   * Un administrateur qui pilote l'espace d'un professionnel : le jeton n'a d'effet que derrière
   * `requireAdmin`, côté serveur, qui le vérifie à chaque requête et journalise chaque écriture.
   */
  actingAsToken: () => (isDemo() ? null : actingAsToken()),
  getAccessToken: async () => {
    if (isDemo()) return 'demo';
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
  // Jeton refusé (session révoquée, expirée, mot de passe changé ailleurs) : on repart de la connexion
  // en gardant la page visée, au lieu de laisser un écran « Accès refusé » sans issue.
  onUnauthorized: () => {
    if (isDemo()) return;
    void sessionRefusee();
  },
});

/**
 * UNE RÉPONSE 401 NE PROUVE PAS QUE LA SESSION EST MORTE (24 nov. 2026, connexion Google sur iPhone).
 *
 * Au retour de Google, une requête partie une fraction de seconde AVANT que la session soit posée
 * (donc sans jeton, ou avec un jeton périmé) revenait en 401 alors que la nouvelle session était
 * parfaitement valide. Le gestionnaire faisait alors une déconnexion GLOBALE — qui révoque toutes
 * les sessions du compte, celle qu'on venait d'ouvrir comprise, et celle de l'autre application —
 * puis renvoyait sur l'écran d'ouverture. Résultat : impossible d'entrer par Google.
 *
 * Désormais : sans session sur l'appareil, il n'y a rien à fermer (les gardes décident) ; avec une
 * session, on la fait VÉRIFIER par le serveur d'authentification — valide, la réponse était périmée
 * et on ne touche à rien ; refusée, on ne ferme que la session de CET appareil.
 */
let verificationEnCours = false;
async function sessionRefusee(): Promise<void> {
  if (verificationEnCours) return;
  verificationEnCours = true;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const { data: u, error } = await supabase.auth.getUser();
    if (u?.user && !error) return;
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    const next = window.location.pathname + window.location.search;
    window.location.assign(`${APPLI === 'pro' ? '/pro/bienvenue' : '/intro'}?next=${encodeURIComponent(next)}`);
  } finally {
    setTimeout(() => (verificationEnCours = false), 2000);
  }
}
