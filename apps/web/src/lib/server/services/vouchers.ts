import { getMikroTikClient } from './mikrotik';
import { getPackages, getPackageById, type PackageConfig } from '$lib/server/config';
import type { HotspotUser } from '$lib/server/mikrotik/types';
import { getVoucherDeviceMap, recordVoucherUsage, deleteVoucherUsageHistory } from './voucher-usage';
import {
  syncVouchersToCache,
  syncSessionsToCache,
  getCachedVouchers,
  getLastSyncTime,
  isCacheStale,
  removeCachedVoucher,
  removeCachedVouchers,
  addVouchersToCache,
  type CachedVoucher
} from './voucher-cache';

// Characters for generating codes (uppercase + numbers, excluding confusing ones like 0/O, 1/I)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface Voucher {
  id: string;           // MikroTik internal ID (.id)
  name: string;         // Voucher code/username
  password: string;
  profile: string;
  server?: string;
  bytesIn: number;
  bytesOut: number;
  bytesTotal: number;
  bytesLimit: number;
  uptime: string;
  status: 'available' | 'used' | 'exhausted';
  comment: string;
  // Package metadata from config
  packageId: string;
  packageName: string;
  priceLE: number;
  // Device info (from cookies + DHCP leases)
  macAddress?: string;
  deviceName?: string;
  isOnline: boolean;
}

/**
 * Generate random alphanumeric string
 */
