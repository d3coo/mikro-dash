import { getDb } from '$lib/server/db';
import { voucherUsage } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
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

function toStr(id: number): string {
  return String(id);
}

/**
 * Record or update voucher usage when a device connects.
 */
export async function recordVoucherUsage(
  voucherCode: string,
  macAddress: string,
  deviceName?: string,
  ipAddress?: string,
  totalBytes?: number
): Promise<void> {
  try {
    const db = getDb();
    const now = Date.now();

    const existing = db.select().from(voucherUsage)
      .where(and(eq(voucherUsage.voucherCode, voucherCode), eq(voucherUsage.macAddress, macAddress)))
      .get();

    if (existing) {
      const updates: Record<string, any> = { lastConnectedAt: now };
      if (deviceName !== undefined) updates.deviceName = deviceName;
      if (ipAddress !== undefined) updates.ipAddress = ipAddress;
      if (totalBytes !== undefined) updates.totalBytes = totalBytes;
      db.update(voucherUsage).set(updates).where(eq(voucherUsage.id, existing.id)).run();
    } else {
      db.insert(voucherUsage).values({
        voucherCode,
        macAddress,
        deviceName: deviceName ?? null,
        ipAddress: ipAddress ?? null,
        firstConnectedAt: now,
        lastConnectedAt: now,
        totalBytes: totalBytes ?? 0,
      }).run();
    }
  } catch (err) {
    console.error('[VoucherUsage] Failed to record usage:', err);
  }
}

/**
 * Get usage history for a specific voucher
 */
export async function getVoucherUsageHistory(voucherCode: string): Promise<VoucherUsageRecord[]> {
  const db = getDb();
  return db.select().from(voucherUsage)
    .where(eq(voucherUsage.voucherCode, voucherCode))
    .all()
    .map(r => ({
      _id: toStr(r.id),
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
 * Delete usage history for a voucher
 */
export async function deleteVoucherUsageHistory(voucherCode: string): Promise<void> {
  try {
    const db = getDb();
    db.delete(voucherUsage).where(eq(voucherUsage.voucherCode, voucherCode)).run();
  } catch (err) {
    console.error('[VoucherUsage] Failed to delete history:', err);
  }
}

/**
 * Get the last device that used a voucher
 */
export async function getLastDeviceForVoucher(voucherCode: string): Promise<VoucherUsageRecord | undefined> {
  const db = getDb();
  const row = db.select().from(voucherUsage)
    .where(eq(voucherUsage.voucherCode, voucherCode))
    .orderBy(desc(voucherUsage.lastConnectedAt))
    .limit(1)
    .get();
  if (!row) return undefined;
  return {
    _id: toStr(row.id),
    voucherCode: row.voucherCode,
    macAddress: row.macAddress,
    deviceName: row.deviceName ?? null,
    ipAddress: row.ipAddress ?? null,
    firstConnectedAt: row.firstConnectedAt,
    lastConnectedAt: row.lastConnectedAt,
    totalBytes: row.totalBytes,
  };
}

/**
 * Get all usage records
 */
export async function getAllVoucherUsage(): Promise<VoucherUsageRecord[]> {
  const db = getDb();
  return db.select().from(voucherUsage).all().map(r => ({
    _id: toStr(r.id),
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
 * Build a map of voucher code -> device info
 */
export async function getVoucherDeviceMap(): Promise<Map<string, { macAddress: string; deviceName: string | null }>> {
  const db = getDb();
  const rows = db.select().from(voucherUsage)
    .orderBy(desc(voucherUsage.lastConnectedAt))
    .all();

  const map = new Map<string, { macAddress: string; deviceName: string | null }>();
  for (const row of rows) {
    if (!map.has(row.voucherCode)) {
      map.set(row.voucherCode, {
        macAddress: row.macAddress,
        deviceName: row.deviceName ?? null,
      });
    }
  }
  return map;
}

/**
 * Sync current active sessions to the database
 */
export async function syncActiveSessionsToHistory(): Promise<{ synced: number }> {
  const client = await getMikroTikClient();

  const [activeSessions, dhcpLeases] = await Promise.all([
    client.getActiveSessions(),
    client.getDhcpLeases()
  ]);

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
