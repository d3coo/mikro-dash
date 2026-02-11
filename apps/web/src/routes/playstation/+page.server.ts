import type { PageServerLoad, Actions } from './$types';
import {
  startPsSession,
  endPsSession,
  updatePsSessionStartTime,
  getPsStationById,
  addPsSessionOrder,
  removePsSessionOrder,
  updatePsSessionTimer,
  addPsSessionCharge,
  updatePsSessionCharge,
  deletePsSessionCharge,
  transferPsSession,
  switchPsSessionMode,
  switchPsStation,
} from '$lib/server/convex';
import { syncStationStatus } from '$lib/server/services/playstation';
import * as monitorControl from '$lib/server/services/monitor-control';
import { fail } from '@sveltejs/kit';

/**
 * Load returns empty initial data.
 * Client-side Convex subscriptions (convex-state.svelte.ts) provide
 * real-time data via WebSocket — no slow HTTP round-trips needed.
 */
export const load: PageServerLoad = async () => {
  return {
    stationStatuses: [] as any[],
    analytics: { totalSessions: 0, totalMinutes: 0, totalRevenue: 0 },
    stationCount: 0,
    menuItems: [] as any[],
    timerAlerts: [] as any[],
    stationEarnings: [] as any[],
    activeSessions: [] as any[]
  };
};