function generateRandomCode(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

/**
 * Generate unique 6-character voucher code (uppercase letters + numbers)
 * Fully random - no prefix
 * The code is used as both username AND password for easy single-field login
 */
async function generateVoucherCode(client: ReturnType<typeof getMikroTikClient>): Promise<string> {
  const users = await client.getHotspotUsers();
  const existingNames = new Set(users.map(u => u.name.toUpperCase())); // Case-insensitive check

  let attempts = 0;
  while (attempts < 500) {
    const code = generateRandomCode(6);
    if (!existingNames.has(code.toUpperCase())) {
      return code;
    }
    attempts++;
  }

  throw new Error('Could not generate unique voucher code');
}

/**
 * Parse package ID from comment field
 * Comment format: "pkg:PACKAGE_ID|Name - Price LE" or legacy "Name - Price LE"
 */
function parsePackageIdFromComment(comment: string): string | null {
  const match = comment.match(/^pkg:([^|]+)\|/);
  return match ? match[1] : null;
}

/**
 * Device info from cookies and DHCP
 */
interface DeviceInfo {
  macAddress?: string;
  deviceName?: string;
  isOnline: boolean;
}

/**
 * Transform MikroTik hotspot user to Voucher format
 */
function transformToVoucher(
  user: HotspotUser,
  packages: PackageConfig[],
  activeUsernames: Set<string>,
  deviceInfoMap: Map<string, DeviceInfo>
): Voucher {
  const bytesIn = parseInt(user['bytes-in'] || '0', 10);
  const bytesOut = parseInt(user['bytes-out'] || '0', 10);
  const bytesTotal = bytesIn + bytesOut;
  const bytesLimit = parseInt(user['limit-bytes-total'] || '0', 10);
  const uptime = user.uptime || '0s';

  // Determine status - check active sessions, bytes used, and data limit
  let status: 'available' | 'used' | 'exhausted' = 'available';
  if (bytesLimit > 0 && bytesTotal >= bytesLimit) {
    status = 'exhausted';
  } else if (activeUsernames.has(user.name) || uptime !== '0s' || bytesTotal > 0) {
    status = 'used';
  }

  // Find matching package - first try by ID in comment, then by profile
  const comment = user.comment || '';
  const packageIdFromComment = parsePackageIdFromComment(comment);
  let matchingPkg = packageIdFromComment
    ? packages.find(p => p.id === packageIdFromComment)
    : null;

  // Fallback: match by profile name
  if (!matchingPkg) {
    matchingPkg = packages.find(p => p.profile === user.profile);
  }

  // Get device info (MAC + device name)
  const deviceInfo = deviceInfoMap.get(user.name) || { isOnline: false };

  return {
    id: user['.id'],
    name: user.name,
    password: user.password || '',
    profile: user.profile,
    server: user.server,
    bytesIn,
    bytesOut,
    bytesTotal,
    bytesLimit,
    uptime,
    status,
    comment,
    packageId: matchingPkg?.id || '',
    packageName: matchingPkg?.nameAr || '',
    priceLE: matchingPkg?.priceLE || 0,
    macAddress: deviceInfo.macAddress,
    deviceName: deviceInfo.deviceName,
    isOnline: deviceInfo.isOnline
  };
}

/**
 * Get all vouchers from router
 */
export async function getVouchers(): Promise<Voucher[]> {
  const client = await getMikroTikClient();
  const [hotspotUsers, activeSessions, cookies, dhcpLeases] = await Promise.all([
    client.getHotspotUsers(),
    client.getActiveSessions(),
    client.getHotspotCookies(),
    client.getDhcpLeases()
  ]);
  const packages = await getPackages();

  // Create set of active usernames for status detection
  const activeUsernames = new Set(activeSessions.map(s => s.user));

  // Build MAC → device name map from DHCP leases
  const macToDeviceName = new Map<string, string>();
  for (const lease of dhcpLeases) {
    const mac = lease['mac-address']?.toUpperCase();
    const hostName = lease['host-name'];
    if (mac && hostName) {
      macToDeviceName.set(mac, hostName.replace(/-/g, ' '));
    }
  }

  // Get stored device history from database (permanent storage)
  const storedDeviceMap = await getVoucherDeviceMap();

  // Build voucher → device info map
  // Priority: active sessions > cookies > stored history
  const deviceInfoMap = new Map<string, DeviceInfo>();

  // From active sessions (currently online) - also save to database
  for (const session of activeSessions) {
    const mac = session['mac-address']?.toUpperCase();
    const deviceName = mac ? macToDeviceName.get(mac) : undefined;
    deviceInfoMap.set(session.user, {
      macAddress: session['mac-address'],
      deviceName,
      isOnline: true
    });

    // Save to permanent storage
    if (mac) {
      const bytesIn = parseInt(session['bytes-in'] || '0', 10);
      const bytesOut = parseInt(session['bytes-out'] || '0', 10);
      recordVoucherUsage(session.user, mac, deviceName, session.address, bytesIn + bytesOut);
    }
  }

  // From cookies (for offline users who have connected before)
  for (const cookie of cookies) {
    // Don't overwrite active session info
    if (!deviceInfoMap.has(cookie.user)) {
      const mac = cookie['mac-address']?.toUpperCase();
      const deviceName = mac ? macToDeviceName.get(mac) : undefined;
      deviceInfoMap.set(cookie.user, {
        macAddress: cookie['mac-address'],
        deviceName,
        isOnline: false
      });

      // Save to permanent storage if we have the info
      if (mac) {
        recordVoucherUsage(cookie.user, mac, deviceName);
      }
    }
  }

  // From stored history (for users whose cookies expired)
  for (const [voucherCode, storedInfo] of storedDeviceMap) {
    if (!deviceInfoMap.has(voucherCode)) {
      deviceInfoMap.set(voucherCode, {
        macAddress: storedInfo.macAddress,
        deviceName: storedInfo.deviceName || undefined,
        isOnline: false
      });
    }
  }

  const vouchers = hotspotUsers
    .filter(u => !u.name.includes('default') && u.name !== 'admin')
    .map(u => transformToVoucher(u, packages, activeUsernames, deviceInfoMap));

  // Sync to cache in background (non-blocking)
  syncVouchersToCache(vouchers).catch(err => {
    console.error('[Vouchers] Failed to sync to cache:', err);
  });

  // Also sync active sessions
  syncSessionsToCache(activeSessions.map(s => ({
    id: s['.id'],
    user: s.user,
    macAddress: s['mac-address'],
    address: s.address,
    bytesIn: parseInt(s['bytes-in'] || '0', 10),
    bytesOut: parseInt(s['bytes-out'] || '0', 10),
    uptime: s.uptime
  }))).catch(err => {
    console.error('[Vouchers] Failed to sync sessions to cache:', err);
  });

  return vouchers;
}

/**
 * Get vouchers with cache fallback
 * Returns fresh data from router if available, falls back to cache if router unreachable
 */
export interface VouchersWithMeta {
  vouchers: Voucher[];
  source: 'router' | 'cache';
  syncedAt: string | null;
  isStale: boolean;
}

export async function getVouchersWithFallback(): Promise<VouchersWithMeta> {
  try {
    // Try to get fresh data from router
    const vouchers = await getVouchers();
    const syncedAt = new Date().toISOString();

    return {
      vouchers,
      source: 'router',
      syncedAt,
      isStale: false
    };
  } catch (error) {
    console.warn('[Vouchers] Router unreachable, falling back to cache:', error);

    // Fallback to cache
    try {
      const cachedVouchers = await getCachedVouchers();
      const syncedAt = await getLastSyncTime();
      const stale = await isCacheStale(300); // 5 minutes for fallback mode

      if (cachedVouchers && cachedVouchers.length > 0) {
        // Transform cached vouchers to Voucher format
        const packages = await getPackages();

        const vouchers: Voucher[] = cachedVouchers.map(cv => {
          const pkg = packages.find(p => p.id === cv.packageId);
          return {
            id: cv.id,
            name: cv.code,
            password: cv.password,
            profile: cv.profile || '',
            bytesIn: 0,
            bytesOut: 0,
            bytesTotal: cv.bytesUsed,
            bytesLimit: cv.bytesLimit || 0,
            uptime: cv.uptime || '0s',
            status: cv.status,
            comment: cv.comment || '',
            packageId: cv.packageId || '',
            packageName: pkg?.nameAr || '',
            priceLE: pkg?.priceLE || 0,
            macAddress: cv.macAddress || undefined,
            deviceName: cv.deviceName || undefined,
            isOnline: cv.isOnline
          };
        });

        return {
          vouchers,
          source: 'cache',
          syncedAt,
          isStale: stale
        };
      }
    } catch (cacheError) {
      console.error('[Vouchers] Cache read failed:', cacheError);
    }

    // No cache available or cache failed - return empty with offline status
    console.warn('[Vouchers] No cache available, returning empty');
    return {
      vouchers: [],
      source: 'cache',
      syncedAt: null,
      isStale: true
    };
  }
}

/**
 * Get voucher by MikroTik ID
 */
export async function getVoucherById(id: string): Promise<Voucher | undefined> {
  const vouchers = await getVouchers();
  return vouchers.find(v => v.id === id);
}

/**
 * Get voucher by name/code
 */
export async function getVoucherByName(name: string): Promise<Voucher | undefined> {
  const vouchers = await getVouchers();
  return vouchers.find(v => v.name === name);
}

/**
 * Create new vouchers in MikroTik
 * Username and password are the SAME code for easy single-field login
 */
export async function createVouchers(packageId: string, quantity: number): Promise<{ created: number }> {
  const pkg = getPackageById(packageId);
  if (!pkg) {
    throw new Error(`Invalid package: ${packageId}`);
  }

  const client = await getMikroTikClient();
  let created = 0;

  for (let i = 0; i < quantity; i++) {
    // Generate a fully random 6-character code used as BOTH username AND password
    const code = await generateVoucherCode(client);

    // Comment format: pkg:ID|created:TIMESTAMP|Display text
    // Timestamp used for "expire 24h after creation" logic
    const createdAt = Date.now();
    await client.createHotspotUser(code, code, pkg.profile, {
      limitBytes: pkg.bytesLimit || undefined,
      limitUptime: pkg.timeLimit || '1d',  // Safety net: 24h total connection time
      server: pkg.server || undefined,
      comment: `pkg:${pkg.id}|created:${createdAt}|${pkg.nameAr} - ${pkg.priceLE} LE`
    });
    created++;
  }

  return { created };
}

/**
 * Delete voucher from MikroTik and its usage history
 */
export async function deleteVoucher(id: string, voucherCode?: string): Promise<void> {
  const client = await getMikroTikClient();

  // If we have the voucher code, delete its usage history
  if (voucherCode) {
    deleteVoucherUsageHistory(voucherCode);
  }

  await client.deleteHotspotUser(id);

  // Remove from cache
  removeCachedVoucher(id).catch(err => {
    console.error('[Vouchers] Failed to remove from cache:', err);
  });
}

/**
 * Delete multiple vouchers and their usage history
 */
export async function deleteVouchers(vouchers: Array<{ id: string; name: string }>): Promise<{ deleted: number }> {
  const client = await getMikroTikClient();
  let deleted = 0;

  for (const voucher of vouchers) {
    // Delete usage history first
    deleteVoucherUsageHistory(voucher.name);
    // Then delete from MikroTik
    await client.deleteHotspotUser(voucher.id);
    deleted++;
  }

  // Remove from cache
  removeCachedVouchers(vouchers.map(v => v.id)).catch(err => {
    console.error('[Vouchers] Failed to remove batch from cache:', err);
  });

  return { deleted };
}

/**
 * Extend voucher time limit
 * @param id - MikroTik user ID
 * @param newLimitUptime - New total time limit (e.g., "3d", "4d", "72h")
 */
export async function extendVoucherTime(id: string, newLimitUptime: string): Promise<void> {
  const client = await getMikroTikClient();
  await client.updateHotspotUser(id, { limitUptime: newLimitUptime });
}

/**
 * Get voucher statistics
 */
export async function getVoucherStats(): Promise<{
  total: number;
  available: number;
  used: number;
  exhausted: number;
  revenue: number;
}> {
  const vouchers = await getVouchers();

  const available = vouchers.filter(v => v.status === 'available').length;
  const used = vouchers.filter(v => v.status === 'used').length;
  const exhausted = vouchers.filter(v => v.status === 'exhausted').length;

  // Calculate revenue from used vouchers
  const revenue = vouchers
    .filter(v => v.status === 'used' || v.status === 'exhausted')
    .reduce((sum, v) => sum + v.priceLE, 0);

  return {
    total: vouchers.length,
    available,
    used,
    exhausted,
    revenue
  };
}
