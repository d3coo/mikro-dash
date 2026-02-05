/**
 * Optimistic UI state management
 * Provides temporary state overlays for offline-created items
 */

import { writable, derived, get } from 'svelte/store';

// Generic optimistic state store factory
export function createOptimisticStore<T extends { _id: string }>() {
  const store = writable<Map<string, Partial<T>>>(new Map());

  return {
    subscribe: store.subscribe,

    // Apply optimistic update
    apply(localId: string, data: Partial<T>) {
      store.update((map) => {
        map.set(localId, data);
        return new Map(map);
      });
    },

    // Clear optimistic update (after sync)
    clear(localId: string) {
      store.update((map) => {
        map.delete(localId);
        return new Map(map);
      });
    },

    // Clear all
    clearAll() {
      store.set(new Map());
    },

    // Get current map
    getMap() {
      return get(store);
    },
  };
}

// Merge Convex data with optimistic updates
export function mergeWithOptimistic<T extends { _id: string }>(
  convexData: T[] | undefined,
  optimisticMap: Map<string, Partial<T>>
): T[] {
  const data = convexData ?? [];
  const merged = [...data];

  // Add optimistic items not yet in Convex
  for (const [localId, partialData] of optimisticMap) {
    if (!merged.some((item) => item._id === localId)) {
      merged.push({ ...partialData, _id: localId } as T);
    }
  }

  return merged;
}

// Pre-created stores for common types
export const optimisticSessions = createOptimisticStore<{
  _id: string;
  stationId: string;
  startedAt: number;
  hourlyRateSnapshot: number;
  currentMode: string;
  ordersCost: number;
  extraCharges: number;
  transferredCost: number;
  timerNotified: boolean;
  costLimitNotified: boolean;
  totalPausedMs: number;
}>();

export const optimisticOrders = createOptimisticStore<{
  _id: string;
  sessionId: string;
  menuItemId: string;
  quantity: number;
  priceSnapshot: number;
  createdAt: number;
}>();

export const optimisticFnbSales = createOptimisticStore<{
  _id: string;
  menuItemId: string;
  quantity: number;
  priceSnapshot: number;
  soldAt: number;
}>();
