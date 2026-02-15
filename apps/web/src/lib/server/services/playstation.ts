/**
 * PlayStation service - MikroTik detection + in-memory state only
 * All session/station CRUD is handled by Convex (see $lib/server/convex.ts)
 * Uses wifi-qcom-ac driver (/interface/wifi endpoints) for wireless operations
 *
 * Detection: DDP protocol probe (primary) + WiFi traffic delta (fallback)
 * DDP (Device Discovery Protocol) is Sony's UDP-based discovery on port 987.
 * Returns status 200 (awake) or 620 (standby). No response = PS is off.
 */

import { createSocket } from 'node:dgram';
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

// Track the last known online state of each station (by MAC address)
const stationOnlineStates = new Map<string, 'up' | 'down'>();

// Track manually ended sessions to prevent auto-restart
const manualEndCooldown = new Map<string, number>();
const MANUAL_END_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown after manual end

// Cache for online status
let cachedOnlineMap: Map<string, boolean> = new Map();
let cachedOnlineMapTime = 0;
const ONLINE_CACHE_TTL_MS = 10000; // 10 seconds
const ONLINE_CACHE_MAX_AGE_MS = 60000; // Never use cache older than 60 seconds (even on error)

// Track the last isOnline values we sent to Convex (prevents unnecessary mutations)
const lastSentOnlineStatus = new Map<string, boolean>();

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

// ===== PS STATION IP LOOKUP =====

// Cache ARP table for PS station IP resolution
let cachedPsIpMap: Map<string, string> = new Map(); // MAC -> IP
let cachedPsIpTime = 0;
const PS_IP_CACHE_TTL_MS = 15000; // 15 seconds

/**
 * Get the current LAN IP for a PS station by MAC address.
 * Looks up the ARP table on the LAN bridge for the most accurate current IP.
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

		// First pass: ARP entries on LAN bridge (most accurate, current IP)
		for (const entry of arpTable) {
			if (entry.interface === 'bridge' && entry['mac-address'] && entry.address) {
				cachedPsIpMap.set(normalizeMac(entry['mac-address']), entry.address);
			}
		}

		// Second pass: fill in from static DHCP leases for stations not in ARP
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

// ===== DDP PROTOCOL (Sony Device Discovery Protocol) =====

const DDP_PORT = 987;
const DDP_VERSION = '00030010';
const DDP_SEARCH_MSG = `SRCH * HTTP/1.1\ndevice-discovery-protocol-version:${DDP_VERSION}\n\n`;
const DDP_TIMEOUT_MS = 2000; // 2s per probe (all probes run in parallel)

type DdpResult = 'awake' | 'standby' | 'off';

/**
 * Probe a PlayStation's DDP status via UDP port 987.
 * Returns 'awake' (HTTP 200), 'standby' (HTTP 620), or 'off' (no response/timeout).
 */
async function probeDdpStatus(ip: string): Promise<DdpResult> {
	return new Promise((resolve) => {
		const socket = createSocket('udp4');
		let resolved = false;

		const finish = (result: DdpResult) => {
			if (resolved) return;
			resolved = true;
			clearTimeout(timer);
			try { socket.close(); } catch { /* already closed */ }
			resolve(result);
		};

		const timer = setTimeout(() => finish('off'), DDP_TIMEOUT_MS);

		socket.on('message', (msg) => {
			const response = msg.toString('utf-8');
			if (response.startsWith('HTTP/1.1 200')) {
				finish('awake');
			} else if (response.startsWith('HTTP/1.1 620')) {
				finish('standby');
			} else {
				finish('off');
			}
		});

		socket.on('error', () => finish('off'));

		const buffer = Buffer.from(DDP_SEARCH_MSG, 'utf-8');
		socket.send(buffer, 0, buffer.length, DDP_PORT, ip, (err) => {
			if (err) finish('off');
		});
	});
}

