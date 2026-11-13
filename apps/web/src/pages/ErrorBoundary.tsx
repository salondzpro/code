import { useEffect } from 'react';
import { House, RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { env } from '@/lib/env';
import { errorText } from '@/components/ErrorMessage';
import { t } from '@/i18n';

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  // Un plantage d'écran vaut un rapport : Sentry le reçoit quand il est configuré.
  useEffect(() => {
    if (is404 || !env.sentryDsn) return;
    void import('@sentry/react').then((Sentry) => Sentry.captureException(error));
  }, [error, is404]);
  return (
    <div className="mx-auto flex h-app max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">{is404 ? t('Page introuvable') : t('Oups, quelque chose a cassé')}</h1>
      {!is404 && <p className="text-sm text-muted">{errorText(error)}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-ghost flex items-center justify-center gap-2" onClick={() => window.location.reload()}>
          <RefreshCw size={18} strokeWidth={1.8} aria-hidden />
          {t("Recharger")}
        </button>
        <Link to="/" className="btn-primary flex items-center justify-center gap-2">
          <House size={18} strokeWidth={1.8} aria-hidden />
          {t("Accueil")}
        </Link>
      </div>
    </div>
  );
}
