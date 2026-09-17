import { useEffect } from 'react';
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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-bold">{is404 ? t('Page introuvable') : t('Oups, quelque chose a cassé')}</h1>
      {!is404 && <p className="text-sm text-muted">{errorText(error)}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>
          {t("Recharger")}
        </button>
        <Link to="/" className="btn-primary">
          {t("Accueil")}
        </Link>
      </div>
    </div>
  );
}
