import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getPsStations,
  startPsSession,
  getActivePsSessions,
  pausePsSession,
  resumePsSession,
  bulkUpdateStationOnlineStatus,
} from '$lib/server/convex';
import {
  getStationOnlineState,
  setStationOnlineState,
  isInManualEndCooldown,
  normalizeMac,
} from '$lib/server/services/playstation';

/**
 * POST /api/playstation/webhook
 *
 * Webhook endpoint for MikroTik netwatch.
 * Netwatch pings each PS IP and fires this webhook on up/down.
 *
 * CONNECT: Cancel disconnect timer, set online, resume/auto-start session.
 * DISCONNECT: Start debounce timer. If no reconnect within 30s, pause session.
 *
 * RACE CONDITION PREVENTION:
 * All timer operations and state updates are SYNCHRONOUS and happen BEFORE
 * any async operations (like getPsStations). This ensures that concurrent
 * connect/disconnect requests cannot interleave during async gaps and miss
 * each other's timers.
 *
 * Timer key is MAC address (available immediately from URL params, no async
 * station lookup needed). This means the connect handler can cancel a pending
 * disconnect timer in the same tick it starts, before yielding to the event loop.
 *
 * HMR PROTECTION:
 * Timer map and online state are stored on globalThis to survive Vite HMR
 * module reloads. Without this, old setTimeout callbacks reference stale
 * module-scope maps and their cancellation by new connect requests fails.
 */

const DISCONNECT_DEBOUNCE_MS = 5_000; // 5 seconds

