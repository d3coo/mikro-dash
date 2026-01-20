import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getBackgroundSyncStatus,
  startBackgroundSync,
  stopBackgroundSync,
  forceSync
} from '$lib/server/services/ps-background-sync';

/**
 * GET /api/playstation/sync-status
 * Get the current status of the background sync service
 */
export const GET: RequestHandler = async () => {
  const status = getBackgroundSyncStatus();
  return json(status);
};

/**
 * POST /api/playstation/sync-status
 * Control the background sync service
 *
 * Body: { action: 'start' | 'stop' | 'force' }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case 'start':
        startBackgroundSync();
        return json({ success: true, message: 'Background sync started' });

      case 'stop':
        stopBackgroundSync();
        return json({ success: true, message: 'Background sync stopped' });

      case 'force':
        const result = await forceSync();
        return json({
          success: true,
          message: 'Force sync completed',
          result
        });

      default:
        return json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
