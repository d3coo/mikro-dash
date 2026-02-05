import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { endSession, getActiveSessionForStation } from '$lib/server/services/playstation';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    // Check PIN
    const pin = url.searchParams.get('pin');
    const staffPinResults = await db.select().from(settings).where(eq(settings.key, 'staff_pin'));
    const staffPin = staffPinResults[0]?.value || '1234'; // Default PIN

    if (pin !== staffPin) {
      return json({
        success: false,
        error: 'Invalid PIN'
      }, { status: 401 });
    }

    const body = await request.json();
    const stationId = body.stationId as string;
    const sessionId = body.sessionId as number | undefined;

    if (!stationId && !sessionId) {
      return json({
        success: false,
        error: 'Station ID or Session ID is required'
      }, { status: 400 });
    }

    let targetSessionId = sessionId;

    // If stationId provided, find active session
    if (!targetSessionId && stationId) {
      const activeSession = await getActiveSessionForStation(stationId);
      if (!activeSession) {
        return json({
          success: false,
          error: 'No active session on this station'
        }, { status: 404 });
      }
      targetSessionId = activeSession.id;
    }

    const session = await endSession(targetSessionId!);

    return json({
      success: true,
      session: {
        id: session.id,
        stationId: session.stationId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        totalCost: session.totalCost ? session.totalCost / 100 : null,
        durationMinutes: session.endedAt ? Math.floor((session.endedAt - session.startedAt) / (1000 * 60)) : null
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
