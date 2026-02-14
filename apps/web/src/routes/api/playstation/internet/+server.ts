import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPsStationById, updatePsStationInternet } from '$lib/server/convex';
import { normalizeMac, setInternetRules } from '$lib/server/services/playstation';

/**
 * POST /api/playstation/internet
 * Toggle internet access for a PlayStation station.
 *
 * Body: { stationId: string, enable: boolean }
 *
 * Manages TWO firewall rules per station:
 *   - FORWARD chain (ps-internet:{name}): reject/accept actual internet traffic
 *   - INPUT chain (ps-dns:{name}): drop DNS when internet OFF for instant detection
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { stationId, enable } = await request.json();

		if (!stationId) {
			return json({ success: false, error: 'Station ID is required' }, { status: 400 });
		}

		const station = await getPsStationById(stationId);
		if (!station) {
			return json({ success: false, error: 'Station not found' }, { status: 404 });
		}

		const mac = normalizeMac(station.macAddress);
		await setInternetRules(mac, station.name, enable);
		console.log(`[PS Internet] Set internet ${enable ? 'ON' : 'OFF'} for ${station.name} (${mac})`);

		await updatePsStationInternet(stationId, enable);

		return json({
			success: true,
			enabled: enable,
			message: `Internet ${enable ? 'enabled' : 'disabled'} for ${station.name}`,
		});
	} catch (err) {
		const error = err instanceof Error ? err.message : 'Unknown error';
		console.error('[PS Internet] Toggle failed:', error);
		return json({ success: false, error }, { status: 500 });
	}
};
