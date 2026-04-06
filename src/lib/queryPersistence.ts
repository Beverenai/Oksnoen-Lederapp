/**
 * React Query persistence configuration
 * Persists query cache to localStorage for offline support
 */

import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const STORAGE_KEY = 'oksnoen-query-cache';

function serialize(data: PersistedClient): string {
  return JSON.stringify(data, (_key, value) => {
    if (value instanceof Map) {
      return { __type: 'Map', entries: Array.from(value.entries()) };
    }
    return value;
  });
}

function deserialize(str: string): PersistedClient {
  return JSON.parse(str, (_key, value) => {
    if (value && typeof value === 'object' && value.__type === 'Map') {
      return new Map(value.entries);
    }
    return value;
  });
}

export const queryPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    try {
      localStorage.setItem(STORAGE_KEY, serialize(client));
    } catch (e) {
      // localStorage full — clear old data
      console.warn('[Offline] Could not persist cache:', e);
    }
  },
  restoreClient: async () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return undefined;
      return deserialize(data);
    } catch {
      return undefined;
    }
  },
  removeClient: async () => {
    localStorage.removeItem(STORAGE_KEY);
  },
};
