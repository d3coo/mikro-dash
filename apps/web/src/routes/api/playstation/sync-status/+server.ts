import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncPsRouterRules } from '$lib/server/services/playstation';

/**
 * GET /api/playstation/sync-status
 * Returns service status info.
 * Online detection is handled by netwatch webhooks (see webhook/+server.ts).
 */
export const GET: RequestHandler = async () => {
  return json({
    mode: 'webhook',
    message: 'Online detection handled by netwatch webhooks. No background polling.',
    timestamp: Date.now()
  });
};

/**
 * POST /api/playstation/sync-status
 * Control actions: only 'sync-rules' to re-sync router rules.
 *
 * Body: { action: 'sync-rules' }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === 'sync-rules') {
      await syncPsRouterRules();
      return json({ success: true, message: 'Router rules synced' });
    }

    return json({ success: false, error: 'Invalid action. Use: sync-rules' }, { status: 400 });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