// ===== TRAFFIC DELTA DETECTION (Fallback when DDP unavailable) =====

// Track WiFi registration byte counters per MAC
const lastKnownBytes = new Map<string, { totalBytes: number; timestamp: number }>();
const TRAFFIC_STALE_THRESHOLD_MS = 60_000; // 60s of zero traffic = considered off
const TRAFFIC_MIN_BYTES = 1000; // Min bytes delta to consider "active" (filter broadcast noise)

/**
 * Parse WiFi registration bytes field ("in,out" format) into total bytes.
 */
function parseRegBytes(bytesStr: string): number {
	const parts = bytesStr.split(',').map(s => parseInt(s, 10));
	return (parts[0] || 0) + (parts[1] || 0);
}

/**
 * Check if a station has active traffic based on WiFi registration byte counters.
 * Returns true if significant traffic detected recently, false if stale (possible shutdown).
 */
function hasActiveTraffic(mac: string, currentBytes: number): boolean {
	const previous = lastKnownBytes.get(mac);
	const now = Date.now();

	if (!previous) {
		// First observation — record and assume active
		lastKnownBytes.set(mac, { totalBytes: currentBytes, timestamp: now });
		return true;
	}

	const delta = currentBytes - previous.totalBytes;

	if (delta >= TRAFFIC_MIN_BYTES) {
		// Significant traffic detected — update and mark active
		lastKnownBytes.set(mac, { totalBytes: currentBytes, timestamp: now });
		return true;
	}

	// No significant traffic — check how long since last activity
	const staleTime = now - previous.timestamp;
	if (staleTime >= TRAFFIC_STALE_THRESHOLD_MS) {
		return false; // No traffic for too long = likely off
	}

	return true; // Still within grace period
}

// ===== INTERNET FIREWALL HELPERS =====

/**
 * Set internet firewall rules for a PS station.
 * When internet OFF, manages TWO rules:
 *   1. FORWARD reject: non-LAN traffic (dst != 192.168.1.0/24), allows DDP probes
 *   2. INPUT reject: DNS (UDP 53) to router for instant "no internet" on PS
 * When internet ON, manages ONE rule:
 *   1. FORWARD accept: all traffic
 *
 * DNS must use reject (not drop!) — drop causes silent timeout making PS
 * perceive "slow internet" instead of instant "no internet".
 *
 * @param mac - Normalized MAC address (AA:BB:CC:DD:EE:FF)
 * @param name - Station name (e.g., "ps-01")
 * @param enable - true = internet ON, false = internet OFF
 */
export async function setInternetRules(
	mac: string,
	name: string,
	enable: boolean,
): Promise<void> {
	const client = await getMikroTikClient();
	const fwComment = `ps-internet:${name}`;
	const dnsComment = `ps-dns:${name}`;

	const rules = await client.getFirewallFilterRules();

	// Remove existing forward + DNS rules (also clean up legacy ps-ddp rules)
	for (const r of rules) {
		if (r.comment === fwComment || r.comment === `ps-ddp:${name}` || r.comment === dnsComment) {
			await client.removeFirewallFilterRule(r['.id']);
		}
	}

	// Find the fasttrack rule in FORWARD chain — PS rules must come before it
	// so connections aren't accelerated past our reject rules.
	const fasttrackRule = rules.find(
		(r) => r.chain === 'forward' && r.action === 'fasttrack-connection'
	);
	const placeBeforeForward = fasttrackRule?.['.id'] ||
		rules.find((r) => r.chain === 'forward' && r.action === 'accept' && r.comment?.includes('established'))?.['.id'];

	// Find the "accept established,related" rule in INPUT chain for DNS rules.
	const inputEstablishedRule = rules.find(
		(r) => r.chain === 'input' && r.action === 'accept' && r.comment?.includes('established')
	);
	const placeBeforeInput = inputEstablishedRule?.['.id'];

	if (enable) {
		// Internet ON: ACCEPT in forward, no DNS block
		await client.addFirewallFilterRule({
			chain: 'forward',
			action: 'accept',
			srcMacAddress: mac,
			comment: fwComment,
			...(placeBeforeForward && { place: 'before' as const, placeId: placeBeforeForward }),
		});
	} else {
		// Internet OFF: REJECT non-LAN traffic (allows DDP probe responses + local services)
		await client.addFirewallFilterRule({
			chain: 'forward',
			action: 'reject',
			srcMacAddress: mac,
			dstAddress: '!192.168.1.0/24',
			rejectWith: 'icmp-network-unreachable',
			comment: fwComment,
			...(placeBeforeForward && { place: 'before' as const, placeId: placeBeforeForward }),
		});
		// REJECT DNS to router for instant "no internet" detection on PS
		await client.addFirewallFilterRule({
			chain: 'input',
			action: 'reject',
			rejectWith: 'icmp-network-unreachable',
			srcMacAddress: mac,
			protocol: 'udp',
			dstPort: '53',
			comment: dnsComment,
			...(placeBeforeInput && { place: 'before' as const, placeId: placeBeforeInput }),
		});
	}
}

