import { useEffect } from 'react';
import { SearchX } from 'lucide-react';
import { EmptyState, LinkButton } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { t } from '@/i18n';

export function NotFound() {
  // Les moteurs ne doivent pas indexer une page qui n'existe pas (le site statique répond 200).
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  return (
    <Screen className="min-h-dvh justify-center" gap={16}>
      <EmptyState
        icon={SearchX}
        title={t("Page introuvable")}
        description={t("Le lien est peut-être erroné ou la page a été déplacée.")}
        action={<LinkButton to="/">{t("Retour à l'accueil")}</LinkButton>}
      />
    </Screen>
  );
}
