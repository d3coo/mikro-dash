/**
 * PlayStation service - MikroTik detection + in-memory state only
 * All session/station CRUD is handled by Convex (see $lib/server/convex.ts)
 * Uses wifi-qcom-ac driver (/interface/wifi endpoints) for wireless operations
 */

import { getMikroTikClient } from './mikrotik';
import {
	getPsStations,
	getActivePsSessions,
	startPsSession,
	pausePsSession,
	resumePsSession,
	bulkUpdateStationOnlineStatus,
	updatePsStationInternet,
} from '$lib/server/convex';

// PlayStation MAC address prefixes (common OUI prefixes for Sony PlayStation)
export const PS_MAC_PREFIXES = [
	'00:1A:7D', '00:1F:A7', '00:24:8D', '00:26:43', '28:0D:FC',
	'2C:CC:44', '38:0C:26', '40:B8:9A', '44:1E:A1', '4C:0B:BE',
	'54:A5:11', '5C:BA:37', '60:5B:B4', '70:9E:29', '78:C8:81',
	'7C:5A:1C', '8C:84:01', '90:34:FC', '98:22:EF', 'A8:E3:EE',
	'AC:E4:B5', 'B0:05:94', 'BC:60:A7', 'C8:63:F1', 'D4:4B:5E',
	'D8:30:62', 'FC:0F:E6', '00:D9:D1', '08:5A:92',
];

/**
 * Normalize MAC address to uppercase colon-separated format
 */
export function normalizeMac(mac: string): string {
	return mac.toUpperCase().replace(/-/g, ':');
}

/**
 * Check if a MAC address belongs to a PlayStation device
 */
export function isPlayStationMac(mac: string): boolean {
	const normalizedMac = normalizeMac(mac);
	const prefix = normalizedMac.substring(0, 8);
	return PS_MAC_PREFIXES.includes(prefix);
}

// ===== IN-MEMORY STATE =====

// Grace period tracking (in-memory)
const gracePeriodTracker = new Map<string, number>(); // stationId -> disconnectTime

// Track the last known online state of each station (by MAC address)
const stationOnlineStates = new Map<string, 'up' | 'down'>();

// Track manually ended sessions to prevent auto-restart
const manualEndCooldown = new Map<string, number>();
const MANUAL_END_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown after manual end

// Cache for online status
let cachedOnlineMap: Map<string, boolean> = new Map();
let cachedOnlineMapTime = 0;
const ONLINE_CACHE_TTL_MS = 10000; // 10 seconds

export function getStationOnlineState(mac: string): 'up' | 'down' | undefined {
	const normalizedMac = normalizeMac(mac);
	return stationOnlineStates.get(normalizedMac);
}

export function setStationOnlineState(mac: string, state: 'up' | 'down'): void {
	const normalizedMac = normalizeMac(mac);
	stationOnlineStates.set(normalizedMac, state);
	console.log(`[State] ${normalizedMac} -> ${state}`);
}

export function isInManualEndCooldown(stationId: string): boolean {
	const endTime = manualEndCooldown.get(stationId);
	if (!endTime) return false;

	const elapsed = Date.now() - endTime;
	if (elapsed >= MANUAL_END_COOLDOWN_MS) {
		manualEndCooldown.delete(stationId);
		return false;
	}

	console.log(`[Cooldown] Station ${stationId} in manual-end cooldown (${Math.round((MANUAL_END_COOLDOWN_MS - elapsed) / 1000)}s remaining)`);
	return true;
}

export function setManualEndCooldown(stationId: string): void {
	manualEndCooldown.set(stationId, Date.now());
	console.log(`[Cooldown] Station ${stationId} entering 5-minute auto-start cooldown`);
}

export function clearManualEndCooldown(stationId: string): void {
	if (manualEndCooldown.has(stationId)) {
		manualEndCooldown.delete(stationId);
		console.log(`[Cooldown] Station ${stationId} cooldown cleared (device disconnected)`);
	}
}

// ===== MikroTik DETECTION =====

/**
 * Detect which PS stations are online by checking router's wifi registration table
 * (wifi-qcom-ac driver: /interface/wifi/registration-table)
 * Returns Map<stationConvexId, boolean>
 */
