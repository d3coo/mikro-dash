import { getMikroTikClient } from './mikrotik';

export interface WirelessClient {
  id: string;
  interface: string;
  interfaceName: string;
  macAddress: string;
  ipAddress?: string;
  deviceName?: string;
  signalStrength: string;
  txRate: string;
  rxRate: string;
  bytesIn: number;
  bytesOut: number;
  uptime: string;
  // Hotspot info if logged in
  hotspotUser?: string;
  hotspotProfile?: string;
}

export interface AccessPoint {
  id: string;
  name: string;
  ssid: string;
  band?: string;
  frequency?: string;
  securityProfile: string;
  isVirtual: boolean;
  masterInterface?: string;
  macAddress: string;
  disabled: boolean;
  running: boolean;
  clientCount: number;
}

// Grouped network (combines 2.4GHz and 5GHz with same SSID)
export interface NetworkGroup {
  ssid: string;
  securityProfile: string;
  isVirtual: boolean;
  totalClients: number;
  interfaces: AccessPoint[];
}

export interface SecurityProfileInfo {
  id: string;
  name: string;
  mode: string;
  hasPassword: boolean;
}

/**
 * Get all wireless access points with client counts
 */
export async function getAccessPoints(): Promise<AccessPoint[]> {
  const client = await getMikroTikClient();

  const [interfaces, registrations] = await Promise.all([
    client.getWirelessInterfaces(),
    client.getWirelessRegistrations()
  ]);

  // Count clients per interface
  const clientCounts = new Map<string, number>();
  for (const reg of registrations) {
    const count = clientCounts.get(reg.interface) || 0;
    clientCounts.set(reg.interface, count + 1);
  }

  return interfaces.map(iface => ({
    id: iface['.id'],
    name: iface.name,
    ssid: iface.ssid,
    band: iface.band,
    frequency: iface.frequency,
    securityProfile: iface['security-profile'],
    isVirtual: iface['interface-type'] === 'virtual',
    masterInterface: iface['master-interface'],
    macAddress: iface['mac-address'],
    disabled: iface.disabled === 'true',
    running: iface.running === 'true',
    clientCount: clientCounts.get(iface.name) || 0
  }));
}

/**
 * Get access points grouped by SSID
 */
export async function getNetworkGroups(): Promise<NetworkGroup[]> {
  const accessPoints = await getAccessPoints();

  // Group by SSID
  const groups = new Map<string, AccessPoint[]>();
  for (const ap of accessPoints) {
    const existing = groups.get(ap.ssid) || [];
    existing.push(ap);
    groups.set(ap.ssid, existing);
  }

  // Convert to array and calculate totals
  const result: NetworkGroup[] = [];
  for (const [ssid, interfaces] of groups) {
    // Sort interfaces: 2.4GHz first, then 5GHz
    interfaces.sort((a, b) => {
      const aIs24 = a.band?.includes('2ghz') || a.name.includes('wlan1');
      const bIs24 = b.band?.includes('2ghz') || b.name.includes('wlan1');
      if (aIs24 && !bIs24) return -1;
      if (!aIs24 && bIs24) return 1;
      return a.name.localeCompare(b.name);
    });

    result.push({
      ssid,
      securityProfile: interfaces[0].securityProfile,
      isVirtual: interfaces.every(i => i.isVirtual),
      totalClients: interfaces.reduce((sum, i) => sum + i.clientCount, 0),
      interfaces
    });
  }

  // Sort groups: running first, then by client count
  result.sort((a, b) => {
    const aRunning = a.interfaces.some(i => i.running);
    const bRunning = b.interfaces.some(i => i.running);
    if (aRunning && !bRunning) return -1;
    if (!aRunning && bRunning) return 1;
    return b.totalClients - a.totalClients;
  });

  return result;
}

/**
 * Get all connected wireless clients with device info
 */
export async function getWirelessClients(): Promise<WirelessClient[]> {
  const client = await getMikroTikClient();

  const [registrations, dhcpLeases, activeSessions, interfaces] = await Promise.all([
    client.getWirelessRegistrations(),
    client.getDhcpLeases(),
    client.getActiveSessions(),
    client.getWirelessInterfaces()
  ]);

  // Create lookup maps
  const dhcpMap = new Map(dhcpLeases.map(l => [l['mac-address'].toUpperCase(), l]));
  const sessionMap = new Map(activeSessions.map(s => [s['mac-address'].toUpperCase(), s]));
  const interfaceMap = new Map(interfaces.map(i => [i.name, i]));

  return registrations.map(reg => {
    const macUpper = reg['mac-address'].toUpperCase();
    const dhcp = dhcpMap.get(macUpper);
    const session = sessionMap.get(macUpper);
    const iface = interfaceMap.get(reg.interface);

    // Parse bytes (format: "in,out")
    const [bytesIn, bytesOut] = reg.bytes.split(',').map(b => parseInt(b, 10) || 0);

    return {
      id: reg['.id'],
      interface: reg.interface,
      interfaceName: iface?.ssid || reg.interface,
      macAddress: reg['mac-address'],
      ipAddress: reg['last-ip'] || dhcp?.address,
      deviceName: dhcp?.['host-name']?.replace(/-/g, ' '),
      signalStrength: reg['signal-strength'],
      txRate: reg['tx-rate'],
      rxRate: reg['rx-rate'],
      bytesIn,
      bytesOut,
      uptime: reg.uptime,
      hotspotUser: session?.user,
      hotspotProfile: undefined // Could fetch from hotspot user if needed
    };
  });
}

/**
 * Get security profiles
 */
export async function getSecurityProfiles(): Promise<SecurityProfileInfo[]> {
  const client = await getMikroTikClient();
  const profiles = await client.getSecurityProfiles();

  return profiles.map(p => ({
    id: p['.id'],
    name: p.name,
    mode: p.mode,
    hasPassword: !!(p['wpa2-pre-shared-key'] && p['wpa2-pre-shared-key'].length > 0)
  }));
}

/**
 * Toggle wireless interface enabled/disabled
 */
export async function toggleAccessPoint(id: string, disabled: boolean): Promise<void> {
  const client = await getMikroTikClient();
  await client.toggleWirelessInterface(id, disabled);
}

/**
 * Update wireless interface SSID
 */
export async function updateAccessPointSSID(id: string, ssid: string): Promise<void> {
  const client = await getMikroTikClient();
  await client.updateWirelessSSID(id, ssid);
}

/**
 * Update SSID for all interfaces in a group
 */
export async function updateNetworkGroupSSID(ids: string[], ssid: string): Promise<void> {
  const client = await getMikroTikClient();
  for (const id of ids) {
    await client.updateWirelessSSID(id, ssid);
  }
}

/**
 * Update security profile password
 */
export async function updateWiFiPassword(id: string, password: string): Promise<void> {
  const client = await getMikroTikClient();
  await client.updateSecurityPassword(id, password);
}

/**
 * Create a new Virtual AP
 */
export async function createVirtualAP(
  masterInterface: string,
  ssid: string,
  securityProfile: string,
  name?: string
): Promise<void> {
  const client = await getMikroTikClient();
  await client.createVirtualAP(masterInterface, ssid, securityProfile, name);
}

/**
 * Delete a Virtual AP
 */
export async function deleteVirtualAP(id: string): Promise<void> {
  const client = await getMikroTikClient();
  await client.deleteWirelessInterface(id);
}
