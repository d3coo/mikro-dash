/**
 * Offline queue manager
 * Queues writes when offline, syncs when back online
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface PendingWrite {
  id?: number;
  mutation: string;
  args: Record<string, unknown>;
  localId?: string;
  createdAt: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
  retryCount?: number;
}

// In-memory queue (synced with SQLite on server)
export const pendingWrites = writable<PendingWrite[]>([]);
export const isSyncing = writable(false);

// Generate temporary local ID for optimistic updates
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Queue a write for later sync
export async function queueOfflineWrite(
  mutation: string,
  args: Record<string, unknown>,
  localId?: string
): Promise<string> {
  const id = localId ?? generateLocalId();

  const write: PendingWrite = {
    mutation,
    args: { ...args, _localId: id },
    localId: id,
    createdAt: Date.now(),
    status: 'pending',
  };

  // Add to in-memory store
  pendingWrites.update((writes) => [...writes, write]);

  // Persist to SQLite via API
  if (browser) {
    try {
      const response = await fetch('/api/offline/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(write),
      });
      const result = await response.json();
      // Update with server-assigned ID
      pendingWrites.update((writes) =>
        writes.map((w) => (w.localId === id ? { ...w, id: result.id } : w))
      );
    } catch (error) {
      console.error('[Offline] Failed to persist write:', error);
    }
  }

  return id;
}

// Get pending write count
export function getPendingCount(): number {
  return get(pendingWrites).length;
}

// Load pending writes from server on init
export async function loadPendingWrites(): Promise<void> {
  if (!browser) return;

  try {
    const response = await fetch('/api/offline/queue');
    const writes = await response.json();
    pendingWrites.set(writes);
  } catch (error) {
    console.error('[Offline] Failed to load pending writes:', error);
  }
}

// Remove a write from the queue
export async function removePendingWrite(id: number): Promise<void> {
  pendingWrites.update((writes) => writes.filter((w) => w.id !== id));

  if (browser) {
    try {
      await fetch(`/api/offline/queue?id=${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('[Offline] Failed to remove write:', error);
    }
  }
}

// Mark a write as failed
export async function markWriteFailed(id: number, error: string): Promise<void> {
  pendingWrites.update((writes) =>
    writes.map((w) =>
      w.id === id
        ? { ...w, status: 'failed' as const, error, retryCount: (w.retryCount || 0) + 1 }
        : w
    )
  );

  if (browser) {
    try {
      await fetch(`/api/offline/queue?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', error }),
      });
    } catch (err) {
      console.error('[Offline] Failed to update write status:', err);
    }
  }
}
