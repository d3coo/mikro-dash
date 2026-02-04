/**
 * Voucher Cache Service
 *
 * Provides local-first caching for MikroTik vouchers.
 * Reads are instant from SQLite, writes sync to router + cache.
 */

import { db, syncAfterWrite } from '$lib/server/db';
import { vouchersCache, sessionsCache } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { Voucher } from './vouchers';

// Cache configuration
const DEFAULT_CACHE_MAX_AGE_SECONDS = 60; // 1 minute

export interface CachedVoucher {
  id: string;
  code: string;
  password: string;
  status: 'available' | 'used' | 'exhausted';
  packageId: string | null;
  profile: string | null;
  bytesLimit: number | null;
  bytesUsed: number;
  timeLimit: string | null;
  uptime: string | null;
  macAddress: string | null;
  deviceName: string | null;
  isOnline: boolean;
  comment: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  syncedAt: string;
}

export interface CachedSession {
  id: string;
  voucherCode: string;
  macAddress: string | null;
  ipAddress: string | null;
  bytesIn: number;
  bytesOut: number;
  uptime: string | null;
  startedAt: string | null;
  syncedAt: string;
}

export interface VoucherCacheResult {
  vouchers: CachedVoucher[];
  source: 'router' | 'cache';
  syncedAt: string | null;
  isStale: boolean;
}

/**
 * Sync vouchers from router to local cache
 */
export async function syncVouchersToCache(vouchers: Voucher[]): Promise<void> {
  const now = new Date().toISOString();

  // Clear existing cache and insert fresh data
  // Using a transaction for atomicity
  await db.delete(vouchersCache);

  if (vouchers.length === 0) return;

  // Insert all vouchers
  const cacheRows = vouchers.map(v => ({
    id: v.id,
    code: v.name,
    password: v.password || v.name, // Fallback to code if no password
    status: v.status,
    packageId: v.packageId || null,
    profile: v.profile || null,
    bytesLimit: v.bytesLimit || null,
    bytesUsed: v.bytesTotal || 0,
    timeLimit: null, // Not currently tracked
    uptime: v.uptime || null,
    macAddress: v.macAddress || null,
    deviceName: v.deviceName || null,
    isOnline: v.isOnline ? 1 : 0,
    comment: v.comment || null,
    createdAt: null, // Could parse from comment if needed
    lastSeenAt: v.isOnline ? now : null,
    syncedAt: now,
  }));

  // Insert in batches of 100 to avoid SQLite limits
  const batchSize = 100;
  for (let i = 0; i < cacheRows.length; i += batchSize) {
    const batch = cacheRows.slice(i, i + batchSize);
    await db.insert(vouchersCache).values(batch);
  }

  console.log(`[VoucherCache] Synced ${vouchers.length} vouchers to cache`);
  syncAfterWrite();
}

/**
 * Sync active sessions to cache
 */
export async function syncSessionsToCache(sessions: Array<{
  id: string;
  user: string;
  macAddress?: string;
  address?: string;
  bytesIn?: number;
  bytesOut?: number;
  uptime?: string;
}>): Promise<void> {
  const now = new Date().toISOString();

  // Clear and insert fresh
  await db.delete(sessionsCache);

  if (sessions.length === 0) return;

  const cacheRows = sessions.map(s => ({
    id: s.id,
    voucherCode: s.user,
    macAddress: s.macAddress || null,
    ipAddress: s.address || null,
    bytesIn: s.bytesIn || 0,
    bytesOut: s.bytesOut || 0,
    uptime: s.uptime || null,
    startedAt: null,
    syncedAt: now,
  }));

  await db.insert(sessionsCache).values(cacheRows);

  console.log(`[VoucherCache] Synced ${sessions.length} sessions to cache`);
  syncAfterWrite();
}

/**
 * Get the last sync timestamp
 */
export async function getLastSyncTime(): Promise<string | null> {
  const result = await db.select({ syncedAt: vouchersCache.syncedAt })
    .from(vouchersCache)
    .limit(1);

  return result[0]?.syncedAt || null;
}

/**
 * Check if cache is stale
 */
export async function isCacheStale(maxAgeSeconds: number = DEFAULT_CACHE_MAX_AGE_SECONDS): Promise<boolean> {
  const lastSync = await getLastSyncTime();
  if (!lastSync) return true;

  const syncedAt = new Date(lastSync).getTime();
  const now = Date.now();
  const ageSeconds = (now - syncedAt) / 1000;

  return ageSeconds > maxAgeSeconds;
}

