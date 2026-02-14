import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getPsStations,
  getStationStatuses,
  startPsSession,
  pausePsSession,
  resumePsSession,
  updatePsStationInternet,
  bulkUpdateStationOnlineStatus,
} from '$lib/server/convex';
import {
  getStationOnlineState,
  setStationOnlineState,
  isInManualEndCooldown,
  clearManualEndCooldown,
  normalizeMac,
  setInternetRules,
} from '$lib/server/services/playstation';

// Track last webhook update time (for UI refresh)
let lastWebhookUpdate = Date.now();

// Grace period for disconnect events.
// Each PS has TWO netwatch entries (LAN + guest). Brief ping failures can cause
// spurious disconnect events. We wait 30 seconds before pausing the session.
const DISCONNECT_GRACE_PERIOD_MS = 30_000;
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Reset internet to OFF for a station (reject forward + block DNS).
 * Called on connect and disconnect to ensure PS always starts with internet blocked.
 */
async function resetInternetToOff(station: { _id: string; name: string; macAddress: string; hasInternet?: boolean }) {
  if (!station.hasInternet) return; // Already off

  try {
    const mac = normalizeMac(station.macAddress);
    await setInternetRules(mac, station.name, false);
    await updatePsStationInternet(station._id, false);
    console.log(`[Webhook] Reset internet for ${station.name} (${mac})`);
  } catch (e) {
    console.error(`[Webhook] Failed to reset internet for ${station.name}:`, e);
  }
}

/**
 * POST /api/playstation/webhook
 *
 * Webhook endpoint for MikroTik to call when a device connects/disconnects.
 * This provides instant detection instead of relying on polling.
 *
 * Body: { mac: "AA:BB:CC:DD:EE:FF", action: "connect" | "disconnect" }
 * Or URL-encoded: mac=AA:BB:CC:DD:EE:FF&action=connect
 */
