/**
 * SÉPARATION STRICTE DES DEUX APPLICATIONS (16 nov. 2026, demande du propriétaire).
 *
 * Un compte qui n'est pas du bon côté — un compte pro dans l'espace client, un compte client dans
 * l'espace pro — n'entre jamais : la session est fermée et l'on revient à l'écran de connexion de CE
 * portail, avec une seule phrase, « Aucun compte client (professionnel) associé à ces identifiants. »
 * Aucune mention de l'autre type de compte, aucune proposition d'aller ailleurs. Le serveur refuse de
 * son côté (`requireClientRole`, `requireSalon`, `X-Salondz-App`) : cet écran n'est que la politesse.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { PageLoading } from '@/components/PageLoading';

export type Cote = 'client' | 'pro';

/** Erreur du serveur qui dit « mauvais côté » (`NO_CLIENT_ACCOUNT` / `NO_PRO_ACCOUNT`). */
export function estRefusCompte(err: unknown): Cote | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === 'NO_CLIENT_ACCOUNT') return 'client';
  if (err.code === 'NO_PRO_ACCOUNT') return 'pro';
  return null;
}

/** Porte de connexion du portail, avec le message. */
export const porteRefus = (cote: Cote) => `${cote === 'pro' ? '/pro/acces' : '/acces'}?erreur=compte`;

export function CompteRefuse({ cote }: { cote: Cote }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const fait = useRef(false);
  useEffect(() => {
    if (fait.current) return;
    fait.current = true;
    void signOut({ voile: false, local: true })
      .catch(() => undefined)
      .finally(() => navigate(porteRefus(cote), { replace: true }));
  }, [cote, navigate, signOut]);
  return <PageLoading />;
}
