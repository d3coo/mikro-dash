import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStationStatuses } from '$lib/server/convex';

export const GET: RequestHandler = async () => {
  try {
    const statuses = await getStationStatuses();
    const now = Date.now();

    const stations = statuses.map(s => {
      let session = null;

      if (s.activeSession) {
        session = {
          startedAt: s.activeSession.startedAt,
          elapsedMinutes: s.elapsedMinutes,
          currentCost: s.currentCost / 100 // Convert to EGP
        };
      }

      return {
        id: s.station._id,
        name: s.station.name,
        nameAr: s.station.nameAr,
        status: s.station.status,
        hourlyRate: s.station.hourlyRate / 100,
        session
      };
    });

    return json({
      stations,
      timestamp: now
    });
  } catch (error) {
    console.error('Monitor status error:', error);
    return json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { status: 500 });
  }
};
