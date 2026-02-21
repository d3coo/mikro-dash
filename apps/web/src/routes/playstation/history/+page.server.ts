import type { PageServerLoad } from './$types';
import { getPsSessionHistory, getPsStations, getPsAnalytics } from '$lib/server/convex';

export const load: PageServerLoad = async ({ url }) => {
  const stationId = url.searchParams.get('station') || undefined;
  const period = url.searchParams.get('period') || 'week';

  // Calculate date range based on period
  const now = Date.now();
  let startDate: number | undefined;
  let endDate: number | undefined = now;

  switch (period) {
    case 'today': {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      startDate = todayStart.getTime();
      break;
    }
    case 'week':
      startDate = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case 'month':
      startDate = now - 30 * 24 * 60 * 60 * 1000;
      break;
    case 'all':
      startDate = undefined;
      endDate = undefined;
      break;
  }

  const defaultAnalytics = { totalSessions: 0, totalMinutes: 0, totalRevenue: 0, totalOrders: 0, avgSessionMinutes: 0, avgRevenue: 0 };
  const analyticsPeriod = period === 'today' ? 'today' : period === 'week' ? 'week' : 'month';

  // Fetch all data in parallel (all SQLite — instant)
  const [sessions, stations, analytics] = await Promise.all([
    getPsSessionHistory({ stationId, startDate, endDate, limit: 100 }).catch(error => {
      console.error('Failed to get PS session history:', error);
      return [] as Awaited<ReturnType<typeof getPsSessionHistory>>;
    }),
    getPsStations().catch(error => {
      console.error('Failed to get PS stations:', error);
      return [] as Awaited<ReturnType<typeof getPsStations>>;
    }),
    getPsAnalytics(analyticsPeriod).catch(error => {
      console.error('Failed to get PS analytics:', error);
      return defaultAnalytics;
    })
  ]);

  return {
    sessions,
    stations,
    analytics,
    filters: {
      stationId,
      period,
    },
  };
};
