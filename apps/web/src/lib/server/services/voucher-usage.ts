import { db } from '$lib/server/db';
import { voucherUsage } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getMikroTikClient } from './mikrotik';

export interface VoucherUsageRecord {
  id: number;
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
  const now = Date.now();
  const mac = macAddress.toUpperCase();

  // Check if record exists
  const existingResults = await db
    .select()
    .from(voucherUsage)
    .where(and(
      eq(voucherUsage.voucherCode, voucherCode),
      eq(voucherUsage.macAddress, mac)
    ));
  const existing = existingResults[0];

  if (existing) {
    // Update existing record
    await db.update(voucherUsage)
      .set({
        lastConnectedAt: now,
        deviceName: deviceName || existing.deviceName,
        ipAddress: ipAddress || existing.ipAddress,
        totalBytes: totalBytes ?? existing.totalBytes
      })
      .where(eq(voucherUsage.id, existing.id));
  } else {
    // Create new record
    await db.insert(voucherUsage)
      .values({
        voucherCode,
        macAddress: mac,
        deviceName: deviceName || null,
        ipAddress: ipAddress || null,
        firstConnectedAt: now,
        lastConnectedAt: now,
        totalBytes: totalBytes || 0
      });
  }
}

/**
 * Get usage history for a specific voucher
 */
export async function getVoucherUsageHistory(voucherCode: string): Promise<VoucherUsageRecord[]> {
  return await db
    .select()
    .from(voucherUsage)
    .where(eq(voucherUsage.voucherCode, voucherCode)) as unknown as VoucherUsageRecord[];
}

/**
 * Delete usage history for a voucher (when voucher is deleted)
 */
export async function deleteVoucherUsageHistory(voucherCode: string): Promise<void> {
  await db.delete(voucherUsage)
    .where(eq(voucherUsage.voucherCode, voucherCode));
}

/**
 * Get the last device that used a voucher
 */
export async function getLastDeviceForVoucher(voucherCode: string): Promise<VoucherUsageRecord | undefined> {
  const records = await db
    .select()
    .from(voucherUsage)
    .where(eq(voucherUsage.voucherCode, voucherCode))
    .orderBy(voucherUsage.lastConnectedAt) as unknown as VoucherUsageRecord[];

  return records[records.length - 1];
}

/**
 * Get all usage records (for admin view)
 */
export async function getAllVoucherUsage(): Promise<VoucherUsageRecord[]> {
  return await db
    .select()
    .from(voucherUsage)
    .orderBy(voucherUsage.lastConnectedAt) as unknown as VoucherUsageRecord[];
}

/**
 * Build a map of voucher code -> device info from stored history
 */
export async function getVoucherDeviceMap(): Promise<Map<string, { macAddress: string; deviceName: string | null }>> {
  const records = await getAllVoucherUsage();
  const map = new Map<string, { macAddress: string; deviceName: string | null }>();

  for (const record of records) {
    // Only keep the most recent device per voucher
    const existing = map.get(record.voucherCode);
    if (!existing || record.lastConnectedAt > (existing as any).lastConnectedAt) {
      map.set(record.voucherCode, {
        macAddress: record.macAddress,
        deviceName: record.deviceName
      });
    }
  }

  return map;
}

/**
 * Sync current active sessions to the database
 * Call this periodically or on page load to keep history updated
 */
export async function syncActiveSessionsToHistory(): Promise<{ synced: number }> {
  const client = getMikroTikClient();

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