export async function detectOnlineStations(forceRefresh = false): Promise<Map<string, boolean>> {
	const now = Date.now();

	if (!forceRefresh && cachedOnlineMapTime > 0 && (now - cachedOnlineMapTime) < ONLINE_CACHE_TTL_MS) {
		return cachedOnlineMap;
	}

	try {
		const client = await getMikroTikClient();
		const registrations = await client.getWirelessRegistrations();

		const stations = await getPsStations();

		const onlineMap = new Map<string, boolean>();
		const connectedMacs = new Set(
			registrations.map((r: { 'mac-address': string }) => normalizeMac(r['mac-address']))
		);

		for (const station of stations) {
			const mac = normalizeMac(station.macAddress);
			onlineMap.set(station._id, connectedMacs.has(mac));
		}

		cachedOnlineMap = onlineMap;
		cachedOnlineMapTime = now;

		return onlineMap;
	} catch (e) {
		if (cachedOnlineMap.size > 0) {
			console.warn('[PS] Router query failed, using cached online status');
			return cachedOnlineMap;
		}
		throw e;
	}
}

// ===== ROUTER RULES SYNC =====

/**
 * Sync MikroTik router rules for all PS stations:
 * 1. WiFi access list entries (MAC allow on PS AP, wifi-qcom-ac driver)
 * 2. Hotspot IP binding bypass (so hotspot doesn't intercept PS traffic)
 * 3. IP firewall forward DROP/ACCEPT rule (internet control)
 *
 * Self-healing: creates missing rules for existing stations.
 */
export async function syncPsRouterRules(): Promise<void> {
	try {
		const client = await getMikroTikClient();
		const stations = await getPsStations();

		const [acl, fwRules, ipBindings] = await Promise.all([
			client.getWirelessAccessList(),
			client.getFirewallFilterRules(),
			client.getIpBindings(),
		]);

		// Index existing rules
		const psAclEntries = acl.filter((e) => e.comment?.startsWith('ps-station:'));
		const existingAclMacs = new Set(psAclEntries.map((e) => normalizeMac(e['mac-address'])));

		const psBindings = ipBindings.filter((b) => b.comment?.startsWith('ps-bypass:'));
		const existingBypassMacs = new Set(
			psBindings
				.filter((b) => b['mac-address'])
				.map((b) => normalizeMac(b['mac-address']!))
		);

		const psFwRules = fwRules.filter((r) => r.comment?.startsWith('ps-internet:'));
		const existingFwRuleMap = new Map(psFwRules.map((r) => [r.comment, r]));

		// Ensure each station has all rule types
		for (const station of stations) {
			const mac = normalizeMac(station.macAddress);
			const fwComment = `ps-internet:${station.name}`;
			const desiredAction = station.hasInternet ? 'accept' : 'drop';

			// 1. Wireless ACL
			if (!existingAclMacs.has(mac)) {
				await client.allowPsStationMac(station.macAddress, station.name);
				console.log(`[PS Sync] Added ACL for ${station.name} (${mac})`);
			}

			// 2. Hotspot IP binding bypass
			if (!existingBypassMacs.has(mac)) {
				await client.addIpBinding(mac, 'bypassed', `ps-bypass:${station.name}`);
				console.log(`[PS Sync] Added hotspot bypass for ${station.name} (${mac})`);
			}

			// 3. Firewall internet rule (DROP when blocked, ACCEPT when enabled)
			const existingFw = existingFwRuleMap.get(fwComment);
			if (!existingFw) {
				await client.addFirewallFilterRule({
					chain: 'forward',
					action: desiredAction,
					srcMacAddress: mac,
					comment: fwComment,
				});
				console.log(`[PS Sync] Added firewall ${desiredAction.toUpperCase()} for ${station.name} (${mac})`);
			} else if (existingFw.action !== desiredAction) {
				await client.removeFirewallFilterRule(existingFw['.id']);
				await client.addFirewallFilterRule({
					chain: 'forward',
					action: desiredAction,
					srcMacAddress: mac,
					comment: fwComment,
				});
				console.log(`[PS Sync] Swapped firewall to ${desiredAction.toUpperCase()} for ${station.name} (${mac})`);
			}
		}

		// Remove stale ACL entries
		const stationMacs = new Set(stations.map((s) => normalizeMac(s.macAddress)));
		for (const entry of psAclEntries) {
			if (!stationMacs.has(normalizeMac(entry['mac-address']))) {
				await client.removeFromWirelessAccessList(entry['.id']);
				console.log(`[PS Sync] Removed stale ACL entry ${entry['mac-address']}`);
			}
		}

		// Remove stale firewall rules
		const stationFwComments = new Set(stations.map((s) => `ps-internet:${s.name}`));
		for (const rule of psFwRules) {
			if (rule.comment && !stationFwComments.has(rule.comment)) {
				await client.removeFirewallFilterRule(rule['.id']);
				console.log(`[PS Sync] Removed stale firewall rule ${rule.comment}`);
			}
		}

		// Remove stale IP binding bypass entries
		for (const binding of psBindings) {
			if (binding['mac-address'] && !stationMacs.has(normalizeMac(binding['mac-address']))) {
				await client.removeIpBinding(binding['.id']);
				console.log(`[PS Sync] Removed stale bypass binding ${binding['mac-address']}`);
			}
		}
	} catch (e) {
		console.error('[PS Sync] Router rules sync failed:', e);
	}
}

