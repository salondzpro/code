/**
 * Retour « expert » : on remonte l'historique réel quand il existe (l'écran précédent est celui d'où l'on vient,
 * défilement conservé), sinon on va à l'écran parent en REMPLAÇANT l'entrée courante (lien direct, onglet neuf).
 * Jamais de `navigate(parent)` en push : cela créait une boucle salon → prestations → salon → prestations…
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

/** Nombre d'entrées d'historique créées par l'application dans cet onglet (react-router y range `idx`). */
export function canGoBack(): boolean {
  try {
    const st = window.history.state as { idx?: number } | null;
    return (st?.idx ?? 0) > 0;
  } catch {
    return false;
  }
}

export function useBack(fallback = '/'): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (canGoBack()) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
