/**
 * Sync manager
 * Flushes pending writes to Convex when back online
 */

import { get } from 'svelte/store';
import { pendingWrites, isSyncing, removePendingWrite, markWriteFailed } from './offline';
import { connectionStatus } from './stores/connection';
import { browser } from '$app/environment';

// Dynamic import to avoid SSR issues
let convexClient: any = null;
let convexApi: any = null;

async function getConvex() {
  if (!convexClient) {
    const { convex } = await import('./convex');
    const { api } = await import('../convex/_generated/api');
    convexClient = convex;
    convexApi = api;
  }
  return { client: convexClient, api: convexApi };
}

// Map mutation names to Convex API functions
function getMutationFn(api: any, mutationPath: string) {
  const parts = mutationPath.split('.');
  let fn = api;
  for (const part of parts) {
    fn = fn?.[part];
  }
  return fn;
}

// Sync all pending writes to Convex
export async function syncPendingWrites(): Promise<{
  synced: number;
  failed: number;
}> {
  if (!browser) return { synced: 0, failed: 0 };
  if (get(isSyncing)) return { synced: 0, failed: 0 };
  if (get(connectionStatus) === 'offline') return { synced: 0, failed: 0 };

  isSyncing.set(true);
  connectionStatus.set('syncing');

  let synced = 0;
  let failed = 0;

  try {
    const { client, api } = await getConvex();

    // Get pending writes
    const writes = get(pendingWrites).filter((w) => w.status === 'pending');

    for (const write of writes) {
      const mutationFn = getMutationFn(api, write.mutation);
      if (!mutationFn) {
        console.error(`[Sync] Unknown mutation: ${write.mutation}`);
        if (write.id) {
          await markWriteFailed(write.id, `Unknown mutation: ${write.mutation}`);
        }
        failed++;
        continue;
      }

      try {
        // Remove _localId before sending to Convex
        const { _localId, ...args } = write.args;

        // Execute mutation
        await client.mutation(mutationFn, args);

        // Remove from queue
        if (write.id) {
          await removePendingWrite(write.id);
        }

        synced++;
      } catch (error) {
        console.error(`[Sync] Failed to sync ${write.mutation}:`, error);

        if (write.id) {
          await markWriteFailed(
            write.id,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }

        failed++;
      }
    }
  } finally {
    isSyncing.set(false);
    connectionStatus.set('online');
  }

  return { synced, failed };
}
