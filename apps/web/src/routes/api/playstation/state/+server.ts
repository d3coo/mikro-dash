import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStationStatuses, getTodayPsAnalytics, getPsMenuItems } from '$lib/server/convex';

/**
 * GET /api/playstation/state
 * Returns station statuses, analytics, and menu items for client-side polling.
 * Replaces Convex WebSocket subscriptions.
 */
export const GET: RequestHandler = async ({ url }) => {
	const include = url.searchParams.get('include') || 'all';

	const result: Record<string, any> = {};

	if (include === 'all' || include === 'statuses') {
		result.stationStatuses = await getStationStatuses();
	}

	if (include === 'all' || include === 'analytics') {
		result.analytics = await getTodayPsAnalytics();
	}

	if (include === 'all' || include === 'menu') {
		result.menuItems = await getPsMenuItems();
	}

	return json(result);
};
