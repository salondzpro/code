/**
 * PAGE PAS EN LIGNE (15 nov. 2026) : un salon non publié répond « Salon introuvable » à ses clientes,
 * alors que l'espace pro affichait son lien comme s'il marchait. L'accueil le dit donc en premier, avec
 * UN bouton qui met la page en ligne ; si quelque chose manque (prestation, horaires), le serveur le
 * dit et on l'affiche tel quel.
 */
import { useState } from 'react';
import { EyeOff } from 'lucide-react';
import { ApiError, useProSalonMutations } from '@salondz/api-client';
import type { SalonOwnerView } from '@salondz/types';
import { Button, I } from '@/components/ui';
import { errorText } from '@/components/ErrorMessage';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

export function PageHorsLigne({ salon }: { salon: SalonOwnerView }) {
  const { updateSalon } = useProSalonMutations();
  const [error, setError] = useState<string | null>(null);
  if (salon.isPublished) return null;
  const publish = async () => {
    setError(null);
    try {
      await updateSalon.mutateAsync({ isPublished: true });
    } catch (err) {
      setError(err instanceof ApiError && Array.isArray(err.details) ? (err.details as string[]).join(' · ') : errorText(err));
    }
  };
  return (
    <section className="h12-card phl" role="status">
      <div className="flex items-start gap-3">
        <span className="phl-ic" aria-hidden>
          <I icon={EyeOff} size={18} />
        </span>
        <b className="min-w-0 flex-1 self-center">{t('Votre page n’est pas en ligne')}</b>
      </div>
      <Button icon={ICONE.publier} loading={updateSalon.isPending} onClick={() => void publish()}>
        {t('Mettre ma page en ligne')}
      </Button>
      {error && (
        <p className="text-[0.929rem] text-danger" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
