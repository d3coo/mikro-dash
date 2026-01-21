import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getUnifiedAnalytics,
  aggregateUnifiedDailyStats,
  getRevenueBySegmentChart,
  getProfitBySegmentChart,
  backfillUnifiedDailyStats,
  type TimePeriod
} from '$lib/server/services/unified-analytics';

/**
 * GET /api/analytics/unified - Get unified analytics across all segments
 * Query params:
 *   - period: 'today' | 'week' | 'month' | 'custom' (default: 'today')
 *   - start: YYYY-MM-DD (required if period=custom)
 *   - end: YYYY-MM-DD (required if period=custom)
 *   - charts: 'true' to include chart data (default: false)
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const periodParam = url.searchParams.get('period') || 'today';
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const includeCharts = url.searchParams.get('charts') === 'true';

    // Validate period
    const validPeriods = ['today', 'week', 'month', 'custom'];
    if (!validPeriods.includes(periodParam)) {
      return json({
        success: false,
        error: 'Invalid period. Use: today, week, month, or custom'
      }, { status: 400 });
    }

    const period = periodParam as TimePeriod;

    // Validate custom range
    if (period === 'custom') {
      if (!start || !end) {
        return json({
          success: false,
          error: 'start and end dates are required for custom period'
        }, { status: 400 });
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(start) || !dateRegex.test(end)) {
        return json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD'
        }, { status: 400 });
      }

      if (start > end) {
        return json({
          success: false,
          error: 'start date must be before or equal to end date'
        }, { status: 400 });
      }
    }

    // Get unified analytics
    const customRange = period === 'custom' && start && end
      ? { start, end }
      : undefined;

    const analytics = await getUnifiedAnalytics(period, customRange);

    // Optionally include chart data
    let charts = null;
    if (includeCharts) {
      const chartDays = period === 'month' ? 30 : period === 'week' ? 7 : 7;
      const [revenueChart, profitChart] = await Promise.all([
        getRevenueBySegmentChart(chartDays),
        getProfitBySegmentChart(chartDays)
      ]);
      charts = {
        revenue: revenueChart,
        profit: profitChart
      };
    }

    return json({
      success: true,
      analytics,
      charts
    });
  } catch (error) {
    console.error('Get unified analytics error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch unified analytics'
    }, { status: 500 });
  }
};

/**
 * POST /api/analytics/unified - Trigger daily aggregation
 * Body: { date?: string } - YYYY-MM-DD, defaults to today
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const date = body.date || new Date().toISOString().split('T')[0];

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      }, { status: 400 });
    }

    const stats = await aggregateUnifiedDailyStats(date);

    return json({
      success: true,
      message: `Daily stats aggregated for ${date}`,
      stats
    });
  } catch (error) {
    console.error('Aggregate daily stats error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to aggregate daily stats'
    }, { status: 500 });
  }
};

/**
 * PUT /api/analytics/unified - Backfill historical unified stats
 * Body: { days?: number } - Number of days to backfill, defaults to 90
 */
export const PUT: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const days = body.days || 90;

    if (typeof days !== 'number' || days < 1 || days > 365) {
      return json({
        success: false,
        error: 'days must be a number between 1 and 365'
      }, { status: 400 });
    }

    const result = await backfillUnifiedDailyStats(days);

    return json({
      success: true,
      message: `Backfill completed: ${result.processed} days processed`,
      ...result
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to backfill data'
    }, { status: 500 });
  }
};
