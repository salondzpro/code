import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { t } from '@/i18n';

export function NotFound() {
  return (
    <EmptyState
      title={t("Page introuvable")}
      description={t("Le lien est peut-être erroné ou la page a été déplacée.")}
      action={
        <Link to="/" className="btn-primary">
          {t("Retour à l'accueil")}
        </Link>
      }
    />
  );
}
