import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncStationStatus } from '$lib/server/services/playstation';

export const POST: RequestHandler = async () => {
  try {
    const result = await syncStationStatus();

    return json({
      success: true,
      started: result.started,
      ended: result.ended,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Sync error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    }, { status: 500 });
  }
};
