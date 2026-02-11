import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPsStationById, updatePsStationInternet } from '$lib/server/convex';
import { getMikroTikClient } from '$lib/server/services/mikrotik';

const FILTERED_DNS = '62.210.38.117';

/**
 * POST /api/playstation/internet
 * Toggle internet access for a PlayStation station
 *
 * Body: { stationId: string, enable: boolean }
 *
 * When enabling:
 *   1. Add IP binding (bypassed) for the PS MAC address
 *   2. Look up PS IP from DHCP leases
 *   3. Add NAT dst-nat rule to redirect DNS (UDP 53) to filtered DNS
 *
 * When disabling:
 *   1. Remove the IP binding (matched by comment)
 *   2. Remove the NAT rule (matched by comment)
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
		const mac = station.macAddress.toUpperCase();

		if (enable) {
			// Step 1: Add IP binding (bypassed) for the PS MAC
			const bindings = await client.getIpBindings();
			const existingBinding = bindings.find(
				(b) => b['mac-address']?.toUpperCase() === mac && b.type === 'bypassed'
			);

			if (!existingBinding) {
				await client.addIpBinding(mac, 'bypassed', comment);
				console.log(`[PS Internet] Added IP binding for ${station.name} (${mac})`);
			}

			// Step 2: Look up PS IP from DHCP leases
			const leases = await client.getDhcpLeases();
			const lease = leases.find(
				(l) => l['mac-address']?.toUpperCase() === mac
			);

			if (lease?.address) {
				// Step 3: Add NAT rule to redirect DNS to filtered server
				const natRules = await client.getNatRules();
				const existingNat = natRules.find((r) => r.comment === comment);

				if (!existingNat) {
					// UDP DNS redirect
					await client.addNatRule({
						chain: 'dstnat',
						action: 'dst-nat',
						srcAddress: lease.address,
						protocol: 'udp',
						dstPort: '53',
						toAddresses: FILTERED_DNS,
						comment,
					});
					console.log(
						`[PS Internet] Added DNS NAT rule for ${station.name} (${lease.address} -> ${FILTERED_DNS})`
					);
				}
			} else {
				console.warn(
					`[PS Internet] No DHCP lease found for ${station.name} (${mac}) - DNS filter not applied`
				);
			}

			// Update Convex state
			await updatePsStationInternet(stationId, true);

			return json({
				success: true,
				enabled: true,
				ip: lease?.address || null,
				message: `Internet enabled for ${station.name}`,
			});
		} else {
			// Disable: Remove IP binding
			const bindings = await client.getIpBindings();
			const binding = bindings.find(
				(b) =>
					b['mac-address']?.toUpperCase() === mac ||
					b.comment === comment
			);
			if (binding) {
				await client.removeIpBinding(binding['.id']);
				console.log(`[PS Internet] Removed IP binding for ${station.name}`);
			}

			// Remove NAT rule
			const natRules = await client.getNatRules();
			const natRule = natRules.find((r) => r.comment === comment);
			if (natRule) {
				await client.removeNatRule(natRule['.id']);
				console.log(`[PS Internet] Removed DNS NAT rule for ${station.name}`);
			}

			// Update Convex state
			await updatePsStationInternet(stationId, false);

			return json({
				success: true,
				enabled: false,
				message: `Internet disabled for ${station.name}`,
			});
		}
	} catch (err) {
		const error = err instanceof Error ? err.message : 'Unknown error';
		console.error('[PS Internet] Toggle failed:', error);
		return json({ success: false, error }, { status: 500 });
	}
};
