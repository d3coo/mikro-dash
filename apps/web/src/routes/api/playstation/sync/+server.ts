import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncPsRouterRules } from '$lib/server/services/playstation';

/**
 * POST /api/playstation/sync
 * Triggers a router rules sync (ACL, hotspot bypass, DHCP, netwatch).
 * Online detection is handled by netwatch webhooks — not by this endpoint.
 */
export const POST: RequestHandler = async () => {
  try {
    await syncPsRouterRules();

    return json({
      success: true,
      message: 'Router rules synced',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Router rules sync error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    }, { status: 500 });
  }
};