export const actions: Actions = {
  startSession: async ({ request }) => {
    const formData = await request.formData();
    const stationId = formData.get('stationId') as string;
    const timerMinutes = formData.get('timerMinutes') as string;
    const costLimit = formData.get('costLimit') as string;
    const customStartTime = formData.get('customStartTime') as string;

    if (!stationId) {
      return fail(400, { error: 'Station ID is required' });
    }

    try {
      const timer = timerMinutes ? parseInt(timerMinutes, 10) : undefined;
      const costLimitPiasters = costLimit ? parseInt(costLimit, 10) * 100 : undefined;
      const startTime = customStartTime ? parseInt(customStartTime, 10) : undefined;
      await startPsSession(stationId, 'manual', timer, costLimitPiasters, startTime);

      // Send notification to monitor (async, don't wait)
      const station = await getPsStationById(stationId);
      if (station?.monitorIp) {
        monitorControl.onSessionStart(station as any, timer)
          .catch(err => console.error('[MonitorControl] Session start failed:', err));
      }

      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to start session' });
    }
  },

  updateStartTime: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const newStartTime = formData.get('newStartTime') as string;

    if (!sessionId || !newStartTime) {
      return fail(400, { error: 'Session ID and new start time are required' });
    }

    try {
      await updatePsSessionStartTime(sessionId, parseInt(newStartTime, 10));
      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to update start time' });
    }
  },

  endSession: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;

    if (!sessionId) {
      return fail(400, { error: 'Session ID is required' });
    }

    try {
      const result = await endPsSession(sessionId);
      const ordersCost = result.ordersCost || 0;
      const totalCost = (result.totalCost || 0) + ordersCost;

      // Send notification to monitor (async, don't wait)
      const station = await getPsStationById(result.stationId);
      if (station?.monitorIp) {
        monitorControl.onSessionEnd(station as any)
          .catch(err => console.error('[MonitorControl] Session end failed:', err));
      }

      return { success: true, totalCost, gamingCost: result.totalCost, ordersCost };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to end session' });
    }
  },

  endSessionWithAmount: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const finalAmount = formData.get('finalAmount') as string;

    if (!sessionId) {
      return fail(400, { error: 'Session ID is required' });
    }

    try {
      const customCost = finalAmount ? parseInt(finalAmount, 10) : undefined;
      const result = await endPsSession(sessionId, undefined, customCost);
      const ordersCost = result.ordersCost || 0;
      const totalCost = customCost !== undefined ? customCost : (result.totalCost || 0) + ordersCost;

      // Send notification to monitor (async, don't wait)
      const station = await getPsStationById(result.stationId);
      if (station?.monitorIp) {
        monitorControl.onSessionEnd(station as any)
          .catch(err => console.error('[MonitorControl] Session end failed:', err));
      }

      return { success: true, totalCost, gamingCost: result.totalCost, ordersCost };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to end session' });
    }
  },

  sync: async () => {
    try {
      const result = await syncStationStatus();
      return {
        success: true,
        started: result.started.length,
        ended: result.ended.length
      };
    } catch (error) {
      return fail(500, { error: error instanceof Error ? error.message : 'Sync failed' });
    }
  },

  addOrder: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const menuItemId = formData.get('menuItemId') as string;
    const quantity = formData.get('quantity') as string;

    if (!sessionId || !menuItemId) {
      return fail(400, { error: 'Session ID and Menu Item ID are required' });
    }

    try {
      await addPsSessionOrder(sessionId, menuItemId, quantity ? parseInt(quantity, 10) : 1);
      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to add order' });
    }
  },

  addMultipleOrders: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const itemsJson = formData.get('items') as string;

    if (!sessionId || !itemsJson) {
      return fail(400, { error: 'Session ID and items are required' });
    }

    try {
      const items = JSON.parse(itemsJson) as Array<{ menuItemId: string; quantity: number }>;

      if (!Array.isArray(items) || items.length === 0) {
        return fail(400, { error: 'At least one item is required' });
      }

      for (const item of items) {
        await addPsSessionOrder(sessionId, item.menuItemId, item.quantity);
      }

      return { success: true, count: items.length };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to add orders' });
    }
  },

  removeOrder: async ({ request }) => {
    const formData = await request.formData();
    const orderId = formData.get('orderId') as string;

    if (!orderId) {
      return fail(400, { error: 'Order ID is required' });
    }

    try {
      await removePsSessionOrder(orderId);
      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to remove order' });
    }
  },

  setTimer: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const timerMinutes = formData.get('timerMinutes') as string;

    if (!sessionId) {
      return fail(400, { error: 'Session ID is required' });
    }

    try {
      const timer = timerMinutes ? parseInt(timerMinutes, 10) : undefined;
      await updatePsSessionTimer(sessionId, timer);
      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to set timer' });
    }
  },

  dismissAlert: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;

    if (!sessionId) {
      return fail(400, { error: 'Session ID is required' });
    }

    try {
      await updatePsSessionTimer(sessionId, undefined, true);
      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to dismiss alert' });
    }
  },

  // ===== CHARGES =====

  addCharge: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const amount = formData.get('amount') as string;
    const reason = formData.get('reason') as string;

    if (!sessionId || !amount) {
      return fail(400, { error: 'Session ID and amount are required' });
    }

    try {
      const amountPiasters = Math.round(parseFloat(amount) * 100);
      await addPsSessionCharge(sessionId, amountPiasters, reason || undefined);
      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to add charge' });
    }
  },

  updateCharge: async ({ request }) => {
    const formData = await request.formData();
    const chargeId = formData.get('chargeId') as string;
    const amount = formData.get('amount') as string;
    const reason = formData.get('reason') as string;

    if (!chargeId || !amount) {
      return fail(400, { error: 'Charge ID and amount are required' });
    }

    try {
      const amountPiasters = Math.round(parseFloat(amount) * 100);
      await updatePsSessionCharge(chargeId, amountPiasters, reason);
      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to update charge' });
    }
  },

  deleteCharge: async ({ request }) => {
    const formData = await request.formData();
    const chargeId = formData.get('chargeId') as string;

    if (!chargeId) {
      return fail(400, { error: 'Charge ID is required' });
    }

    try {
      await deletePsSessionCharge(chargeId);
      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to delete charge' });
    }
  },

  // ===== TRANSFERS =====

  transferSession: async ({ request }) => {
    const formData = await request.formData();
    const fromSessionId = formData.get('fromSessionId') as string;
    const toSessionId = formData.get('toSessionId') as string;
    const includeOrders = formData.get('includeOrders') === 'true';

    if (!fromSessionId || !toSessionId) {
      return fail(400, { error: 'Source and target session IDs are required' });
    }

    try {
      const transfer = await transferPsSession(fromSessionId, toSessionId, includeOrders);
      return { success: true, transfer };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to transfer session' });
    }
  },

  // ===== MODE SWITCHING =====

  switchMode: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const mode = formData.get('mode') as 'single' | 'multi';

    if (!sessionId || !mode) {
      return fail(400, { error: 'Session ID and mode are required' });
    }

    if (mode !== 'single' && mode !== 'multi') {
      return fail(400, { error: 'Mode must be single or multi' });
    }

    try {
      await switchPsSessionMode(sessionId, mode);
      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to switch mode' });
    }
  },

  // ===== SWITCH STATION =====

  switchStation: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;
    const newStationId = formData.get('newStationId') as string;

    if (!sessionId || !newStationId) {
      return fail(400, { error: 'Session ID and new station ID are required' });
    }

    try {
      await switchPsStation(sessionId, newStationId);
      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to switch station' });
    }
  }
};