// ===== MikroTik DETECTION =====

/**
 * Detect which PS stations are online using:
 *   1. WiFi registration table (no reg = definitely offline)
 *   2. DDP protocol probe (primary: awake/standby/off)
 *   3. Traffic delta fallback (when DDP unavailable: zero traffic = off)
 *
 * The wifi-qcom-ac driver keeps stale WiFi registrations after PS shutdown.
 * DDP and traffic delta distinguish truly-on PS from stale registrations.
 *
 * Returns Map<stationConvexId, boolean>
 */
export async function detectOnlineStations(forceRefresh = false): Promise<Map<string, boolean>> {
	const now = Date.now();

	if (!forceRefresh && cachedOnlineMapTime > 0 && (now - cachedOnlineMapTime) < ONLINE_CACHE_TTL_MS) {
		return cachedOnlineMap;
	}

	try {
		const client = await getMikroTikClient();
		const [registrations, stations, arpTable] = await Promise.all([
			client.getWirelessRegistrations(),
			getPsStations(),
			client.getArpTable(),
		]);

		// Build IP lookup from ARP table (MAC → IP)
		const macToIp = new Map<string, string>();
		for (const entry of arpTable) {
			if (entry['mac-address'] && entry.address) {
				macToIp.set(normalizeMac(entry['mac-address']), entry.address);
			}
		}

		// Update the PS IP cache for other consumers (getPsStationIp)
		cachedPsIpMap = new Map(macToIp);
		cachedPsIpTime = now;

		// Build WiFi registration lookup (MAC → registration)
		const regByMac = new Map<string, typeof registrations[0]>();
		for (const reg of registrations) {
			regByMac.set(normalizeMac(reg['mac-address']), reg);
		}

		const onlineMap = new Map<string, boolean>();
		const needsProbe: Array<{
			station: typeof stations[0];
			mac: string;
			reg: typeof registrations[0];
			ip: string | undefined;
		}> = [];

		// Phase 1: Stations not in WiFi reg are definitely offline
		for (const station of stations) {
			const mac = normalizeMac(station.macAddress);
			const reg = regByMac.get(mac);

			if (!reg) {
				onlineMap.set(station._id, false);
				lastKnownBytes.delete(mac);
			} else {
				needsProbe.push({ station, mac, reg, ip: macToIp.get(mac) });
			}
		}

		// Phase 2: DDP probe (primary) + traffic delta (fallback) for in-reg stations
		if (needsProbe.length > 0) {
			const results = await Promise.all(
				needsProbe.map(async ({ station, mac, reg, ip }) => {
					let ddpResult: DdpResult = 'off';
					if (ip) {
						ddpResult = await probeDdpStatus(ip);
					}
					return { station, mac, reg, ip, ddpResult };
				})
			);

			for (const { station, mac, reg, ip, ddpResult } of results) {
				if (ddpResult === 'awake') {
					// DDP confirms PS is actively running
					onlineMap.set(station._id, true);
					const totalBytes = parseRegBytes(reg.bytes);
					lastKnownBytes.set(mac, { totalBytes, timestamp: now });
				} else if (ddpResult === 'standby') {
					// DDP says standby
					onlineMap.set(station._id, false);
					console.log(`[PS Detect] ${station.name}: DDP standby → offline`);
				} else if (ip) {
					// DDP probed the IP but got no response → PS is off
					onlineMap.set(station._id, false);
					lastKnownBytes.delete(mac);
					console.log(`[PS Detect] ${station.name}: DDP no response at ${ip} → offline`);
				} else {
					// No IP available for DDP — fall back to traffic delta
					const totalBytes = parseRegBytes(reg.bytes);
					const isActive = hasActiveTraffic(mac, totalBytes);
					onlineMap.set(station._id, isActive);

					if (!isActive) {
						console.log(`[PS Detect] ${station.name}: no IP + zero traffic → offline (stale WiFi reg)`);
					}
				}
			}
		}

		cachedOnlineMap = onlineMap;
		cachedOnlineMapTime = now;

		return onlineMap;
	} catch (e) {
		// Return cached data only if it's not too old
		if (cachedOnlineMap.size > 0 && (now - cachedOnlineMapTime) < ONLINE_CACHE_MAX_AGE_MS) {
			console.warn('[PS] Router query failed, using cached online status');
			return cachedOnlineMap;
		}
		// Cache too old or empty - mark all as offline rather than showing stale "online"
		if (cachedOnlineMap.size > 0) {
			console.warn('[PS] Router query failed and cache too old, marking all offline');
			const stations = await getPsStations();
			const offlineMap = new Map<string, boolean>();
			for (const station of stations) {
				offlineMap.set(station._id, false);
			}
			cachedOnlineMap = offlineMap;
			cachedOnlineMapTime = now;
			return offlineMap;
		}
		throw e;
	}
}

