/**
 * PASSATION DU NAVIGATEUR À L'APPLICATION.
 *
 * Le problème : un lien d'e-mail (confirmation, réinitialisation, lien de connexion) passe par
 * l'API puis par Supabase avant d'atterrir sur `salondz.com/connexion/retour`. Ni Android ni iOS
 * ne suivent une redirection pour décider d'ouvrir une application — ils ne regardent que
 * l'adresse CLIQUÉE. La personne se retrouve donc connectée dans son navigateur, pendant que
 * l'application, elle, reste déconnectée. L'application ne sert alors plus à rien.
 *
 * La solution : une fois arrivé sur la page d'atterrissage, on réveille l'application et on lui
 * remet la session. Les jetons voyagent dans le FRAGMENT de l'adresse — jamais dans le chemin ni
 * dans la requête, qui finiraient dans les journaux des serveurs et dans l'historique partagé.
 *
 * Pourquoi un schéma d'application et pas le lien universel : le système n'intercepte pas une
 * navigation que le navigateur fait vers une adresse où il se trouve DÉJÀ. `salondz://` (iOS) et
 * `intent://` (Android) sont les seuls déclencheurs disponibles depuis une page ouverte.
 *
 * Si l'application n'est pas installée, rien ne se passe : la page reste, et la personne continue
 * dans son navigateur. C'est pour cela que l'appel se fait AVANT le rendu et sans rien bloquer.
 */

/** Écrans d'atterrissage d'un lien e-mail : les seuls qui portent une session à transmettre. */
const ATTERRISSAGES = ['/connexion/retour', '/connexion/mot-de-passe'];

const surMobile = (): boolean => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

const dansLApplication = (): boolean =>
  Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

/**
 * Tente de passer la main à l'application. Ne rend rien : soit le système bascule, soit la page
 * reste et le site prend le relais.
 *
 * À appeler AVANT que Supabase ne lise l'adresse : il efface le fragment dès qu'il l'a consommé,
 * et les jetons seraient alors perdus pour la passation.
 */
export function handOffToApp(): void {
  if (dansLApplication() || !surMobile()) return;

  const { pathname, search, hash } = window.location;
  if (!ATTERRISSAGES.some((a) => pathname.startsWith(a))) return;
  // Sans jeton dans le fragment, il n'y a pas de session à transmettre : ouvrir l'application
  // renverrait simplement sur son écran de connexion, ce qui n'aide personne.
  if (!/access_token=|refresh_token=|code=/.test(hash)) return;

  // Une seule tentative par adresse : sans cela, revenir en arrière dans le navigateur relancerait
  // l'application en boucle.
  const cle = `salondz:passation:${pathname}${hash.slice(0, 40)}`;
  if (sessionStorage.getItem(cle)) return;
  sessionStorage.setItem(cle, '1');

  window.location.href = handoffUrl(navigator.userAgent, `${pathname}${search}${hash}`, window.location.href);
}

/**
 * L'adresse qui réveille l'application. Fonction PURE, donc vérifiable sans navigateur : c'est la
 * seule partie qu'on ne peut pas voir à l'œil nu, et une faute d'un caractère la rendrait muette.
 *
 * La destination voyage dans UN paramètre, encodée. Une adresse `intent://` porte déjà son propre
 * fragment (`#Intent;…`) : le fragment d'authentification ne peut pas y cohabiter, deux `#` dans
 * une même adresse n'ont aucun sens.
 */
export function handoffUrl(ua: string, destination: string, repliVers: string): string {
  const d = encodeURIComponent(destination);
  if (/android/i.test(ua)) {
    // `intent://` prévoit le REPLI : sans application installée, Android revient ici et la personne
    // continue dans son navigateur, sans page d'erreur. Le paquet n'est volontairement PAS nommé —
    // ainsi l'application professionnelle (`pro.salondz.app`) est reconnue elle aussi.
    return `intent://reprise?d=${d}#Intent;scheme=salondz;S.browser_fallback_url=${encodeURIComponent(repliVers)};end`;
  }
  // iOS : le schéma direct. Safari demande confirmation la première fois, et ne fait rien si
  // l'application est absente — la page reste affichée, ce qui est exactement le repli voulu.
  return `salondz://reprise?d=${d}`;
}
