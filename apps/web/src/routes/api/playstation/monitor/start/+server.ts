import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { startSession, getStationById } from '$lib/server/services/playstation';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    // Check PIN
    const pin = url.searchParams.get('pin');
    const staffPinSetting = db.select().from(settings).where(eq(settings.key, 'staff_pin')).get();
    const staffPin = staffPinSetting?.value || '1234'; // Default PIN

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

    const station = getStationById(stationId);
    if (!station) {
      return json({
        success: false,
        error: 'Station not found'
      }, { status: 404 });
    }

    const session = startSession(stationId, 'manual');

    return json({
      success: true,
      session: {
        id: session.id,
        stationId: session.stationId,
        startedAt: session.startedAt,
        hourlyRate: session.hourlyRateSnapshot / 100
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
