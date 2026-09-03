import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { errorText } from '@/components/ErrorMessage';

export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-bold">{is404 ? 'Page introuvable' : 'Oups, quelque chose a cassé'}</h1>
      {!is404 && <p className="text-sm text-muted">{errorText(error)}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>
          Recharger
        </button>
        <Link to="/" className="btn-primary">
          Accueil
        </Link>
      </div>
    </div>
  );
}
