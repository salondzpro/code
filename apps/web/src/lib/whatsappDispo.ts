/**
 * CONNEXION PAR WHATSAPP : n'offrir que ce qui marche (24 nov. 2026, incident : l'écran demandait un
 * code que Meta n'avait jamais livré).
 *   - `useWhatsAppDispo()` : le serveur peut-il VRAIMENT envoyer un code (modèle approuvé par Meta) ?
 *     Sinon, le bouton « Continuer avec WhatsApp » n'existe pas.
 *   - `sortEnvoi(ref)` : après un envoi, attend le verdict de WhatsApp (webhook) jusqu'à 10 s.
 *     `failed` = non livré (numéro sans WhatsApp, bloqué…) : on ne demande pas de code.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

const MEMOIRE = 'salondz:wa-dispo';
function memoire(): { available: boolean } | undefined {
  try {
    const v = localStorage.getItem(MEMOIRE);
    return v === null ? undefined : { available: v === '1' };
  } catch {
    return undefined;
  }
}

/** Dernière réponse gardée sur l'appareil : le bouton est à sa place dès l'affichage (25 nov. 2026). */
export function useWhatsAppDispo() {
  return useQuery({
    queryKey: ['auth', 'whatsapp-dispo'],
    queryFn: async () => {
      const r = await api.auth.phoneAvailable();
      try {
        localStorage.setItem(MEMOIRE, r.available ? '1' : '0');
      } catch {
        /* stockage indisponible */
      }
      return r;
    },
    initialData: memoire,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

type Sort = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Verdict de WhatsApp sur un envoi : rend dès qu'il est connu, `pending` au bout de `maxMs`. */
export async function sortEnvoi(ref: string, maxMs = 10_000): Promise<Sort> {
  const fin = Date.now() + maxMs;
  while (Date.now() < fin) {
    try {
      const { status } = await api.auth.phoneStatus(ref);
      if (status !== 'pending') return status;
    } catch {
      /* réseau : on réessaie jusqu'à l'échéance */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return 'pending';
}