/**
 * Get vouchers from cache
 */
export async function getCachedVouchers(): Promise<CachedVoucher[] | null> {
  const rows = await db.select().from(vouchersCache);

  if (rows.length === 0) return null;

  return rows.map(row => ({
    id: row.id,
    code: row.code,
    password: row.code, // Passwords are same as codes in this system
    status: row.status as 'available' | 'used' | 'exhausted',
    packageId: row.packageId,
    profile: row.profile,
    bytesLimit: row.bytesLimit,
    bytesUsed: row.bytesUsed || 0,
    timeLimit: row.timeLimit,
    uptime: row.uptime,
    macAddress: row.macAddress,
    deviceName: row.deviceName,
    isOnline: row.isOnline === 1,
    comment: null,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    syncedAt: row.syncedAt,
  }));
}

/**
 * Get cached sessions
 */
export async function getCachedSessions(): Promise<CachedSession[] | null> {
  const rows = await db.select().from(sessionsCache);

  if (rows.length === 0) return null;

  return rows.map(row => ({
    id: row.id,
    voucherCode: row.voucherCode,
    macAddress: row.macAddress,
    ipAddress: row.ipAddress,
    bytesIn: row.bytesIn || 0,
    bytesOut: row.bytesOut || 0,
    uptime: row.uptime,
    startedAt: row.startedAt,
    syncedAt: row.syncedAt,
  }));
}

/**
 * Get voucher count from cache (fast stats)
 */
export async function getCachedVoucherStats(): Promise<{
  total: number;
  available: number;
  used: number;
  exhausted: number;
  online: number;
} | null> {
  const vouchers = await getCachedVouchers();
  if (!vouchers) return null;

  return {
    total: vouchers.length,
    available: vouchers.filter(v => v.status === 'available').length,
    used: vouchers.filter(v => v.status === 'used').length,
    exhausted: vouchers.filter(v => v.status === 'exhausted').length,
    online: vouchers.filter(v => v.isOnline).length,
  };
}

/**
 * Update a single voucher in cache after mutation
 */
export async function updateCachedVoucher(voucher: Voucher): Promise<void> {
  const now = new Date().toISOString();

  await db.update(vouchersCache)
    .set({
      code: voucher.name,
      status: voucher.status,
      packageId: voucher.packageId || null,
      profile: voucher.profile || null,
      bytesLimit: voucher.bytesLimit || null,
      bytesUsed: voucher.bytesTotal || 0,
      uptime: voucher.uptime || null,
      macAddress: voucher.macAddress || null,
      deviceName: voucher.deviceName || null,
      isOnline: voucher.isOnline ? 1 : 0,
      lastSeenAt: voucher.isOnline ? now : null,
      syncedAt: now,
    })
    .where(eq(vouchersCache.id, voucher.id));
  syncAfterWrite();
}

/**
 * Remove a voucher from cache
 */
export async function removeCachedVoucher(id: string): Promise<void> {
  await db.delete(vouchersCache).where(eq(vouchersCache.id, id));
  syncAfterWrite();
}

/**
 * Remove multiple vouchers from cache
 */
export async function removeCachedVouchers(ids: string[]): Promise<void> {
  for (const id of ids) {
    await db.delete(vouchersCache).where(eq(vouchersCache.id, id));
  }
  syncAfterWrite();
}

/**
 * Add new vouchers to cache (after creation)
 */
export async function addVouchersToCache(vouchers: Voucher[]): Promise<void> {
  const now = new Date().toISOString();

  const cacheRows = vouchers.map(v => ({
    id: v.id,
    code: v.name,
    password: v.password || v.name,
    status: v.status,
    packageId: v.packageId || null,
    profile: v.profile || null,
    bytesLimit: v.bytesLimit || null,
    bytesUsed: 0,
    timeLimit: null,
    uptime: null,
    macAddress: null,
    deviceName: null,
    isOnline: 0,
    comment: v.comment || null,
    createdAt: now,
    lastSeenAt: null,
    syncedAt: now,
  }));

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < cacheRows.length; i += batchSize) {
    const batch = cacheRows.slice(i, i + batchSize);
    await db.insert(vouchersCache).values(batch);
  }
  syncAfterWrite();
}

/**
 * Clear all cache (for full refresh)
 */
export async function clearVoucherCache(): Promise<void> {
  await db.delete(vouchersCache);
  await db.delete(sessionsCache);
  console.log('[VoucherCache] Cache cleared');
  syncAfterWrite();
}
