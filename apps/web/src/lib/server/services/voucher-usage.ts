import {
	recordVoucherUsage as convexRecordUsage,
	getVoucherUsageHistory as convexGetHistory,
	deleteVoucherUsageHistory as convexDeleteHistory,
	getLastDeviceForVoucher as convexGetLastDevice,
	getAllVoucherUsage as convexGetAll,
	getVoucherDeviceMap as convexGetDeviceMap,
} from '$lib/server/convex';
import { getMikroTikClient } from './mikrotik';

export interface VoucherUsageRecord {
  _id: string;
  voucherCode: string;
  macAddress: string;
  deviceName: string | null;
  ipAddress: string | null;
  firstConnectedAt: number;
  lastConnectedAt: number;
  totalBytes: number;
}

/**
 * Record or update voucher usage when a device connects
 */
export async function recordVoucherUsage(
  voucherCode: string,
  macAddress: string,
  deviceName?: string,
  ipAddress?: string,
  totalBytes?: number
): Promise<void> {
  await convexRecordUsage(voucherCode, macAddress, deviceName, ipAddress, totalBytes);
}

/**
 * Get usage history for a specific voucher
 */
export async function getVoucherUsageHistory(voucherCode: string): Promise<VoucherUsageRecord[]> {
  const records = await convexGetHistory(voucherCode);
  return records.map((r: any) => ({
    _id: r._id,
    voucherCode: r.voucherCode,
    macAddress: r.macAddress,
    deviceName: r.deviceName ?? null,
    ipAddress: r.ipAddress ?? null,
    firstConnectedAt: r.firstConnectedAt,
    lastConnectedAt: r.lastConnectedAt,
    totalBytes: r.totalBytes,
  }));
}

/**
 * Delete usage history for a voucher (when voucher is deleted)
 */
export async function deleteVoucherUsageHistory(voucherCode: string): Promise<void> {
  await convexDeleteHistory(voucherCode);
}

/**
 * Get the last device that used a voucher
 */
export async function getLastDeviceForVoucher(voucherCode: string): Promise<VoucherUsageRecord | undefined> {
  const record = await convexGetLastDevice(voucherCode);
  if (!record) return undefined;
  return {
    _id: (record as any)._id,
    voucherCode: (record as any).voucherCode,
    macAddress: (record as any).macAddress,
    deviceName: (record as any).deviceName ?? null,
    ipAddress: (record as any).ipAddress ?? null,
    firstConnectedAt: (record as any).firstConnectedAt,
    lastConnectedAt: (record as any).lastConnectedAt,
    totalBytes: (record as any).totalBytes,
  };
}

/**
 * Get all usage records (for admin view)
 */
export async function getAllVoucherUsage(): Promise<VoucherUsageRecord[]> {
  const records = await convexGetAll();
  return records.map((r: any) => ({
    _id: r._id,
    voucherCode: r.voucherCode,
    macAddress: r.macAddress,
    deviceName: r.deviceName ?? null,
    ipAddress: r.ipAddress ?? null,
    firstConnectedAt: r.firstConnectedAt,
    lastConnectedAt: r.lastConnectedAt,
    totalBytes: r.totalBytes,
  }));
}

/**
 * Build a map of voucher code -> device info from stored history
 */
export async function getVoucherDeviceMap(): Promise<Map<string, { macAddress: string; deviceName: string | null }>> {
  const entries = await convexGetDeviceMap();
  const map = new Map<string, { macAddress: string; deviceName: string | null }>();
  for (const entry of entries) {
    map.set(entry.voucherCode, {
      macAddress: entry.macAddress,
      deviceName: entry.deviceName ?? null,
    });
  }
  return map;
}

/**
 * Sync current active sessions to the database
 * Call this periodically or on page load to keep history updated
 */
export async function syncActiveSessionsToHistory(): Promise<{ synced: number }> {
  const client = await getMikroTikClient();

  const [activeSessions, dhcpLeases] = await Promise.all([
    client.getActiveSessions(),
    client.getDhcpLeases()
  ]);

  // Build MAC -> device name map from DHCP
  const macToDeviceName = new Map<string, string>();
  for (const lease of dhcpLeases) {
    const mac = lease['mac-address']?.toUpperCase();
    const hostName = lease['host-name'];
    if (mac && hostName) {
      macToDeviceName.set(mac, hostName.replace(/-/g, ' '));
    }
  }

  let synced = 0;

  for (const session of activeSessions) {
    const mac = session['mac-address']?.toUpperCase();
    if (!mac) continue;

    const deviceName = macToDeviceName.get(mac);
    const bytesIn = parseInt(session['bytes-in'] || '0', 10);
    const bytesOut = parseInt(session['bytes-out'] || '0', 10);

    await recordVoucherUsage(
      session.user,
      mac,
      deviceName,
      session.address,
      bytesIn + bytesOut
    );
    synced++;
  }

  return { synced };
}
