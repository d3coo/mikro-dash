import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getStations,
  getActiveSessionForStation,
  startSession,
  endSession,
  getStationOnlineState,
  setStationOnlineState
} from '$lib/server/services/playstation';

// Track last webhook update time (for UI refresh)
let lastWebhookUpdate = Date.now();

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
    const stations = getStations();
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

    const activeSession = getActiveSessionForStation(station.id);
    const previousState = getStationOnlineState(normalizedMac);

    if (action === 'connect' || action === 'up') {
      // Only auto-start on state TRANSITION from down/unknown to up
      const isFirstConnect = previousState !== 'up';
      setStationOnlineState(normalizedMac, 'up');

      if (!activeSession && isFirstConnect) {
        // Auto-start session only on first connect
        console.log(`[Webhook] Auto-starting session for ${station.id} (${station.nameAr}) - first connect`);
        const session = startSession(station.id, 'auto');
        lastWebhookUpdate = Date.now();
        return json({ success: true, action: 'started', sessionId: session.id });
      }

      if (!isFirstConnect) {
        return json({ success: true, message: 'Device already online, no action taken' });
      }
      return json({ success: true, message: 'Session already active' });
    }

    if (action === 'disconnect' || action === 'down') {
      setStationOnlineState(normalizedMac, 'down');

      if (activeSession && activeSession.startedBy === 'auto') {
        // Only auto-end sessions that were auto-started
        console.log(`[Webhook] Auto-ending session for ${station.id} (${station.nameAr})`);
        const session = endSession(activeSession.id, 'Auto-ended: device disconnected (webhook)');
        lastWebhookUpdate = Date.now();
        return json({ success: true, action: 'ended', totalCost: session.totalCost });
      }

      if (activeSession && activeSession.startedBy === 'manual') {
        console.log(`[Webhook] Device disconnected but session was manual - not auto-ending for ${station.id}`);
        return json({ success: true, message: 'Manual session - not auto-ending' });
      }

      return json({ success: true, message: 'No active session' });
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
