import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllVoucherUsage, syncActiveSessionsToHistory } from '$lib/server/services/voucher-usage';

/**
 * GET /api/voucher-history - Get all stored voucher usage history
 */
export const GET: RequestHandler = async () => {
  const history = await getAllVoucherUsage();

  return json({
    success: true,
    history: history.map(h => ({
      ...h,
      firstConnectedAt: new Date(h.firstConnectedAt).toISOString(),
      lastConnectedAt: new Date(h.lastConnectedAt).toISOString(),
      totalMB: Math.round(h.totalBytes / 1024 / 1024 * 10) / 10
    })),
    count: history.length
  });
};

/**
 * POST /api/voucher-history - Sync current active sessions to history
 */
export const POST: RequestHandler = async () => {
  try {
    const result = await syncActiveSessionsToHistory();
    return json({
      success: true,
      message: `Synced ${result.synced} active sessions to history`
    });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    }, { status: 500 });
  }
};
