/**
 * ========================================================================
 * Trading Journal - React Query Provider
 * ========================================================================
 * 
 * TanStack Query Setup für Caching und Data Fetching.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { CACHE } from '@/shared/config/constants';

// Query Client Konfiguration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: CACHE.MEMOIZATION_TTL,
      gcTime: 1000 * 60 * 10, // 10 Minuten
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export default QueryProvider;
