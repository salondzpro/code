/**
 * Ancien écran « Pour qui ? » (`/s/:slug/reserver/coordonnees`) : fondu dans « Confirmer » le
 * 15 nov. 2026 (réservation en deux étapes). L'adresse est gardée pour les liens et brouillons en
 * cours (retour d'une connexion, d'une inscription) et mène à la confirmation.
 */
import { Navigate, useParams } from 'react-router';

export function BookingDetails() {
  const { slug = '' } = useParams();
  return <Navigate to={`/s/${slug}/reserver/recap`} replace />;
}
