import { getMikroTikClient } from './mikrotik';
import { getPackages, getPackageByCodePrefix } from '$lib/server/config';

export interface VoucherUser {
  sessionId: string;
  macAddress: string;
  ipAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
  voucherId: string;
  voucherCode: string;
  voucherPassword?: string;
  profile: string;
  bytesLimit: number;
  bytesUsed: number;
  bytesRemaining: number;
  packageName: string;
  priceLE: number;
  deviceName?: string;
  signalStrength?: string;
  interfaceName?: string;
}

export interface WiFiOnlyClient {
  id: string;
  macAddress: string;
  ipAddress?: string;
  deviceName?: string;
  signalStrength: string;
  bytesIn: number;
  bytesOut: number;
  uptime: string;
  interfaceName: string;
}

export interface UsersPageData {
  voucherUsers: VoucherUser[];
  wifiOnlyClients: WiFiOnlyClient[];
  totalVoucherUsers: number;
  totalWiFiOnlyClients: number;
}

/**
 * Get comprehensive users data for the Users page
 * Combines wireless registrations with active hotspot sessions to partition:
 * - Voucher users: devices connected AND authenticated with a voucher
 * - WiFi-only clients: devices connected but NOT authenticated
 */
export async function getUsersPageData(): Promise<UsersPageData> {
  const client = getMikroTikClient();

  // Fetch all data in parallel from MikroTik
  const [registrations, activeSessions, hotspotUsers, dhcpLeases, wirelessInterfaces] = await Promise.all([
    client.getWirelessRegistrations(),
    client.getActiveSessions(),
    client.getHotspotUsers(),
    client.getDhcpLeases(),
    client.getWirelessInterfaces()
  ]);

  // Get local package metadata
  const packages = getPackages();

  // Build lookup maps for efficient joining
  const sessionsByMac = new Map(
    activeSessions.map(s => [s['mac-address'].toUpperCase(), s])
  );
  const usersByName = new Map(
    hotspotUsers.map(u => [u.name, u])
  );
  const dhcpByMac = new Map(
    dhcpLeases.map(l => [l['mac-address'].toUpperCase(), l])
  );
  const interfaceByName = new Map(
    wirelessInterfaces.map(i => [i.name, i])
  );

  const voucherUsers: VoucherUser[] = [];
  const wifiOnlyClients: WiFiOnlyClient[] = [];

  // Process each wireless registration
  for (const reg of registrations) {
    const mac = reg['mac-address'].toUpperCase();
    const session = sessionsByMac.get(mac);
    const dhcp = dhcpByMac.get(mac);
    const iface = interfaceByName.get(reg.interface);

    // Parse bytes from "in,out" format
    const [bytesIn, bytesOut] = reg.bytes.split(',').map(b => parseInt(b, 10) || 0);

    if (session) {
      // This device has an active hotspot session - it's a voucher user
      const user = usersByName.get(session.user);
      const pkg = getPackageByCodePrefix(session.user);

      // Get byte limit from hotspot user record
      const bytesLimit = Number(user?.['limit-bytes-total']) || 0;

      // Use session bytes for current usage (more accurate for active sessions)
      const sessionBytesIn = parseInt(session['bytes-in'] || '0', 10);
      const sessionBytesOut = parseInt(session['bytes-out'] || '0', 10);
      const bytesUsed = sessionBytesIn + sessionBytesOut;

      voucherUsers.push({
        sessionId: session['.id'],
        macAddress: reg['mac-address'],
        ipAddress: session.address,
        uptime: session.uptime,
        bytesIn: sessionBytesIn,
        bytesOut: sessionBytesOut,
        voucherId: user?.['.id'] || '',
        voucherCode: session.user,
        voucherPassword: user?.password,
        profile: user?.profile || 'default',
        bytesLimit,
        bytesUsed,
        bytesRemaining: Math.max(0, bytesLimit - bytesUsed),
        packageName: pkg?.nameAr || user?.profile || 'غير محدد',
        priceLE: pkg?.priceLE || 0,
        deviceName: dhcp?.['host-name']?.replace(/-/g, ' '),
        signalStrength: reg['signal-strength'],
        interfaceName: iface?.ssid || reg.interface
      });
    } else {
      // No active session - this is a WiFi-only client
      wifiOnlyClients.push({
        id: reg['.id'],
        macAddress: reg['mac-address'],
        ipAddress: reg['last-ip'] || dhcp?.address,
        deviceName: dhcp?.['host-name']?.replace(/-/g, ' '),
        signalStrength: reg['signal-strength'],
        bytesIn,
        bytesOut,
        uptime: reg.uptime,
        interfaceName: iface?.ssid || reg.interface
      });
    }
  }

  // Sort voucher users by uptime (longest first)
  voucherUsers.sort((a, b) => {
    const parseUptime = (uptime: string): number => {
      let seconds = 0;
      const days = uptime.match(/(\d+)d/);
      const hours = uptime.match(/(\d+)h/);
      const minutes = uptime.match(/(\d+)m/);
      const secs = uptime.match(/(\d+)s/);
      if (days) seconds += parseInt(days[1], 10) * 86400;
      if (hours) seconds += parseInt(hours[1], 10) * 3600;
      if (minutes) seconds += parseInt(minutes[1], 10) * 60;
      if (secs) seconds += parseInt(secs[1], 10);
      return seconds;
    };
    return parseUptime(b.uptime) - parseUptime(a.uptime);
  });

  // Sort WiFi clients by bytes used (highest first)
  wifiOnlyClients.sort((a, b) => (b.bytesIn + b.bytesOut) - (a.bytesIn + a.bytesOut));

  return {
    voucherUsers,
    wifiOnlyClients,
    totalVoucherUsers: voucherUsers.length,
    totalWiFiOnlyClients: wifiOnlyClients.length
  };
}

/**
 * Disconnect a wireless client from the registration table
 */
export async function disconnectWirelessClient(registrationId: string): Promise<void> {
  const client = getMikroTikClient();
  await client.disconnectWirelessClient(registrationId);
}

/**
 * Block a MAC address via wireless access list
 */
export async function blockMacAddress(macAddress: string, deviceName?: string): Promise<void> {
  const client = getMikroTikClient();
  const comment = deviceName ? `${deviceName} - Blocked from dashboard` : 'Blocked from dashboard';
  await client.addToWirelessAccessList(macAddress, comment);
}