// ===== SYNC =====

/**
 * Sync station status with router and auto-start/pause sessions
 * Called by background sync service every 30 seconds
 */
export async function syncStationStatus(): Promise<{
	started: string[];
	ended: string[];
}> {
	const onlineMap = await detectOnlineStations(true);
	const stations = await getPsStations();
	const activeSessions = await getActivePsSessions();

	// Build a map of stationId (Convex _id) -> active session
	const activeSessionMap = new Map<string, typeof activeSessions[0]>();
	for (const session of activeSessions) {
		if (!session.endedAt) {
			activeSessionMap.set(session.stationId as string, session);
		}
	}

	const started: string[] = [];
	const ended: string[] = [];

	const client = await getMikroTikClient();

	for (const station of stations) {
		if (station.status === 'maintenance') continue;

		const isOnline = onlineMap.get(station._id) ?? false;
		const activeSession = activeSessionMap.get(station._id);

		const mac = normalizeMac(station.macAddress);
		const previousState = stationOnlineStates.get(mac);

		const displayId = station.stationId || station.name;

		if (isOnline) {
			gracePeriodTracker.delete(station._id);

			const isFirstConnect = previousState !== 'up';
			stationOnlineStates.set(mac, 'up');

			if (activeSession && activeSession.pausedAt) {
				try {
					await resumePsSession(activeSession._id);
					console.log(`[Sync] Resumed paused session for ${displayId}`);
				} catch (e) {
					console.error(`Failed to resume session for ${displayId}:`, e);
				}
			}

			if (!activeSession && isFirstConnect) {
				if (isInManualEndCooldown(station._id)) {
					console.log(`[Sync] Station ${displayId} in cooldown - not auto-starting`);
				} else {
					try {
						await startPsSession(station._id, 'auto');
						started.push(displayId);
						console.log(`[Sync] Auto-started session for ${displayId} - first connect`);
					} catch (e) {
						console.error(`Failed to auto-start session for ${displayId}:`, e);
					}
				}
			}
		} else {
			stationOnlineStates.set(mac, 'down');
			clearManualEndCooldown(station._id);

			if (activeSession && !activeSession.pausedAt) {
				try {
					await pausePsSession(activeSession._id);
					console.log(`[Sync] Paused session for ${displayId} - PS went offline`);
				} catch (e) {
					console.error(`Failed to pause session for ${displayId}:`, e);
				}
			}

			// Reset internet when PS goes offline: swap to DROP
			if (station.hasInternet) {
				try {
					const fwComment = `ps-internet:${station.name}`;
					const rules = await client.getFirewallFilterRules();
					const existing = rules.find((r) => r.comment === fwComment);
					if (existing) {
						await client.removeFirewallFilterRule(existing['.id']);
					}
					await client.addFirewallFilterRule({
						chain: 'forward',
						action: 'drop',
						srcMacAddress: mac,
						comment: fwComment,
					});
					await updatePsStationInternet(station._id, false);
					console.log(`[Sync] Reset internet for ${displayId} - PS went offline`);
				} catch (e) {
					console.error(`Failed to reset internet for ${displayId}:`, e);
				}
			}
		}
	}

	const onlineUpdates = stations.map(station => ({
		id: station._id,
		isOnline: onlineMap.get(station._id) ?? false,
	}));
	try {
		await bulkUpdateStationOnlineStatus(onlineUpdates);
	} catch (e) {
		console.error('[Sync] Failed to update online status in Convex:', e);
	}

	return { started, ended };
}
