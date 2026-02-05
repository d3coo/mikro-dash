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

  const sessions = await getPsSessionHistory({
    stationId,
    startDate,
    endDate,
    limit: 100,
  });

  const stations = await getPsStations();
  const analyticsPeriod = period === 'today' ? 'today' : period === 'week' ? 'week' : 'month';
  const analytics = await getPsAnalytics(analyticsPeriod);

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
