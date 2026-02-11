/**
 * Connection status store
 * Monitors online/offline state and triggers sync
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type ConnectionStatus = 'online' | 'offline' | 'syncing';

export const connectionStatus = writable<ConnectionStatus>('online');

let initialized = false;

// Initialize connection monitoring
export function initConnectionMonitor(onReconnect?: () => Promise<void>) {
  if (!browser || initialized) return;
  initialized = true;

  const updateStatus = async () => {
    const wasOffline = get(connectionStatus) === 'offline';
    const isOnline = navigator.onLine;

    if (isOnline) {
      if (wasOffline && onReconnect) {
        connectionStatus.set('syncing');
        try {
          await onReconnect();
        } catch (error) {
          console.error('[Connection] Reconnect handler failed:', error);
        }
      }
      connectionStatus.set('online');
    } else {
      connectionStatus.set('offline');
    }
  };

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);

  // Also check periodically (some offline states aren't detected by events)
  const intervalId = setInterval(async () => {
    try {
      const response = await fetch('/api/health', { method: 'HEAD' });
      if (response.ok && get(connectionStatus) === 'offline') {
        await updateStatus();
      }
    } catch {
      if (get(connectionStatus) !== 'offline') {
        connectionStatus.set('offline');
      }
    }
  }, 30000); // Check every 30 seconds

  // Initial check
  updateStatus();

  // Return cleanup function
  return () => {
    window.removeEventListener('online', updateStatus);
    window.removeEventListener('offline', updateStatus);
    clearInterval(intervalId);
  };
}
