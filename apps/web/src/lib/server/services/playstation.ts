/**
 * PlayStation service - in-memory state + router rules sync
 * All session/station CRUD is handled by Convex (see $lib/server/convex.ts)
 * Uses wifi-qcom-ac driver (/interface/wifi endpoints) for wireless operations
 *
 * Online detection is handled ENTIRELY by the webhook endpoint:
 *   - MikroTik netwatch pings each PS IP and fires up/down webhooks
 *   - Webhook handles connect (immediate) and disconnect (30s debounce)
 *   - No background polling — the router does the polling via netwatch
 *
 * This file provides:
 *   - In-memory state tracking (online state, cooldowns)
 *   - Router rules sync (ACL, hotspot bypass, DHCP, netwatch entries)
 *   - Utility functions (MAC normalization, PS MAC detection)
 */

import { getMikroTikClient } from './mikrotik';
import { getPsStations } from '$lib/server/convex';

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
// Uses globalThis to survive Vite HMR module reloads.
// Without this, HMR creates new empty maps while old setTimeout callbacks
// reference the abandoned module-scope maps.

const ONLINE_STATES_KEY = '__ps_station_online_states__';
function getOnlineStatesMap(): Map<string, 'up' | 'down'> {
	if (!(globalThis as any)[ONLINE_STATES_KEY]) {
		(globalThis as any)[ONLINE_STATES_KEY] = new Map<string, 'up' | 'down'>();
	}
	return (globalThis as any)[ONLINE_STATES_KEY];
}

// Track manually ended sessions to prevent auto-restart
const manualEndCooldown = new Map<string, number>();
const MANUAL_END_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown after manual end

export function getStationOnlineState(mac: string): 'up' | 'down' | undefined {
	const normalizedMac = normalizeMac(mac);
	return getOnlineStatesMap().get(normalizedMac);
}

export function setStationOnlineState(mac: string, state: 'up' | 'down'): void {
	const normalizedMac = normalizeMac(mac);
	getOnlineStatesMap().set(normalizedMac, state);
}

export function isInManualEndCooldown(stationId: string): boolean {
	const endTime = manualEndCooldown.get(stationId);
	if (!endTime) return false;

	const elapsed = Date.now() - endTime;
	if (elapsed >= MANUAL_END_COOLDOWN_MS) {
		manualEndCooldown.delete(stationId);
		return false;
	}

	return true;
}

export function setManualEndCooldown(stationId: string): void {
	manualEndCooldown.set(stationId, Date.now());
	console.log(`[Cooldown] Station ${stationId} entering 5-minute auto-start cooldown`);
}

export function clearManualEndCooldown(stationId: string): void {
	if (manualEndCooldown.has(stationId)) {
		manualEndCooldown.delete(stationId);
	}
}

// ===== PS STATION IP LOOKUP =====

let cachedPsIpMap: Map<string, string> = new Map(); // MAC -> IP
let cachedPsIpTime = 0;
const PS_IP_CACHE_TTL_MS = 15000; // 15 seconds

/**
 * Get the current LAN IP for a PS station by MAC address.
 * Looks up the ARP table for the most accurate current IP.
 * Falls back to static DHCP lease if no ARP entry found.
 */
export async function getPsStationIp(macAddress: string): Promise<string | undefined> {
	const mac = normalizeMac(macAddress);
	const now = Date.now();

	if (cachedPsIpTime > 0 && (now - cachedPsIpTime) < PS_IP_CACHE_TTL_MS) {
		return cachedPsIpMap.get(mac);
	}

	try {
		const client = await getMikroTikClient();
		const [arpTable, leases] = await Promise.all([
			client.getArpTable(),
			client.getDhcpLeases(),
		]);

		cachedPsIpMap = new Map();

		// ARP entries on bridge or bridge-guest
		// Prefer bridge (LAN) for DDP reachability
		for (const entry of arpTable) {
			if ((entry.interface === 'bridge' || entry.interface === 'bridge-guest') && entry['mac-address'] && entry.address) {
				const entryMac = normalizeMac(entry['mac-address']);
				if (!cachedPsIpMap.has(entryMac) || entry.interface === 'bridge') {
					cachedPsIpMap.set(entryMac, entry.address);
				}
			}
		}

		// Fill in from static DHCP leases for stations not in ARP
		for (const lease of leases) {
			if (lease.comment?.startsWith('ps-') && lease['mac-address'] && lease.address) {
				const leaseMac = normalizeMac(lease['mac-address']);
				if (!cachedPsIpMap.has(leaseMac)) {
					cachedPsIpMap.set(leaseMac, lease.address);
				}
			}
		}

		cachedPsIpTime = now;
		return cachedPsIpMap.get(mac);
	} catch (e) {
		console.error('[PS] Failed to query ARP/DHCP:', e);
		return cachedPsIpMap.get(mac);
	}
}