export const POST: RequestHandler = async ({ request, url }) => {
  try {
    let mac: string | null = null;
    let action: string | null = null;

    // Check URL params first (MikroTik sends as query params sometimes)
    mac = url.searchParams.get('mac');
    action = url.searchParams.get('action');

    // If not in URL, try body
    if (!mac || !action) {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.json();
        mac = mac || body.mac;
        action = action || body.action;
      } else {
        // Parse as form data (application/x-www-form-urlencoded)
        try {
          const formData = await request.formData();
          mac = mac || formData.get('mac') as string;
          action = action || formData.get('action') as string;
        } catch {
          // Try parsing raw text
          const text = await request.text();
          const params = new URLSearchParams(text);
          mac = mac || params.get('mac');
          action = action || params.get('action');
        }
      }
    }

    if (!mac || !action) {
      return json({ success: false, error: 'Missing mac or action' }, { status: 400 });
    }

    // Normalize MAC address
    const normalizedMac = mac.toUpperCase().replace(/-/g, ':');

    // Find station by MAC
    const stations = await getPsStations();
    const station = stations.find(s =>
      s.macAddress.toUpperCase().replace(/-/g, ':') === normalizedMac
    );

    if (!station) {
      console.log(`[Webhook] Unknown MAC: ${normalizedMac}`);
      return json({ success: false, error: 'Unknown MAC address' }, { status: 404 });
    }

    if (station.status === 'maintenance') {
      return json({ success: true, message: 'Station in maintenance, skipped' });
    }

    // Check for active session via Convex
    const statuses = await getStationStatuses();
    const stationStatus = statuses.find(s => s.station._id === station._id);
    const activeSession = stationStatus?.activeSession ?? null;
    const previousState = getStationOnlineState(normalizedMac);

    if (action === 'connect' || action === 'up') {
      // Only auto-start on state TRANSITION from down/unknown to up
      const isFirstConnect = previousState !== 'up';
      setStationOnlineState(normalizedMac, 'up');

      // Cancel any pending disconnect grace period timer
      const pendingTimer = disconnectTimers.get(station._id);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        disconnectTimers.delete(station._id);
        console.log(`[Webhook] Cancelled disconnect timer for ${station.name} (device back online)`);
      }

      // Update Convex isOnline immediately (instant dashboard update)
      await bulkUpdateStationOnlineStatus([{ id: station._id, isOnline: true }]);

      // Always block internet when PS comes online
      if (isFirstConnect) {
        await resetInternetToOff(station);
      }

      // Resume paused session if device came back online
      if (activeSession && activeSession.pausedAt) {
        try {
          await resumePsSession(activeSession._id);
          console.log(`[Webhook] Resumed session for ${station.name} - device back online`);
          lastWebhookUpdate = Date.now();
        } catch (e) {
          console.error(`[Webhook] Failed to resume session for ${station.name}:`, e);
        }
      }

      if (!activeSession && isFirstConnect) {
        // Check if station is in manual-end cooldown
        if (isInManualEndCooldown(station._id)) {
          console.log(`[Webhook] Station ${station._id} in cooldown - not auto-starting`);
          return json({ success: true, message: 'Station in manual-end cooldown, no auto-start' });
        }

        // Auto-start session with +1 minute delay (PS boot time before actual play)
        const delayedStart = Date.now() + 60_000;
        console.log(`[Webhook] Auto-starting session for ${station._id} (${station.nameAr}) - start time +1min`);
        const sessionId = await startPsSession(station._id, 'auto', undefined, undefined, delayedStart);
        lastWebhookUpdate = Date.now();
        return json({ success: true, action: 'started', sessionId });
      }

      if (!isFirstConnect) {
        return json({ success: true, message: 'Device already online, no action taken' });
      }
      return json({ success: true, message: 'Session already active' });
    }

    if (action === 'disconnect' || action === 'down') {
      setStationOnlineState(normalizedMac, 'down');

      // Update Convex isOnline immediately (instant dashboard update)
      await bulkUpdateStationOnlineStatus([{ id: station._id, isOnline: false }]);

      // Clear manual-end cooldown since device actually disconnected
      clearManualEndCooldown(station._id);

      // Reset internet to OFF when PS disconnects
      await resetInternetToOff(station);

      // Pause active session with grace period (don't pause on brief ping failures)
      if (activeSession && !activeSession.pausedAt) {
        // Only start a timer if one isn't already running
        if (!disconnectTimers.has(station._id)) {
          const stationId = station._id;
          const stationName = station.name;
          const sessionId = activeSession._id;

          console.log(`[Webhook] Starting ${DISCONNECT_GRACE_PERIOD_MS / 1000}s disconnect grace period for ${stationName}`);

          const timer = setTimeout(async () => {
            disconnectTimers.delete(stationId);
            // Re-check: is the device still offline?
            const currentState = getStationOnlineState(normalizedMac);
            if (currentState !== 'up') {
              try {
                await pausePsSession(sessionId);
                console.log(`[Webhook] Paused session for ${stationName} - offline for ${DISCONNECT_GRACE_PERIOD_MS / 1000}s`);
                lastWebhookUpdate = Date.now();
              } catch (e) {
                console.error(`[Webhook] Failed to pause session for ${stationName}:`, e);
              }
            } else {
              console.log(`[Webhook] Grace period expired but ${stationName} is back online - not pausing`);
            }
          }, DISCONNECT_GRACE_PERIOD_MS);

          disconnectTimers.set(stationId, timer);
        }

        return json({ success: true, message: 'Disconnect received - grace period started before pausing session' });
      }

      return json({ success: true, message: activeSession ? 'Session already paused' : 'No active session' });
    }

    return json({ success: false, error: 'Invalid action. Use "connect/up" or "disconnect/down"' }, { status: 400 });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

/**
 * GET /api/playstation/webhook
 *
 * Returns last update timestamp (for UI polling)
 */
export const GET: RequestHandler = async () => {
  return json({
    lastUpdate: lastWebhookUpdate,
    timestamp: Date.now()
  });
};
