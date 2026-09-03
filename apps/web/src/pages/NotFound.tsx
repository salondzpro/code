import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';

export function NotFound() {
  return (
    <EmptyState
      title="Page introuvable"
      description="Le lien est peut-être erroné ou la page a été déplacée."
      action={
        <Link to="/" className="btn-primary">
          Retour à l'accueil
        </Link>
      }
    />
  );
}
