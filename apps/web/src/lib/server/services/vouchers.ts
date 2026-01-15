import { getMikroTikClient } from './mikrotik';
import { getPackages, getPackageById, type PackageConfig } from '$lib/server/config';
import type { HotspotUser } from '$lib/server/mikrotik/types';

// Characters for generating codes (excluding confusing ones like 0/O, 1/l/I)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

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
 * Generate 4-character alphanumeric password
 */
function generatePassword(): string {
  return generateRandomCode(4);
}

/**
 * Generate unique voucher username (format: G3XX, G1XX where XX is random alphanumeric)
 */
async function generateVoucherId(client: ReturnType<typeof getMikroTikClient>, codePrefix: string): Promise<string> {
  const users = await client.getHotspotUsers();
  const existingNames = new Set(users.map(u => u.name));

  // Try 2-character suffix first
  let attempts = 0;
  while (attempts < 100) {
    const code = `${codePrefix}${generateRandomCode(2)}`;
    if (!existingNames.has(code)) {
      return code;
    }
    attempts++;
  }

  // Fallback: use 3 characters if 2 chars are exhausted
  while (attempts < 200) {
    const code = `${codePrefix}${generateRandomCode(3)}`;
    if (!existingNames.has(code)) {
      return code;
    }
    attempts++;
  }

  throw new Error('Could not generate unique voucher ID');
}

/**
 * Transform MikroTik hotspot user to Voucher format
 */
function transformToVoucher(user: HotspotUser, packages: PackageConfig[]): Voucher {
  const bytesIn = parseInt(user['bytes-in'] || '0', 10);
  const bytesOut = parseInt(user['bytes-out'] || '0', 10);
  const bytesTotal = bytesIn + bytesOut;
  const bytesLimit = parseInt(user['limit-bytes-total'] || '0', 10);
  const uptime = user.uptime || '0s';

  // Determine status
  let status: 'available' | 'used' | 'exhausted' = 'available';
  if (bytesLimit > 0 && bytesTotal >= bytesLimit) {
    status = 'exhausted';
  } else if (uptime !== '0s' || bytesTotal > 0) {
    status = 'used';
  }

  // Find matching package by code prefix
  const matchingPkg = packages.find(p => user.name.startsWith(p.codePrefix));

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
    comment: user.comment || '',
    packageId: matchingPkg?.id || '',
    packageName: matchingPkg?.nameAr || '',
    priceLE: matchingPkg?.priceLE || 0
  };
}

/**
 * Get all vouchers from router
 */
export async function getVouchers(): Promise<Voucher[]> {
  const client = getMikroTikClient();
  const hotspotUsers = await client.getHotspotUsers();
  const packages = getPackages();

  return hotspotUsers
    .filter(u => !u.name.includes('default') && u.name !== 'admin')
    .map(u => transformToVoucher(u, packages));
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
 */
export async function createVouchers(packageId: string, quantity: number): Promise<{ created: number }> {
  const pkg = getPackageById(packageId);
  if (!pkg) {
    throw new Error(`Invalid package: ${packageId}`);
  }

  const client = getMikroTikClient();
  let created = 0;

  for (let i = 0; i < quantity; i++) {
    const username = await generateVoucherId(client, pkg.codePrefix);
    const password = generatePassword();

    // Note: bytes limit comes from the MikroTik profile, not stored locally
    await client.createHotspotUser(username, password, pkg.profile, {
      server: pkg.server || undefined,
      comment: `${pkg.nameAr} - ${pkg.priceLE} LE`
    });
    created++;
  }

  return { created };
}

/**
 * Delete voucher from MikroTik
 */
export async function deleteVoucher(id: string): Promise<void> {
  const client = getMikroTikClient();
  await client.deleteHotspotUser(id);
}

/**
 * Delete multiple vouchers
 */
export async function deleteVouchers(ids: string[]): Promise<{ deleted: number }> {
  const client = getMikroTikClient();
  let deleted = 0;

  for (const id of ids) {
    await client.deleteHotspotUser(id);
    deleted++;
  }

  return { deleted };
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
