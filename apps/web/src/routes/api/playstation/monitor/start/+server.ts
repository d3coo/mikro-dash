import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { startPsSession, getPsStationById, getSetting } from '$lib/server/convex';

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

    if (!stationId) {
      return json({
        success: false,
        error: 'Station ID is required'
      }, { status: 400 });
    }

    const station = await getPsStationById(stationId);
    if (!station) {
      return json({
        success: false,
        error: 'Station not found'
      }, { status: 404 });
    }

    const sessionId = await startPsSession(stationId, 'manual');

    return json({
      success: true,
      session: {
        id: sessionId,
        stationId,
        startedAt: Date.now(),
        hourlyRate: station.hourlyRate / 100
      }
    });
  } catch (error) {
    console.error('Start session error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start session'
    }, { status: 500 });
  }
};
