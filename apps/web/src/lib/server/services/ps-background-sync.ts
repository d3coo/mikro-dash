/**
 * PlayStation Background Service
 *
 * On startup, ensures all MikroTik router rules (ACL, hotspot bypass,
 * static DHCP, netwatch) exist for PS stations.
 *
 * Online detection is handled entirely by netwatch webhooks — no polling.
 */

import { syncPsRouterRules } from './playstation';
import { getPsStations } from '$lib/server/convex';

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
  } catch (e) {
    console.error('[PS] Router rules sync failed:', e);
    initialized = false; // Allow retry
  }
}

/**
 * Check if there are any PS stations configured
 */
export async function hasPsStations(): Promise<boolean> {
  const stations = await getPsStations();
  return stations.length > 0;
}
