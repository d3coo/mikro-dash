import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStationStatuses, calculateSessionCost } from '$lib/server/services/playstation';

export const GET: RequestHandler = async () => {
  try {
    const statuses = await getStationStatuses();
    const now = Date.now();

    const stations = statuses.map(s => {
      let session = null;

      if (s.activeSession) {
        const elapsedMs = now - s.activeSession.startedAt;
        const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
        const currentCost = calculateSessionCost(s.activeSession, now);

        session = {
          startedAt: s.activeSession.startedAt,
          elapsedMinutes,
          currentCost: currentCost / 100 // Convert to EGP
        };
      }

      return {
        id: s.station.id,
        name: s.station.name,
        nameAr: s.station.nameAr,
        status: s.station.status === 'occupied' ? 'occupied' : s.station.status === 'maintenance' ? 'maintenance' : 'available',
        hourlyRate: s.station.hourlyRate / 100, // Convert to EGP
        isOnline: s.isOnline,
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