// ===== ROUTER RULES SYNC =====

// Webhook URL for netwatch scripts (router → app)
const WEBHOOK_URL = 'http://192.168.1.100:3000/api/playstation/webhook';

// PS station static IP base addresses (station index 1-based added to base)
// e.g. ps-01 → .231, ps-02 → .232, etc.
const PS_LAN_IP_BASE = '192.168.1.';
const PS_GUEST_IP_BASE = '10.10.10.';
const PS_IP_OFFSET = 230; // ps-01 = base + 231, ps-02 = base + 232, ...

/**
 * Get the static IPs for a PS station based on its index (1-based).
 */
function getPsStaticIps(stationIndex: number): { lanIp: string; guestIp: string } {
	const suffix = PS_IP_OFFSET + stationIndex;
	return {
		lanIp: `${PS_LAN_IP_BASE}${suffix}`,
		guestIp: `${PS_GUEST_IP_BASE}${suffix}`,
	};
}

/**
 * Sync MikroTik router rules for all PS stations:
 * 1. WiFi access list entries (MAC allow on PS AP, wifi-qcom-ac driver)
 * 2. Hotspot IP binding bypass (so hotspot doesn't intercept PS traffic)
 * 3. IP firewall forward DROP/ACCEPT rule (internet control)
 * 4. Static DHCP leases on both bridges (fixed IPs for netwatch)
 * 5. Netwatch ICMP entries for online/offline detection via ping
 *
 * Self-healing: creates missing rules for existing stations.
 * Auto-provisions: new stations automatically get all rules + netwatch.
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

		// Index existing DNS blocking rules (INPUT chain, comment: ps-dns:{name})
		const psDnsRules = fwRules.filter((r) => r.comment?.startsWith('ps-dns:'));
		const existingDnsRuleMap = new Map(psDnsRules.map((r) => [r.comment, r]));

		// Find fasttrack rule in FORWARD chain — PS rules must come before it
		const fasttrackRule = fwRules.find(
			(r) => r.chain === 'forward' && r.action === 'fasttrack-connection'
		);
		const placeBeforeForward = fasttrackRule?.['.id'] ||
			fwRules.find((r) => r.chain === 'forward' && r.action === 'accept' && r.comment?.includes('established'))?.['.id'];

		// Find "accept established" in INPUT chain for DNS rules
		const inputEstablishedRule = fwRules.find(
			(r) => r.chain === 'input' && r.action === 'accept' && r.comment?.includes('established')
		);
		const placeBeforeInput = inputEstablishedRule?.['.id'];

		// Index existing DHCP leases by comment
		const psLeases = dhcpLeases.filter((l) => l.comment?.startsWith('ps-static:'));
		const existingLeaseComments = new Set(psLeases.map((l) => l.comment));

		// Index existing netwatch entries by comment
		const psNetwatch = netwatchEntries.filter((e) => e.comment?.startsWith('ps-watch:'));
		const existingNwComments = new Set(psNetwatch.map((e) => e.comment));

		// Ensure each station has all rule types
		for (let i = 0; i < stations.length; i++) {
			const station = stations[i];
			const mac = normalizeMac(station.macAddress);
			const fwComment = `ps-internet:${station.name}`;
			const desiredAction = station.hasInternet ? 'accept' : 'reject';
			// Station index from name (ps-01 → 1, ps-09 → 9) or fallback to array position
			const stationNum = parseInt(station.name.replace(/\D/g, '')) || (i + 1);
			const { lanIp, guestIp } = getPsStaticIps(stationNum);

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

			// 3. Firewall internet rule (REJECT when blocked, ACCEPT when enabled)
			//    Placed before "accept established" rule so it blocks even existing connections
			const existingFw = existingFwRuleMap.get(fwComment);
			const needsReplace = existingFw && (
				existingFw.action !== desiredAction ||
				(existingFw.action === 'reject' && existingFw['dst-address'] !== '!192.168.1.0/24')
			);

			if (!existingFw || needsReplace) {
				if (existingFw) {
					await client.removeFirewallFilterRule(existingFw['.id']);
				}
				await client.addFirewallFilterRule({
					chain: 'forward',
					action: desiredAction,
					srcMacAddress: mac,
					...(desiredAction === 'reject' && {
						rejectWith: 'icmp-network-unreachable',
						dstAddress: '!192.168.1.0/24',
					}),
					comment: fwComment,
					...(placeBeforeForward && { place: 'before' as const, placeId: placeBeforeForward }),
				});
				const reason = !existingFw ? 'Added' : 'Updated';
				console.log(`[PS Sync] ${reason} firewall ${desiredAction.toUpperCase()} for ${station.name} (${mac})`);
			}

			// Clean up legacy ps-ddp rules if present
			const ddpComment = `ps-ddp:${station.name}`;
			const legacyDdp = fwRules.find((r) => r.comment === ddpComment);
			if (legacyDdp) {
				await client.removeFirewallFilterRule(legacyDdp['.id']);
				console.log(`[PS Sync] Removed legacy DDP rule for ${station.name}`);
			}

			// 3b. DNS blocking rule (INPUT chain, reject UDP 53 when internet OFF)
			const dnsComment = `ps-dns:${station.name}`;
			const existingDns = existingDnsRuleMap.get(dnsComment);
			if (!station.hasInternet && !existingDns) {
				// Internet OFF but no DNS block → add it (reject for instant error, not drop/timeout)
				await client.addFirewallFilterRule({
					chain: 'input',
					action: 'reject',
					rejectWith: 'icmp-network-unreachable',
					srcMacAddress: mac,
					protocol: 'udp',
					dstPort: '53',
					comment: dnsComment,
					...(placeBeforeInput && { place: 'before' as const, placeId: placeBeforeInput }),
				});
				console.log(`[PS Sync] Added DNS block for ${station.name} (${mac})`);
			} else if (station.hasInternet && existingDns) {
				// Internet ON but DNS block exists → remove it
				await client.removeFirewallFilterRule(existingDns['.id']);
				console.log(`[PS Sync] Removed DNS block for ${station.name} (internet enabled)`);
			}

			// 4. Static DHCP leases (LAN + guest bridge)
			const lanLeaseComment = `ps-static:${station.name}`;
			if (!existingLeaseComments.has(lanLeaseComment)) {
				// Check by iterating - we need per-server check
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

			// 5. Netwatch ICMP entries (LAN + guest IP)
			const nwLanComment = `ps-watch:${station.name}-lan`;
			const nwGuestComment = `ps-watch:${station.name}-guest`;
			const upScript = `:do { /tool/fetch http-method=post keep-result=no url="${WEBHOOK_URL}\\?mac=${mac}&action=connect" } on-error={}`;
			const downScript = `:do { /tool/fetch http-method=post keep-result=no url="${WEBHOOK_URL}\\?mac=${mac}&action=disconnect" } on-error={}`;

			if (!existingNwComments.has(nwLanComment)) {
				await client.addNetwatchEntry({
					host: lanIp, upScript, downScript, comment: nwLanComment,
				});
				console.log(`[PS Sync] Added netwatch LAN for ${station.name}: ${lanIp}`);
			}
			if (!existingNwComments.has(nwGuestComment)) {
				await client.addNetwatchEntry({
					host: guestIp, upScript, downScript, comment: nwGuestComment,
				});
				console.log(`[PS Sync] Added netwatch guest for ${station.name}: ${guestIp}`);
			}
		}

		// ===== Cleanup stale entries for removed stations =====

		const stationMacs = new Set(stations.map((s) => normalizeMac(s.macAddress)));
		const stationNames = new Set(stations.map((s) => s.name));

		// Remove stale ACL entries
		for (const entry of psAclEntries) {
			if (!stationMacs.has(normalizeMac(entry['mac-address']))) {
				await client.removeFromWirelessAccessList(entry['.id']);
				console.log(`[PS Sync] Removed stale ACL entry ${entry['mac-address']}`);
			}
		}

		// Remove stale firewall rules
		for (const rule of psFwRules) {
			if (rule.comment) {
				const name = rule.comment.replace('ps-internet:', '');
				if (!stationNames.has(name)) {
					await client.removeFirewallFilterRule(rule['.id']);
					console.log(`[PS Sync] Removed stale firewall rule ${rule.comment}`);
				}
			}
		}

		// Remove stale DNS blocking rules
		for (const rule of psDnsRules) {
			if (rule.comment) {
				const name = rule.comment.replace('ps-dns:', '');
				if (!stationNames.has(name)) {
					await client.removeFirewallFilterRule(rule['.id']);
					console.log(`[PS Sync] Removed stale DNS block rule ${rule.comment}`);
				}
			}
		}

		// Remove stale IP binding bypass entries
		for (const binding of psBindings) {
			if (binding['mac-address'] && !stationMacs.has(normalizeMac(binding['mac-address']))) {
				await client.removeIpBinding(binding['.id']);
				console.log(`[PS Sync] Removed stale bypass binding ${binding['mac-address']}`);
			}
		}

		// Remove stale DHCP leases
		for (const lease of psLeases) {
			if (lease.comment) {
				const name = lease.comment.replace('ps-static:', '');
				if (!stationNames.has(name)) {
					await client.removeDhcpLease(lease['.id']);
					console.log(`[PS Sync] Removed stale DHCP lease ${lease.comment}`);
				}
			}
		}

		// Remove stale netwatch entries
		for (const entry of psNetwatch) {
			if (entry.comment) {
				// Extract station name from "ps-watch:ps-01-lan" → "ps-01"
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

	// Only update Convex isOnline when values actually changed (prevents subscription churn)
	const changedOnlineUpdates: Array<{ id: string; isOnline: boolean }> = [];
	for (const station of stations) {
		const isOnline = onlineMap.get(station._id) ?? false;
		if (lastSentOnlineStatus.get(station._id) !== isOnline) {
			changedOnlineUpdates.push({ id: station._id, isOnline });
		}
	}
	if (changedOnlineUpdates.length > 0) {
		try {
			await bulkUpdateStationOnlineStatus(changedOnlineUpdates);
			// Update local cache only after successful Convex write
			for (const u of changedOnlineUpdates) {
				lastSentOnlineStatus.set(u.id, u.isOnline);
			}
			console.log(`[Sync] Updated isOnline for ${changedOnlineUpdates.length} station(s):`,
				changedOnlineUpdates.map(u => `${u.id.slice(-4)}=${u.isOnline}`).join(', '));
		} catch (e) {
			console.error('[Sync] Failed to update online status in Convex:', e);
		}
	}

	const started: string[] = [];
	const ended: string[] = [];

	for (const station of stations) {
		if (station.status === 'maintenance') continue;

		const isOnline = onlineMap.get(station._id) ?? false;
		const activeSession = activeSessionMap.get(station._id);

		const mac = normalizeMac(station.macAddress);
		const previousState = stationOnlineStates.get(mac);

		const displayId = station.stationId || station.name;

		if (isOnline) {
			const isFirstConnect = previousState !== 'up';
			stationOnlineStates.set(mac, 'up');

			// Always block internet when PS comes back online
			if (isFirstConnect && station.hasInternet) {
				try {
					await setInternetRules(mac, station.name, false);
					await updatePsStationInternet(station._id, false);
					console.log(`[Sync] Reset internet for ${displayId} - PS came back online`);
				} catch (e) {
					console.error(`Failed to reset internet for ${displayId}:`, e);
				}
			}

			// Auto-start session as backup (webhook is primary via Netwatch)
			if (!activeSession && isFirstConnect) {
				if (isInManualEndCooldown(station._id)) {
					console.log(`[Sync] Station ${displayId} in cooldown - not auto-starting`);
				} else {
					try {
						// +1 minute delay (PS boot time before actual play)
						const delayedStart = Date.now() + 60_000;
						await startPsSession(station._id, 'auto', undefined, undefined, delayedStart);
						started.push(displayId);
						console.log(`[Sync] Auto-started session for ${displayId} - start time +1min`);
					} catch (e) {
						console.error(`Failed to auto-start session for ${displayId}:`, e);
					}
				}
			}

			// Resume paused session when PS comes back online
			if (activeSession && activeSession.pausedAt) {
				try {
					await resumePsSession(activeSession._id);
					console.log(`[Sync] Resumed session for ${displayId} - PS back online`);
				} catch (e) {
					console.error(`Failed to resume session for ${displayId}:`, e);
				}
			}
		} else {
			stationOnlineStates.set(mac, 'down');
			clearManualEndCooldown(station._id);

			// Reset internet when PS goes offline: swap to REJECT + DNS block
			if (station.hasInternet) {
				try {
					await setInternetRules(mac, station.name, false);
					await updatePsStationInternet(station._id, false);
					console.log(`[Sync] Reset internet for ${displayId} - PS went offline`);
				} catch (e) {
					console.error(`Failed to reset internet for ${displayId}:`, e);
				}
			}

			// Pause active session when PS goes offline (DDP detection is reliable)
			if (activeSession && !activeSession.pausedAt) {
				try {
					await pausePsSession(activeSession._id);
					console.log(`[Sync] Paused session for ${displayId} - PS offline`);
				} catch (e) {
					console.error(`Failed to pause session for ${displayId}:`, e);
				}
			}
		}
	}

	return { started, ended };
}
