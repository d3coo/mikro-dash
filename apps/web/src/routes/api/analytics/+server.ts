import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAnalyticsData, getTodayStats, getWeekStats, getMonthStats } from '$lib/server/services/analytics';

/**
 * GET /api/analytics - Get analytics data
 * Query params:
 *   - period: 'today' | 'week' | 'month' (default: 'today')
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const period = (url.searchParams.get('period') || 'today') as 'today' | 'week' | 'month';

    // Validate period
    if (!['today', 'week', 'month'].includes(period)) {
      return json({ error: 'Invalid period. Use: today, week, or month' }, { status: 400 });
    }

    const data = await getAnalyticsData(period);

    return json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch analytics'
    }, { status: 500 });
  }
};