// Store disconnect timers on globalThis to survive Vite HMR module reloads.
// Key: normalized MAC address. Value: setTimeout handle.
const TIMERS_KEY = '__ps_disconnect_timers__';
function getDisconnectTimers(): Map<string, ReturnType<typeof setTimeout>> {
  if (!(globalThis as any)[TIMERS_KEY]) {
    (globalThis as any)[TIMERS_KEY] = new Map<string, ReturnType<typeof setTimeout>>();
  }
  return (globalThis as any)[TIMERS_KEY];
}

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    let mac: string | null = null;
    let action: string | null = null;

    // Check URL params first
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
        try {
          const formData = await request.formData();
          mac = mac || formData.get('mac') as string;
          action = action || formData.get('action') as string;
        } catch {
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

    const normalizedMac = normalizeMac(mac);
    const timers = getDisconnectTimers();

    // ===== CONNECT =====
    if (action === 'connect' || action === 'up') {
      // --- SYNCHRONOUS SECTION (before any async/await) ---
      // Cancel any pending disconnect timer OR reservation IMMEDIATELY.
      // The disconnect handler reserves a slot (null) before its async gap,
      // so we can detect and cancel it even if the real timer hasn't been created yet.
      if (timers.has(normalizedMac)) {
        const existingTimer = timers.get(normalizedMac);
        if (existingTimer) clearTimeout(existingTimer);
        timers.delete(normalizedMac);
        console.log(`[Webhook] MAC ${normalizedMac}: reconnected, cancelled disconnect timer`);
      }

      const previousState = getStationOnlineState(normalizedMac);
      setStationOnlineState(normalizedMac, 'up');

      // --- ASYNC SECTION (station lookup and session management) ---
      const stations = await getPsStations();
      const station = stations.find(s => normalizeMac(s.macAddress) === normalizedMac);

      if (!station) {
        return json({ success: true, message: 'Online state set, unknown station' });
      }

      if (station.status === 'maintenance') {
        return json({ success: true, message: 'Station in maintenance, skipped' });
      }

      const stationId = station._id as string;
      console.log(`[Webhook] ${station.name}: connect`);

      await bulkUpdateStationOnlineStatus([{ id: stationId, isOnline: true }]);

      // Resume paused session
      const activeSessions = await getActivePsSessions();
      const activeSession = activeSessions.find(s => (s.stationId as string) === stationId && !s.endedAt);

      if (activeSession && activeSession.pausedAt) {
        try {
          await resumePsSession(activeSession._id as string);
          console.log(`[Webhook] ${station.name}: resumed session`);
        } catch (e) {
          console.error(`[Webhook] Failed to resume session for ${station.name}:`, e);
        }
        return json({ success: true, action: 'resumed' });
      }

      // Auto-start session on first connect (no existing session)
      const isFirstConnect = previousState !== 'up';
      if (!activeSession && isFirstConnect) {
        if (isInManualEndCooldown(stationId)) {
          return json({ success: true, message: 'Station in cooldown, no auto-start' });
        }

        try {
          const delayedStart = Date.now() + 60_000;
          console.log(`[Webhook] ${station.name}: auto-starting session (+1min delay)`);
          const sessionId = await startPsSession(stationId, 'auto', undefined, undefined, delayedStart);
          return json({ success: true, action: 'started', sessionId });
        } catch (e) {
          console.error(`[Webhook] Failed to auto-start session for ${station.name}:`, e);
        }
      }

      return json({ success: true, message: 'Online state updated' });
    }

    // ===== DISCONNECT =====
    if (action === 'disconnect' || action === 'down') {
      // --- SYNCHRONOUS SECTION ---
      // Dedup check using MAC key — no async needed.
      if (timers.has(normalizedMac)) {
        return json({ success: true, message: 'Disconnect timer already pending' });
      }

      // Reserve a slot in the map BEFORE any async operations.
      // This ensures the connect handler can find and cancel our intent
      // even during the async gap (getPsStations takes time).
      // The connect handler checks timers.has() and deletes the entry.
      timers.set(normalizedMac, null as any);

      // Mark as disconnecting IMMEDIATELY so:
      // 1. Timer callback can detect if a reconnect happened during debounce
      // 2. Connect handler sets this back to 'up' synchronously
      setStationOnlineState(normalizedMac, 'down');

      // --- ASYNC: Station lookup for timer callback context ---
      const stations = await getPsStations();
      const station = stations.find(s => normalizeMac(s.macAddress) === normalizedMac);

      if (!station) {
        // Clean up our reservation
        if (timers.get(normalizedMac) === null) timers.delete(normalizedMac);
        return json({ success: false, error: 'Unknown MAC address' }, { status: 404 });
      }

      if (station.status === 'maintenance') {
        if (timers.get(normalizedMac) === null) timers.delete(normalizedMac);
        return json({ success: true, message: 'Station in maintenance, skipped' });
      }

      // Check if a connect handler cancelled our reservation during the async gap
      if (!timers.has(normalizedMac)) {
        console.log(`[Webhook] ${station.name}: reconnected during disconnect processing, aborting`);
        return json({ success: true, message: 'Reconnected during disconnect processing' });
      }

      const stationId = station._id as string;
      console.log(`[Webhook] ${station.name}: disconnect detected, starting ${DISCONNECT_DEBOUNCE_MS / 1000}s debounce`);

      const timer = setTimeout(async () => {
        timers.delete(normalizedMac);

        // Check if a connect came in during the debounce period.
        // The connect handler sets state to 'up' SYNCHRONOUSLY, so this
        // check is reliable even with concurrent requests.
        const currentState = getStationOnlineState(normalizedMac);
        if (currentState === 'up') {
          console.log(`[Webhook] ${station.name}: reconnected during debounce, skipping pause`);
          return;
        }

        // Update Convex isOnline
        try {
          await bulkUpdateStationOnlineStatus([{ id: stationId, isOnline: false }]);
        } catch (e) {
          console.error(`[Webhook] Failed to update isOnline for ${station.name}:`, e);
        }

        // Pause active session
        try {
          const sessions = await getActivePsSessions();
          const session = sessions.find(s => (s.stationId as string) === stationId && !s.endedAt);
          if (session && !session.pausedAt) {
            await pausePsSession(session._id as string, 'webhook-disconnect');
            console.log(`[Webhook] ${station.name}: paused session (offline for ${DISCONNECT_DEBOUNCE_MS / 1000}s)`);
          }
        } catch (e) {
          console.error(`[Webhook] Failed to pause session for ${station.name}:`, e);
        }
      }, DISCONNECT_DEBOUNCE_MS);

      timers.set(normalizedMac, timer);
      return json({ success: true, message: `Disconnect debounce started (${DISCONNECT_DEBOUNCE_MS / 1000}s)` });
    }

    return json({ success: false, error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

export const GET: RequestHandler = async () => {
  const timers = getDisconnectTimers();
  return json({
    pendingDisconnects: timers.size,
    debounceMs: DISCONNECT_DEBOUNCE_MS,
    timestamp: Date.now()
  });
};
