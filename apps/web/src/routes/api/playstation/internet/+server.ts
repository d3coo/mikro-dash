import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPsStationById, updatePsStationInternet } from '$lib/server/convex';
import { getMikroTikClient } from '$lib/server/services/mikrotik';
import { normalizeMac } from '$lib/server/services/playstation';

/**
 * POST /api/playstation/internet
 * Toggle internet access for a PlayStation station.
 *
 * Body: { stationId: string, enable: boolean }
 *
 * Uses IP firewall filter rules with src-mac-address matching in the forward chain.
 * There is always exactly one rule per station (comment: ps-internet:{name}):
 *   - Internet OFF: rule action = drop
 *   - Internet ON:  rule action = accept
 *
 * Toggle swaps the rule by removing the old one and adding the new action.
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

		const client = await getMikroTikClient();
		const comment = `ps-internet:${station.name}`;
		const mac = normalizeMac(station.macAddress);

		// Remove existing rule (whether ACCEPT or DROP)
		const rules = await client.getFirewallFilterRules();
		const existing = rules.find((r) => r.comment === comment);
		if (existing) {
			await client.removeFirewallFilterRule(existing['.id']);
		}

		// Add new rule with the desired action
		const action = enable ? 'accept' : 'drop';
		await client.addFirewallFilterRule({
			chain: 'forward',
			action,
			srcMacAddress: mac,
			comment,
		});
		console.log(`[PS Internet] Set firewall ${action.toUpperCase()} for ${station.name} (${mac})`);

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
