import type { PageServerLoad, Actions } from './$types';
import {
  getStationStatuses,
  syncStationStatus,
  startSession,
  endSession,
  getPsAnalytics,
  getStations,
  getStationById,
  getMenuItems,
  getSessionOrders,
  addOrderToSession,
  removeOrderFromSession,
  setSessionTimer,
  getTimerAlerts,
  markTimerNotified,
  getStationEarnings,
  addCharge,
  updateCharge,
  deleteCharge,
  getSessionCharges,
  transferSession,
  getSessionTransfers,
  switchMode,
  getSessionSegments,
  getActiveSessions,
  calculateSessionCostWithSegments,
  switchStation
} from '$lib/server/services/playstation';
import * as monitorControl from '$lib/server/services/monitor-control';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const stationStatuses = await getStationStatuses();
  const analytics = getPsAnalytics('today');
  const stations = getStations();
  const menuItems = getMenuItems();
  const timerAlerts = getTimerAlerts();
  const stationEarnings = getStationEarnings();
  const activeSessions = getActiveSessions();

  // Get orders, charges, transfers, and segments for active session or last session
  const sessionsWithExtras = stationStatuses.map(status => {
    if (status.activeSession) {
      const orders = getSessionOrders(status.activeSession.id);
      const charges = getSessionCharges(status.activeSession.id);
      const transfers = getSessionTransfers(status.activeSession.id);
      const segments = getSessionSegments(status.activeSession.id);
      const costBreakdown = calculateSessionCostWithSegments(status.activeSession);
      return {
        ...status,
        orders,
        charges,
        transfers,
        segments,
        costBreakdown,
        lastSessionOrders: [],
        lastSessionCharges: [],
        lastSessionTransfers: [],
        lastSessionSegments: []
      };
    }
    if (status.lastSession) {
      const lastSessionOrders = getSessionOrders(status.lastSession.id);
      const lastSessionCharges = getSessionCharges(status.lastSession.id);
      const lastSessionTransfers = getSessionTransfers(status.lastSession.id);
      const lastSessionSegments = getSessionSegments(status.lastSession.id);
      return {
        ...status,
        orders: [],
        charges: [],
        transfers: [],
        segments: [],
        costBreakdown: null,
        lastSessionOrders,
        lastSessionCharges,
        lastSessionTransfers,
        lastSessionSegments
      };
    }
    return {
      ...status,
      orders: [],
      charges: [],
      transfers: [],
      segments: [],
      costBreakdown: null,
      lastSessionOrders: [],
      lastSessionCharges: [],
      lastSessionTransfers: [],
      lastSessionSegments: []
    };
  });

  return {
    stationStatuses: sessionsWithExtras,
    analytics,
    stationCount: stations.length,
    menuItems,
    timerAlerts,
    stationEarnings,
    activeSessions
  };
};

export const actions: Actions = {
  startSession: async ({ request }) => {
    const formData = await request.formData();
    const stationId = formData.get('stationId') as string;
    const timerMinutes = formData.get('timerMinutes') as string;
    const costLimit = formData.get('costLimit') as string;

    if (!stationId) {
      return fail(400, { error: 'Station ID is required' });
    }

    try {
      const timer = timerMinutes ? parseInt(timerMinutes, 10) : undefined;
      const costLimitPiasters = costLimit ? parseInt(costLimit, 10) * 100 : undefined; // Convert EGP to piasters
      startSession(stationId, 'manual', timer, costLimitPiasters);

      // Send notification to monitor (async, don't wait)
      const station = getStationById(stationId);
      if (station?.monitorIp) {
        monitorControl.onSessionStart(station, timer)
          .catch(err => console.error('[MonitorControl] Session start failed:', err));
      }

      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to start session' });
    }
  },

  endSession: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;

    if (!sessionId) {
      return fail(400, { error: 'Session ID is required' });
    }

    try {
      const session = endSession(parseInt(sessionId, 10));
      const ordersCost = session.ordersCost || 0;
      const totalCost = (session.totalCost || 0) + ordersCost;

      // Send notification to monitor (async, don't wait)
      const station = getStationById(session.stationId);
      if (station?.monitorIp) {
        monitorControl.onSessionEnd(station)
          .catch(err => console.error('[MonitorControl] Session end failed:', err));
      }

      return { success: true, totalCost, gamingCost: session.totalCost, ordersCost };
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
      const session = endSession(parseInt(sessionId, 10), undefined, customCost);
      const ordersCost = session.ordersCost || 0;
      const totalCost = customCost !== undefined ? customCost : (session.totalCost || 0) + ordersCost;

      // Send notification to monitor (async, don't wait)
      const station = getStationById(session.stationId);
      if (station?.monitorIp) {
        monitorControl.onSessionEnd(station)
          .catch(err => console.error('[MonitorControl] Session end failed:', err));
      }

      return { success: true, totalCost, gamingCost: session.totalCost, ordersCost };
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
      addOrderToSession(
        parseInt(sessionId, 10),
        parseInt(menuItemId, 10),
        quantity ? parseInt(quantity, 10) : 1
      );
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
      const items = JSON.parse(itemsJson) as Array<{ menuItemId: number; quantity: number }>;

      if (!Array.isArray(items) || items.length === 0) {
        return fail(400, { error: 'At least one item is required' });
      }

      // Add all items to the session
      for (const item of items) {
        addOrderToSession(
          parseInt(sessionId, 10),
          item.menuItemId,
          item.quantity
        );
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
      removeOrderFromSession(parseInt(orderId, 10));
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
      const timer = timerMinutes ? parseInt(timerMinutes, 10) : null;
      setSessionTimer(parseInt(sessionId, 10), timer);
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
      markTimerNotified(parseInt(sessionId, 10));
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
      const amountPiasters = Math.round(parseFloat(amount) * 100); // Convert EGP to piasters
      addCharge(parseInt(sessionId, 10), amountPiasters, reason || undefined);
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
      updateCharge(parseInt(chargeId, 10), amountPiasters, reason);
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
      deleteCharge(parseInt(chargeId, 10));
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
      const transfer = transferSession(
        parseInt(fromSessionId, 10),
        parseInt(toSessionId, 10),
        includeOrders
      );
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
      switchMode(parseInt(sessionId, 10), mode);
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
      switchStation(parseInt(sessionId, 10), newStationId);
      return { success: true };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Failed to switch station' });
    }
  }
};
