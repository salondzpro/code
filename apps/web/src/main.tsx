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

startUpdateCheck();

// Ordre voulu : dictionnaire de la langue courante (rien en français), PUIS le code de l'application,
// dont certains modules traduisent au chargement. Le rendu vient en dernier.
void loadDictionary(getLocale())
  .catch(() => undefined)
  .then(() => import('./app/boot'))
  .then((m) => m.render());
