import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { endPsSession, getStationStatuses, getSetting } from '$lib/server/convex';

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    // Check PIN
    const pin = url.searchParams.get('pin');
    const staffPin = await getSetting('staff_pin') || '1234';

    if (pin !== staffPin) {
      return json({
        success: false,
        error: 'Invalid PIN'
      }, { status: 401 });
    }

    const body = await request.json();
    const stationId = body.stationId as string;
    const sessionId = body.sessionId as string | undefined;

    if (!stationId && !sessionId) {
      return json({
        success: false,
        error: 'Station ID or Session ID is required'
      }, { status: 400 });
    }

    let targetSessionId = sessionId;

    // If stationId provided, find active session
    if (!targetSessionId && stationId) {
      const statuses = await getStationStatuses();
      const stationStatus = statuses.find(s => s.station._id === stationId);
      if (!stationStatus?.activeSession) {
        return json({
          success: false,
          error: 'No active session on this station'
        }, { status: 404 });
      }
      targetSessionId = stationStatus.activeSession._id;
    }

    const result = await endPsSession(targetSessionId!);

    return json({
      success: true,
      session: {
        id: result._id,
        stationId: result.stationId,
        totalCost: result.totalCost ? result.totalCost / 100 : null,
      }
    });
  } catch (error) {
    console.error('Stop session error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop session'
    }, { status: 500 });
  }
};
