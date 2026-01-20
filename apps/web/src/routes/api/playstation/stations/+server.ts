import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStationStatuses } from '$lib/server/services/playstation';

export const GET: RequestHandler = async () => {
  try {
    const statuses = await getStationStatuses();

    const stations = statuses.map(s => ({
      id: s.station.id,
      name: s.station.name,
      nameAr: s.station.nameAr,
      macAddress: s.station.macAddress,
      hourlyRate: s.station.hourlyRate / 100, // Convert to EGP
      status: s.station.status,
      isOnline: s.isOnline,
      inGracePeriod: s.inGracePeriod,
      session: s.activeSession ? {
        id: s.activeSession.id,
        startedAt: s.activeSession.startedAt,
        elapsedMinutes: s.elapsedMinutes,
        currentCost: s.currentCost / 100 // Convert to EGP
      } : null
    }));

    return json({
      success: true,
      stations,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Failed to get stations:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
