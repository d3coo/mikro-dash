/**
 * PlayStation Background Sync Service
 *
 * Continuously polls MikroTik router to detect PlayStation devices
 * and automatically starts/ends sessions based on WiFi connection status.
 */

import { syncStationStatus, getStations } from './playstation';

// Configuration
const POLL_INTERVAL_MS = 5 * 1000; // Poll every 5 seconds for faster detection
const MAX_CONSECUTIVE_ERRORS = 10; // More tolerance for errors

// State
let isRunning = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let lastSyncTime: number | null = null;
let lastSyncResult: { started: string[]; ended: string[] } | null = null;
let consecutiveErrors = 0;
let lastError: string | null = null;
let totalSyncs = 0;
let totalAutoStarts = 0;
let totalAutoEnds = 0;

/**
 * Start the background sync service
 */
export async function startBackgroundSync(): Promise<void> {
  if (isRunning) {
    console.log('[PS-Sync] Background sync already running');
    return;
  }

  // Check if there are any stations configured
  const stations = await getStations();
  if (stations.length === 0) {
    console.log('[PS-Sync] No stations configured, skipping background sync start');
    return;
  }

  console.log(`[PS-Sync] Starting background sync service (interval: ${POLL_INTERVAL_MS / 1000}s)`);
  console.log(`[PS-Sync] Monitoring ${stations.length} station(s)`);

  isRunning = true;
  consecutiveErrors = 0;

  // Run immediately on start
  runSync();

  // Then run on interval
  pollInterval = setInterval(() => {
    runSync();
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the background sync service
 */
export function stopBackgroundSync(): void {
  if (!isRunning) {
    console.log('[PS-Sync] Background sync not running');
    return;
  }

  console.log('[PS-Sync] Stopping background sync service');

  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  isRunning = false;
}

/**
 * Run a single sync cycle
 */
async function runSync(): Promise<void> {
  try {
    const result = await syncStationStatus();

    lastSyncTime = Date.now();
    lastSyncResult = result;
    consecutiveErrors = 0;
    lastError = null;
    totalSyncs++;

    if (result.started.length > 0) {
      totalAutoStarts += result.started.length;
      console.log(`[PS-Sync] Auto-started sessions: ${result.started.join(', ')}`);
    }

    if (result.ended.length > 0) {
      totalAutoEnds += result.ended.length;
      console.log(`[PS-Sync] Auto-ended sessions: ${result.ended.join(', ')}`);
    }

  } catch (error) {
    consecutiveErrors++;
    lastError = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[PS-Sync] Sync failed (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, lastError);

    // If too many consecutive errors, pause the service
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error('[PS-Sync] Too many consecutive errors, pausing service for 60 seconds');
      stopBackgroundSync();

      // Restart after 60 seconds
      setTimeout(() => {
        console.log('[PS-Sync] Attempting to restart after error pause');
        startBackgroundSync();
      }, 60 * 1000);
    }
  }
}

/**
 * Get the current status of the background sync service
 */
export function getBackgroundSyncStatus(): {
  isRunning: boolean;
  pollIntervalMs: number;
  lastSyncTime: number | null;
  lastSyncResult: { started: string[]; ended: string[] } | null;
  consecutiveErrors: number;
  lastError: string | null;
  stats: {
    totalSyncs: number;
    totalAutoStarts: number;
    totalAutoEnds: number;
  };
} {
  return {
    isRunning,
    pollIntervalMs: POLL_INTERVAL_MS,
    lastSyncTime,
    lastSyncResult,
    consecutiveErrors,
    lastError,
    stats: {
      totalSyncs,
      totalAutoStarts,
      totalAutoEnds
    }
  };
}

/**
 * Force an immediate sync (useful for manual trigger)
 */
export async function forceSync(): Promise<{ started: string[]; ended: string[] }> {
  console.log('[PS-Sync] Force sync triggered');
  await runSync();
  return lastSyncResult || { started: [], ended: [] };
}

/**
 * Check if the service should auto-start
 * Called during server initialization
 */
export async function shouldAutoStart(): Promise<boolean> {
  const stations = await getStations();
  return stations.length > 0;
}
