import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { ApiError } from '@salondz/api-client';

const isClientError = (err: unknown) => err instanceof ApiError && err.status >= 400 && err.status < 500;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Pas de retry sur les erreurs 4xx (validation, 401, 404, 409…)
      retry: (failureCount, err) => !isClientError(err) && failureCount < 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      // 4G variable : on sert le cache d'abord, puis on rafraîchit.
      networkMode: 'offlineFirst',
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 0,
    },
  },
});

/**
 * Branche TanStack sur le cycle de vie de l'app :
 * - focusManager ← AppState (refetch au retour au premier plan)
 * - onlineManager : nécessite @react-native-community/netinfo (non installé) ;
 *   sans lui, TanStack considère l'app toujours en ligne, ce qui est acceptable
 *   avec networkMode 'offlineFirst'.
 */
export function setupQueryClientListeners(): () => void {
  if (Platform.OS === 'web') return () => {};
  const onChange = (status: AppStateStatus) => focusManager.setFocused(status === 'active');
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}
