import './styles/index.css';
import { env } from './lib/env';
import { startUpdateCheck } from './lib/updateCheck';
import { getLocale, loadDictionary } from './i18n';

if (env.sentryDsn) {
  // Chargé à la demande : ne pèse pas sur le bundle initial
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: env.sentryDsn,
      environment: env.isDev ? 'development' : 'production',
      tracesSampleRate: 0.05,
    });
  });
}

// L'ancienne adresse Render reste servie, mais tout le monde bascule sur le domaine officiel : liens
// partagés, QR, e-mails et sessions ne vivent qu'à un seul endroit.
if (!env.isDev && /\.onrender\.com$/.test(window.location.hostname)) {
  window.location.replace(env.siteUrl + window.location.pathname + window.location.search + window.location.hash);
}

// Sur l'adresse dédiée du portail, la racine EST l'administration : `admin.salondz.com` ouvre le
// tableau de bord, pas la place de marché. On réécrit le chemin avant que le routeur ne démarre —
// pas de rechargement, donc pas d'aller-retour visible. Les autres chemins sont laissés tels quels :
// un lien profond (une fiche, le journal) doit continuer de s'ouvrir là où il pointe.
if (env.adminHost && window.location.pathname === '/') {
  window.history.replaceState(null, '', '/admin' + window.location.search + window.location.hash);
}

startUpdateCheck();

// Ordre voulu : dictionnaire de la langue courante (rien en français), PUIS le code de l'application,
// dont certains modules traduisent au chargement. Le rendu vient en dernier.
void loadDictionary(getLocale())
  .catch(() => undefined)
  .then(() => import('./app/boot'))
  .then((m) => m.render())
  .then(async () => {
    // Coque native (application mobile) : position, partage, bouton retour, liens profonds, barre d'état.
    // Sans effet — et sans téléchargement — pour un visiteur du site.
    const { isNative, initNative } = await import('./lib/native');
    if (!isNative()) return;
    const { router } = await import('./app/router');
    const go = (path: string) => void router.navigate(path);
    await initNative(go);
    const { wireNativePushTaps } = await import('./lib/nativePush');
    await wireNativePushTaps(go);
  });
