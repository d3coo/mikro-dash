/**
 * PlayStation Background Service
 *
 * On startup, ensures all MikroTik router rules (ACL, hotspot bypass,
 * static DHCP, netwatch) exist for PS stations.
 *
 * Online detection is handled entirely by netwatch webhooks — no polling.
 */

import { syncPsRouterRules, normalizeMac, setStationOnlineState } from './playstation';
import { getPsStations, bulkUpdateStationOnlineStatus } from '$lib/server/convex';
import { getMikroTikClient } from './mikrotik';

let initialized = false;

/**
 * Initialize PS router rules on startup.
 * Ensures ACL, hotspot bypass, static DHCP, and netwatch entries exist.
 */
export async function initPsRouterRules(): Promise<void> {
  if (initialized) {
    console.log('[PS] Router rules already initialized');
    return;
  }

  const stations = await getPsStations();
  if (stations.length === 0) {
    console.log('[PS] No stations configured, skipping router rules sync');
    return;
  }

  console.log(`[PS] Syncing router rules for ${stations.length} station(s)...`);
  initialized = true;

  try {
    await syncPsRouterRules();
    console.log('[PS] Router rules sync complete');

    // Sync initial online status from netwatch
    // Netwatch only fires webhooks on state CHANGES, so if a PS is already
    // online when the server starts, no webhook fires. Read current status directly.
    await syncInitialOnlineStatus(stations);
  } catch (e) {
    console.error('[PS] Router rules sync failed:', e);
    initialized = false; // Allow retry
  }
}

/**
 * Read current netwatch status from the router and set initial online state.
 * This handles the case where PS devices are already online when the server starts
 * (netwatch won't fire a webhook since there's no state change).
 */
async function syncInitialOnlineStatus(stations: Awaited<ReturnType<typeof getPsStations>>): Promise<void> {
  try {
    const client = await getMikroTikClient();
    const netwatchEntries = await client.getNetwatchEntries();
    const psEntries = netwatchEntries.filter(e => e.comment?.startsWith('ps-watch:'));

    // Build name → station map
    const stationByName = new Map(stations.map(s => [s.name, s]));

    const updates: Array<{ id: string; isOnline: boolean }> = [];

    for (const entry of psEntries) {
      const name = entry.comment!.replace('ps-watch:', '');
      const station = stationByName.get(name);
      if (!station) continue;

      const isUp = entry.status === 'up';

      // Set in-memory state
      setStationOnlineState(station.macAddress, isUp ? 'up' : 'down');

      // Queue DB update
      updates.push({ id: station._id as string, isOnline: isUp });

      if (isUp) {
        console.log(`[PS] ${name}: already online (netwatch status: up)`);
      }
    }

    if (updates.length > 0) {
      await bulkUpdateStationOnlineStatus(updates);
      const onlineCount = updates.filter(u => u.isOnline).length;
      console.log(`[PS] Initial status sync: ${onlineCount}/${updates.length} stations online`);
    }
  } catch (e) {
    console.error('[PS] Failed to sync initial online status:', e);
  }
}

/**
 * Check if there are any PS stations configured
 */
export async function hasPsStations(): Promise<boolean> {
  const stations = await getPsStations();
  return stations.length > 0;
}
