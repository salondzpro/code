import { useEffect } from 'react';
import { SearchX, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState, LinkButton } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { t } from '@/i18n';

/** Les moteurs ne doivent pas indexer une page qui n'existe pas (le site statique répond 200). */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

/**
 * Écran « ça ne mène à rien », en pleine page et avec UNE sortie : la marketplace.
 *
 * Un lien erroné, un salon retiré, un rendez-vous supprimé : dans tous ces cas le visiteur
 * tombait sur un petit bandeau rouge « Introuvable. » au milieu d'une page vide, sans rien pour
 * continuer. On lui dit ce qui se passe et on lui rend la main.
 */
export function NotFoundState({
  icon = SearchX,
  title = t('Page introuvable'),
  description = t('Le lien est peut-être erroné ou la page a été déplacée.'),
  to = '/',
  label = t("Retour à l'accueil"),
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  to?: string;
  label?: string;
}) {
  useNoIndex();
  return (
    <Screen className="min-h-dvh justify-center" gap={16}>
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        action={<LinkButton to={to}>{label}</LinkButton>}
      />
    </Screen>
  );
}

/** Adresse inconnue de l'application. */
export function NotFound() {
  return <NotFoundState />;
}

/** Lien vers un salon qui n'existe pas (ou plus) : on ramène à la marketplace. */
export function SalonNotFound() {
  return (
    <NotFoundState
      icon={Store}
      title={t('Salon introuvable')}
      description={t("Ce lien ne mène à aucun salon : il a peut-être changé, ou le salon n'est plus en ligne.")}
      label={t('Voir les salons')}
    />
  );
}
