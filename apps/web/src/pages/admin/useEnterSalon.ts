/**
 * Entrer dans l'espace d'un professionnel — le geste que la liste ET la fiche proposent.
 *
 * Un aller-retour au serveur (il délivre le jeton de contrôle et l'inscrit au journal), puis on
 * change de contexte : le cache appartient au contexte qu'on quitte, on le vide avant d'ouvrir
 * l'espace pro. Le jeton vit dans `lib/actingAs.ts`.
 */
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminActions } from '@salondz/api-client';
import { startActingAs } from '@/lib/actingAs';

export function useEnterSalon() {
  const { enterSalon } = useAdminActions();
  const qc = useQueryClient();
  const navigate = useNavigate();
  return {
    enter: (salon: { id: string; name: string }) =>
      enterSalon.mutate(salon.id, {
        onSuccess: (acces) => {
          startActingAs({ id: salon.id, name: salon.name, token: acces.token, expiresAt: acces.expiresAt });
          qc.clear();
          navigate('/pro');
        },
      }),
    pending: enterSalon.isPending,
    /** L'identifiant du salon en cours d'ouverture : la liste n'a qu'un bouton qui tourne à la fois. */
    entering: enterSalon.isPending ? enterSalon.variables : undefined,
    error: enterSalon.error,
  };
}
