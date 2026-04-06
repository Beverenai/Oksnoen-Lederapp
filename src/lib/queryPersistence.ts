/**
 * React Query persistence configuration
 * Persists query cache to localStorage for offline support
 */

import { createSyncStoragePersister } from '@tanstack/query-persist-client-core';
import type { QueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'oksnoen-query-cache';

export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: STORAGE_KEY,
  // Serialize Maps properly
  serialize: (data) => {
    return JSON.stringify(data, (_key, value) => {
      if (value instanceof Map) {
        return { __type: 'Map', entries: Array.from(value.entries()) };
      }
      return value;
    });
  },
  deserialize: (str) => {
    return JSON.parse(str, (_key, value) => {
      if (value && typeof value === 'object' && value.__type === 'Map') {
        return new Map(value.entries);
      }
      return value;
    });
  },
});

/**
 * Configure a QueryClient for offline persistence
 */
export function configureOfflineQueryClient(queryClient: QueryClient) {
  queryClient.setDefaultOptions({
    queries: {
      // Show cached data immediately, refetch in background
      staleTime: 5 * 60 * 1000, // 5 min default
      gcTime: 24 * 60 * 60 * 1000, // Keep in cache 24h
      retry: (failureCount, error: any) => {
        // Don't retry when offline
        if (!navigator.onLine) return false;
        return failureCount < 2;
      },
      // Use cached data when offline
      networkMode: 'offlineFirst',
    },
  });
}