// ===== INTERNET FIREWALL HELPERS =====

/**
 * No-op — internet firewall rules are no longer managed.
 * PS devices now use AboYassen SSID with hotspot bypass and unrestricted internet.
 */
export async function setInternetRules(
	_mac: string,
	_name: string,
	_enable: boolean,
): Promise<void> {
	// No-op
}

// ===== ROUTER RULES SYNC =====

function getWebhookUrl(): string {
	const port = process.env.PORT || '3000';
	return `http://192.168.1.100:${port}/api/playstation/webhook`;
}
const PS_LAN_IP_BASE = '192.168.1.';
const PS_GUEST_IP_BASE = '10.10.10.';
const PS_IP_OFFSET = 230;

function getPsStaticIps(stationIndex: number): { lanIp: string; guestIp: string } {
	const suffix = PS_IP_OFFSET + stationIndex;
	return {
		lanIp: `${PS_LAN_IP_BASE}${suffix}`,
		guestIp: `${PS_GUEST_IP_BASE}${suffix}`,
	};
}

/**
 * Sync MikroTik router rules for all PS stations.
 * Creates/maintains: WiFi ACL, hotspot bypass, static DHCP, netwatch.
 * Cleans up: legacy firewall rules, stale entries for removed stations.
 */
export async function syncPsRouterRules(): Promise<void> {
	try {
		const client = await getMikroTikClient();
		const stations = await getPsStations();

		const [acl, fwRules, ipBindings, dhcpLeases, netwatchEntries] = await Promise.all([
			client.getWirelessAccessList(),
			client.getFirewallFilterRules(),
			client.getIpBindings(),
			client.getDhcpLeases(),
			client.getNetwatchEntries(),
		]);

		// Index existing rules
		const psAclAccept = acl.filter((e) => e.comment?.startsWith('ps-station:'));
		const psAclBlock = acl.filter((e) => e.comment?.startsWith('ps-block:'));
		// MAC has ACL if it has interface-specific accept entries (not just generic accept)
		const existingAclMacs = new Set(
			psAclAccept
				.filter((e) => e.interface) // Only count interface-specific entries
				.map((e) => normalizeMac(e['mac-address']))
		);

		const psBindings = ipBindings.filter((b) => b.comment?.startsWith('ps-bypass:'));
		const existingBypassMacs = new Set(
			psBindings
				.filter((b) => b['mac-address'])
				.map((b) => normalizeMac(b['mac-address']!))
		);

		const psLeases = dhcpLeases.filter((l) => l.comment?.startsWith('ps-static:'));
		const existingLeaseComments = new Set(psLeases.map((l) => l.comment));

		const psNetwatch = netwatchEntries.filter((e) => e.comment?.startsWith('ps-watch:'));
		const existingNwComments = new Set(psNetwatch.map((e) => e.comment));

		// Cleanup legacy firewall rules
		const psFirewallRules = fwRules.filter((r) =>
			r.comment?.startsWith('ps-internet:') ||
			r.comment?.startsWith('ps-dns:') ||
			r.comment?.startsWith('ps-ddp:')
		);
		for (const rule of psFirewallRules) {
			await client.removeFirewallFilterRule(rule['.id']);
			console.log(`[PS Sync] Cleaned up firewall rule ${rule.comment}`);
		}

		// Ensure each station has ACL, bypass, DHCP, and netwatch
		for (let i = 0; i < stations.length; i++) {
			const station = stations[i];
			const mac = normalizeMac(station.macAddress);
			const stationNum = parseInt(station.name.replace(/\D/g, '')) || (i + 1);
			const { lanIp, guestIp } = getPsStaticIps(stationNum);

			if (!existingAclMacs.has(mac)) {
				// Remove any old generic (no interface) accept entries first
				for (const e of psAclAccept) {
					if (normalizeMac(e['mac-address']) === mac && !e.interface) {
						await client.removeFromWirelessAccessList(e['.id']);
						console.log(`[PS Sync] Removed generic ACL for ${station.name}`);
					}
				}
				// Accept on PlayStation VIFs only, reject elsewhere
				await client.addToWirelessAccessListWithInterface(mac, 'wifi1-ps', 'accept', `ps-station:${station.name}`);
				await client.addToWirelessAccessListWithInterface(mac, 'wifi2-ps', 'accept', `ps-station:${station.name}`);
				// Block on all other interfaces (catches AboYassen masters)
				const hasBlock = psAclBlock.some((e) => normalizeMac(e['mac-address']) === mac);
				if (!hasBlock) {
					await client.addToWirelessAccessListWithInterface(mac, undefined, 'reject', `ps-block:${station.name}`);
				}
				console.log(`[PS Sync] Added ACL for ${station.name} (PlayStation only)`);
			}

			if (!existingBypassMacs.has(mac)) {
				await client.addIpBinding(mac, 'bypassed', `ps-bypass:${station.name}`);
				console.log(`[PS Sync] Added hotspot bypass for ${station.name} (${mac})`);
			}

			const lanLeaseComment = `ps-static:${station.name}`;
			if (!existingLeaseComments.has(lanLeaseComment)) {
				const hasLanLease = psLeases.some((l) =>
					l.comment === lanLeaseComment && l.server === 'defconf'
				);
				const hasGuestLease = psLeases.some((l) =>
					l.comment === lanLeaseComment && l.server === 'guest-dhcp'
				);
				if (!hasLanLease) {
					await client.addDhcpLease(mac, lanIp, 'defconf', lanLeaseComment);
					console.log(`[PS Sync] Added LAN DHCP lease for ${station.name}: ${lanIp}`);
				}
				if (!hasGuestLease) {
					await client.addDhcpLease(mac, guestIp, 'guest-dhcp', lanLeaseComment);
					console.log(`[PS Sync] Added guest DHCP lease for ${station.name}: ${guestIp}`);
				}
			}

			// Single netwatch entry per station (LAN IP).
			// Both up-script and down-script MUST be set for webhook detection.
			const nwComment = `ps-watch:${station.name}`;
			const webhookUrl = getWebhookUrl();
			const upScript = `:do { /tool/fetch http-method=post keep-result=no url="${webhookUrl}\\?mac=${mac}&action=connect" } on-error={}`;
			const downScript = `:do { /tool/fetch http-method=post keep-result=no url="${webhookUrl}\\?mac=${mac}&action=disconnect" } on-error={}`;

			const existingEntry = psNetwatch.find((e) => e.comment === nwComment);
			if (!existingEntry) {
				await client.addNetwatchEntry({
					host: lanIp, upScript, downScript, comment: nwComment,
				});
				console.log(`[PS Sync] Added netwatch for ${station.name}: ${lanIp}`);
			} else {
				// Update existing entry if host, up-script, or down-script differ
				const needsUpdate =
					existingEntry.host !== lanIp ||
					existingEntry['up-script'] !== upScript ||
					!existingEntry['down-script'] || existingEntry['down-script'] !== downScript;
				if (needsUpdate) {
					await client.updateNetwatchEntry(existingEntry['.id'], {
						host: lanIp,
						upScript,
						downScript,
					});
					console.log(`[PS Sync] Updated netwatch for ${station.name}: host=${lanIp}, scripts updated`);
				}
			}

			// Clean up old dual LAN/guest entries if they exist
			const oldLanComment = `ps-watch:${station.name}-lan`;
			const oldGuestComment = `ps-watch:${station.name}-guest`;
			for (const entry of psNetwatch) {
				if (entry.comment === oldLanComment || entry.comment === oldGuestComment) {
					await client.removeNetwatchEntry(entry['.id']);
					console.log(`[PS Sync] Removed old dual netwatch ${entry.comment}`);
				}
			}
		}

		// Cleanup stale entries for removed stations
		const stationMacs = new Set(stations.map((s) => normalizeMac(s.macAddress)));
		const stationNames = new Set(stations.map((s) => s.name));

		for (const entry of [...psAclAccept, ...psAclBlock]) {
			if (!stationMacs.has(normalizeMac(entry['mac-address']))) {
				await client.removeFromWirelessAccessList(entry['.id']);
				console.log(`[PS Sync] Removed stale ACL entry ${entry.comment}`);
			}
		}

		for (const binding of psBindings) {
			if (binding['mac-address'] && !stationMacs.has(normalizeMac(binding['mac-address']))) {
				await client.removeIpBinding(binding['.id']);
				console.log(`[PS Sync] Removed stale bypass binding ${binding['mac-address']}`);
			}
		}

		for (const lease of psLeases) {
			if (lease.comment) {
				const name = lease.comment.replace('ps-static:', '');
				if (!stationNames.has(name)) {
					await client.removeDhcpLease(lease['.id']);
					console.log(`[PS Sync] Removed stale DHCP lease ${lease.comment}`);
				}
			}
		}

		for (const entry of psNetwatch) {
			if (entry.comment) {
				const name = entry.comment.replace('ps-watch:', '').replace(/-lan$/, '').replace(/-guest$/, '');
				if (!stationNames.has(name)) {
					await client.removeNetwatchEntry(entry['.id']);
					console.log(`[PS Sync] Removed stale netwatch ${entry.comment}`);
				}
			}
		}
	} catch (e) {
		console.error('[PS Sync] Router rules sync failed:', e);
	}
}

