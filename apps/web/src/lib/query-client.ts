import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@salondz/api-client';

/** Pas de retry sur les erreurs 4xx (métier) ; 2 essais sur réseau/5xx (4G capricieuse). */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
      networkMode: 'offlineFirst',
    },
  },
});
