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
  getStationEarnings
} from '$lib/server/services/playstation';
import * as freekiosk from '$lib/server/services/freekiosk';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const stationStatuses = await getStationStatuses();
  const analytics = getPsAnalytics('today');
  const stations = getStations();
  const menuItems = getMenuItems();
  const timerAlerts = getTimerAlerts();
  const stationEarnings = getStationEarnings();

  // Get orders for active session or last session
  const sessionsWithOrders = stationStatuses.map(status => {
    if (status.activeSession) {
      const orders = getSessionOrders(status.activeSession.id);
      return { ...status, orders, lastSessionOrders: [] };
    }
    if (status.lastSession) {
      const lastSessionOrders = getSessionOrders(status.lastSession.id);
      return { ...status, orders: [], lastSessionOrders };
    }
    return { ...status, orders: [], lastSessionOrders: [] };
  });

  return {
    stationStatuses: sessionsWithOrders,
    analytics,
    stationCount: stations.length,
    menuItems,
    timerAlerts,
    stationEarnings
  };
};

export const actions: Actions = {
  startSession: async ({ request }) => {
    const formData = await request.formData();
    const stationId = formData.get('stationId') as string;
    const timerMinutes = formData.get('timerMinutes') as string;

    if (!stationId) {
      return fail(400, { error: 'Station ID is required' });
    }

    try {
      const timer = timerMinutes ? parseInt(timerMinutes, 10) : undefined;
      startSession(stationId, 'manual', timer);

      // Send notification to monitor (async, don't wait)
      const station = getStationById(stationId);
      if (station?.monitorIp) {
        freekiosk.notifySessionStart(
          station.monitorIp,
          station.monitorPort || 8080,
          station.nameAr,
          timer
        ).catch(err => console.error('[FreeKiosk] Session start notification failed:', err));
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
        freekiosk.notifySessionEnd(
          station.monitorIp,
          station.monitorPort || 8080,
          station.nameAr,
          true // turn off screen
        ).catch(err => console.error('[FreeKiosk] Session end notification failed:', err));
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
        freekiosk.notifySessionEnd(
          station.monitorIp,
          station.monitorPort || 8080,
          station.nameAr,
          true // turn off screen
        ).catch(err => console.error('[FreeKiosk] Session end notification failed:', err));
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
  }
};
